const { BASE, SOURCE_NAME, COMMODITIES, getJson, getUnits, parsePrice, headerToIso, todayWIB, isoDate, mapLimit } = require('./_pihps.js');
const { regencies } = require('./_regencies.json');

const BY_ID = new Map(regencies.map(r => [r.id, r]));
const TYPES = { tradisional: 1, modern: 2 };
const MAX_CITIES = 25;
const WINDOW_DAYS = 14;  // look back far enough to skip weekends/holidays
const STALE_DAYS = 7;    // older than this is flagged as outdated
const TTL = 3 * 3600 * 1000;
const memo = new Map();

const cached = async (key, fn) => {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = await fn();
  memo.set(key, { at: Date.now(), value });
  return value;
};

function windowDates() {
  const end = todayWIB();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (WINDOW_DAYS - 1));
  return { start: isoDate(start), end: isoDate(end) };
}

function latestFor(rows, pihpsName) {
  const want = String(pihpsName || '').trim().toLowerCase();
  const row = rows.find(r => String(r.name).trim().toLowerCase() === want)
    || (rows.length === 1 ? rows[0] : null);
  if (!row) return null;
  let best = null;
  for (const [key, value] of Object.entries(row)) {
    const iso = headerToIso(key);
    const price = iso ? parsePrice(value) : null;
    if (price != null && (!best || iso > best.date)) best = { date: iso, price };
  }
  return best;
}

async function gridDaerah(typeId, code, reg, marketId = '') {
  const { start, end } = windowDates();
  const params = new URLSearchParams({
    price_type_id: String(typeId), comcat_id: code, province_id: String(reg.provinceId), regency_id: String(reg.id),
    market_id: String(marketId), tipe_laporan: '1', start_date: start, end_date: end,
  });
  const json = await getJson(`${BASE}/WebSite/TabelHarga/GetGridDataDaerah?${params}`);
  return Array.isArray(json.data) ? json.data : [];
}

async function storesIn(reg) {
  return cached(`stores:${reg.id}`, async () => {
    const json = await getJson(`${BASE}/WebSite/TabelHarga/GetRefMarket?price_type_id=2&ref_regency_id=${reg.id}`);
    return (json.data || []).map(s => ({ id: s.id, name: String(s.name).trim() })).filter(s => s.id !== reg.id);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }
  const url = new URL(req.url, 'http://localhost');
  const jenis = url.searchParams.get('jenis') === 'modern' ? 'modern' : 'tradisional';
  const name = url.searchParams.get('komoditas') || '';
  const com = COMMODITIES.find(c => c.name === name);
  if (!com) return res.status(400).json({ ok: false, error: 'Komoditas tidak dikenal.' });
  const ids = [...new Set((url.searchParams.get('kota') || '').split(',').map(Number).filter(n => BY_ID.has(n)))].slice(0, MAX_CITIES);
  const typeId = TYPES[jenis];
  const cities = ids.map(id => BY_ID.get(id)).filter(r => r.types.includes(typeId));

  const base = { ok: true, source: { name: SOURCE_NAME, url: `${BASE}/TabelHarga/${jenis === 'modern' ? 'PasarModernDaerah' : 'PasarTradisionalDaerah'}` }, jenis, komoditas: name, fetchedAt: new Date().toISOString() };
  if (!com.code) return res.status(200).json({ ...base, available: false, reason: 'Komoditas ini tidak dipantau PIHPS.', results: [] });
  if (!cities.length) return res.status(200).json({ ...base, available: true, results: [] });

  try {
    const units = await getUnits();
    const pihps = units[com.code] || {};
    const today = todayWIB();
    const staleBefore = new Date(today); staleBefore.setUTCDate(staleBefore.getUTCDate() - STALE_DAYS);
    const stale = d => d < isoDate(staleBefore);
    let failed = 0;

    const perCity = await mapLimit(cities, 4, async reg => {
      const place = { regencyId: reg.id, kota: reg.name, provinsi: reg.province, lat: reg.lat, lon: reg.lon };
      try {
        if (jenis === 'tradisional') {
          const latest = await cached(`t:${com.code}:${reg.id}`, async () => latestFor(await gridDaerah(1, com.code, reg), pihps.name));
          return [{ ...place, tempat: `Pasar tradisional pantauan PIHPS di ${reg.name}`, toko: null, harga: latest?.price ?? null, tanggal: latest?.date ?? null, kedaluwarsa: latest ? stale(latest.date) : false }];
        }
        const [latest, stores] = await Promise.all([
          cached(`m:${com.code}:${reg.id}`, async () => latestFor(await gridDaerah(2, com.code, reg), pihps.name)),
          storesIn(reg).catch(() => []),
        ]);
        return [{ ...place, tempat: `Supermarket pantauan PIHPS di ${reg.name}`, toko: stores.map(x => x.name), harga: latest?.price ?? null, tanggal: latest?.date ?? null, kedaluwarsa: latest ? stale(latest.date) : false }];
      } catch {
        failed++;
        return [{ ...place, tempat: reg.name, toko: null, harga: null, tanggal: null, kedaluwarsa: false, gagal: true }];
      }
    });

    res.setHeader('Cache-Control', failed ? 'public, s-maxage=60' : 'public, s-maxage=10800, stale-while-revalidate=86400');
    return res.status(200).json({
      ...base, available: true, partial: failed > 0,
      kualitas: pihps.name || name, unit: pihps.unit || 'kg',
      results: perCity.flat(),
    });
  } catch {
    return res.status(502).json({ ok: false, error: 'Sumber harga PIHPS tidak dapat dihubungi saat ini.' });
  }
};

module.exports.config = { maxDuration: 60 };
