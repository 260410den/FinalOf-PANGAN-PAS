// The API key stays on the server (env NVIDIA_API_KEY); the browser never sees it.
const { Readable } = require('node:stream');

const ENDPOINT = `${(process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '')}/chat/completions`;
const MODEL = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3.5-super-vl-120b-a12b';
const MODES = {
  fast: { temperature: 0.2, top_p: 0.9, max_tokens: 400, thinking: false, stream: true },
  chat: { temperature: 0.6, top_p: 0.95, max_tokens: 4096, thinking: true, stream: true },
  extract: { temperature: 0.1, top_p: 0.9, max_tokens: 700, thinking: false, stream: false },
};
const GUARD = 'Kamu adalah asisten resmi aplikasi PANGAN PAS (informasi harga pangan Indonesia, data PIHPS Bank Indonesia). '
  + 'Bantu hanya untuk topik harga/ketersediaan pangan, belanja bahan pokok, dan cara memakai fitur PANGAN PAS. '
  + 'Tolak dengan sopan permintaan lain (misalnya menulis kode, tugas umum, konten berbahaya). Jangan pernah mengarang angka harga.';
const MAX_MESSAGES = 16;
const MAX_TEXT = 14000;
const MAX_IMAGES = 2;
const MAX_IMAGE_CHARS = 400 * 1024;
const MAX_BODY = 1024 * 1024;

// Simple per-instance limiter so the key cannot be drained by one client.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 20;
}

function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return Promise.resolve(JSON.parse(req.body.toString('utf8')));
    return Promise.resolve(typeof req.body === 'string' ? JSON.parse(req.body) : req.body);
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('Data terlalu besar.'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')); } catch { reject(Object.assign(new Error('Format JSON tidak valid.'), { status: 400 })); } });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function cleanMessages(list) {
  if (!Array.isArray(list) || !list.length || list.length > MAX_MESSAGES) throw new Error('Format percakapan tidak valid.');
  let images = 0;
  return list.map(m => {
    if (!m || !['system', 'user', 'assistant'].includes(m.role)) throw new Error('Peran pesan tidak valid.');
    if (typeof m.content === 'string') {
      if (m.content.length > MAX_TEXT) throw new Error('Pesan terlalu panjang.');
      return { role: m.role, content: m.content };
    }
    if (!Array.isArray(m.content) || m.role !== 'user') throw new Error('Isi pesan tidak valid.');
    const parts = m.content.map(p => {
      if (p?.type === 'text' && typeof p.text === 'string' && p.text.length <= MAX_TEXT) return { type: 'text', text: p.text };
      const url = p?.type === 'image_url' ? p.image_url?.url : null;
      if (typeof url === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url) && url.length <= MAX_IMAGE_CHARS) {
        if (++images > MAX_IMAGES) throw new Error(`Maksimal ${MAX_IMAGES} gambar per pertanyaan.`);
        return { type: 'image_url', image_url: { url } };
      }
      throw new Error('Gambar harus JPG/PNG/WebP dan berukuran kecil.');
    });
    return { role: 'user', content: parts };
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { error: 'Method not allowed' }); }
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return send(res, 503, { error: 'Asisten AI belum dikonfigurasi di server (NVIDIA_API_KEY).', notConfigured: true });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (limited(ip)) return send(res, 429, { error: 'Terlalu banyak pertanyaan dalam satu menit. Coba lagi sebentar.' });

  let payload, messages;
  try {
    payload = await readBody(req);
    messages = cleanMessages(payload?.messages);
  } catch (e) {
    return send(res, e.status || 400, { error: e.message || 'Format percakapan tidak valid.' });
  }
  const mode = MODES[payload.mode] ? payload.mode : 'fast';
  const cfg = MODES[mode];
  const body = {
    model: MODEL,
    messages: [{ role: 'system', content: GUARD }, ...messages],
    temperature: cfg.temperature,
    top_p: cfg.top_p,
    max_tokens: cfg.max_tokens,
    seed: 42,
    stream: cfg.stream,
    chat_template_kwargs: { enable_thinking: cfg.thinking },
  };

  try {
    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: cfg.stream ? 'text/event-stream' : 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(mode === 'chat' ? 120_000 : 60_000),
    });
    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 600);
      const msg = upstream.status === 401 || upstream.status === 403 ? 'Kunci NVIDIA_API_KEY ditolak. Periksa kunci di pengaturan server.'
        : upstream.status === 404 ? `Model ${MODEL} tidak ditemukan di NVIDIA API.`
          : upstream.status === 429 ? 'Kuota layanan AI sedang penuh. Coba lagi nanti.' : 'Layanan AI mengembalikan galat.';
      return send(res, upstream.status >= 500 ? 502 : upstream.status, { error: msg, detail });
    }
    if (!cfg.stream) {
      const json = await upstream.json();
      return send(res, 200, { content: json.choices?.[0]?.message?.content || '', model: MODEL });
    }
    if (!upstream.body) return send(res, 502, { error: 'Stream dari layanan AI tidak tersedia.' });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (e) {
    if (!res.headersSent) return send(res, 502, { error: e?.name === 'TimeoutError' ? 'Layanan AI terlalu lama merespons.' : 'Layanan AI sedang tidak bisa dihubungi.' });
    res.end();
  }
};

module.exports.config = { maxDuration: 120 };
