const ENDPOINTS = {
  auth: 'auth.php',
  profil: 'profil.php',
  pantauan: 'pantauan.php',
  kiriman: 'kiriman.php',   // komunitas (kirim/hapus wajib login)
  komentar: 'komentar.php', // komunitas (komentar/balasan wajib login)
};
const FORWARD_HEADERS = ['cookie', 'content-type', 'accept', 'x-pangan-request', 'user-agent', 'accept-language'];
const MAX_BODY = 64 * 1024;
const MAX_BODY_UPLOAD = 3 * 1024 * 1024; // kiriman dengan foto bukti

function readBody(req, max = MAX_BODY) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
    return Promise.resolve(Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body)));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => { size += c.length; if (size > max) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const fromPath = url.pathname.match(/\/api\/akun\/([a-z-]+)\/?$/);
  const ep = (fromPath && fromPath[1]) || url.searchParams.get('ep') || '';
  url.searchParams.delete('ep');
  const file = ENDPOINTS[ep];
  if (!file) return send(res, 404, { ok: false, error: 'Endpoint akun tidak dikenal.' });
  if (!['GET', 'POST', 'DELETE', 'OPTIONS'].includes(req.method)) return send(res, 405, { ok: false, error: 'Metode tidak didukung.' });

  const origin = (process.env.ACCOUNT_API_ORIGIN || '').replace(/\/+$/, '');
  if (!origin) {
    return send(res, 503, { ok: false, notConfigured: true, error: 'Server akun belum dikonfigurasi (ACCOUNT_API_ORIGIN).' });
  }

  const headers = {};
  for (const h of FORWARD_HEADERS) if (req.headers[h]) headers[h] = String(req.headers[h]);
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (ip) headers['x-forwarded-for'] = ip;
  if (process.env.ACCOUNT_PROXY_SECRET) headers['x-pangan-proxy'] = process.env.ACCOUNT_PROXY_SECRET;

  try {
    const body = req.method === 'POST' ? await readBody(req, ep === 'kiriman' ? MAX_BODY_UPLOAD : MAX_BODY) : undefined;
    const qs = url.searchParams.toString();
    const upstream = await fetch(`${origin}/${file}${qs ? `?${qs}` : ''}`, { method: req.method, headers, body, redirect: 'manual' });
    res.statusCode = upstream.status;
    for (const h of ['content-type', 'location', 'cache-control']) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    if (!upstream.headers.get('cache-control')) res.setHeader('Cache-Control', 'no-store');
    const cookies = typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : [];
    if (cookies.length) res.setHeader('Set-Cookie', cookies.map(c => c.replace(/;\s*domain=[^;]*/gi, '')));
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    send(res, e.status || 502, { ok: false, error: e.status === 413 ? 'Data terlalu besar.' : 'Server akun tidak dapat dihubungi.' });
  }
};

module.exports.config = { maxDuration: 20 };
