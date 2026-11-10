
const BASE = 'https://www.bi.go.id/hargapangan';
const SOURCE_NAME = 'PIHPS Nasional – Bank Indonesia';

const PLACE_TYPES = {
  tradisional: { id: 1, label: 'Pasar tradisional', page: `${BASE}/TabelHarga/PasarTradisionalKomoditas` },
  modern: { id: 2, label: 'Supermarket (pasar modern)', page: `${BASE}/TabelHarga/PasarModernKomoditas` },
};

const COMMODITIES = [
  { name: 'Beras medium', code: 'com_3' },
  { name: 'Beras premium', code: 'com_5' },
  { name: 'Gula pasir', code: 'com_21' },
  { name: 'Minyak goreng', code: 'com_18' },
  { name: 'Telur ayam', code: 'com_10' },
  { name: 'Daging ayam ras', code: 'com_7' },
  { name: 'Daging sapi', code: 'com_8' },
  { name: 'Bawang merah', code: 'com_11' },
  { name: 'Bawang putih', code: 'com_12' },
  { name: 'Cabai merah', code: 'com_13' },
  { name: 'Cabai rawit merah', code: 'com_16' },
  { name: 'Jagung pipilan', code: null },
];

const RANGES = {
  '7d': { days: 7, tipe: 1, granularity: 'harian' },
  '14d': { days: 14, tipe: 1, granularity: 'harian' },
  '30d': { days: 30, tipe: 1, granularity: 'harian' },
  '3m': { months: 3, tipe: 4, granularity: 'mingguan' },
  '6m': { months: 6, tipe: 4, granularity: 'mingguan' },
  '12m': { months: 12, tipe: 3, granularity: 'bulanan' },
};

const PROVINCE_ALIASES = {
  'Semua Provinsi': 'Indonesia',
  'Kepulauan Riau': 'Kep. Riau',
  'Kepulauan Bangka Belitung': 'Kep. Bangka Belitung',
};

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Mei: 5, Jun: 6, Jul: 7, Aug: 8, Agu: 8, Sep: 9, Oct: 10, Okt: 10, Nov: 11, Dec: 12, Des: 12 };
const pad = n => String(n).padStart(2, '0');
const isoDate = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

function todayWIB() {
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function dateWindow(rangeKey) {
  const r = RANGES[rangeKey];
  const end = todayWIB();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  if (r.days) start.setUTCDate(start.getUTCDate() - (r.days - 1));
  else start.setUTCMonth(start.getUTCMonth() - r.months);
  return { start: isoDate(start), end: isoDate(end) };
}

function headerToIso(key) {
  let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(key);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^([A-Za-z]{3})\s+(\d{4})$/.exec(key.trim());
  if (m && MONTHS[m[1]]) return `${m[2]}-${pad(MONTHS[m[1]])}-01`;
  return null;
}

function parsePrice(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s === '-' ) return null;
  const n = Number(s.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(/,/g, '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

async function getJson(url, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'PANGAN-PAS/1.0 (+edukasi harga pangan; sumber PIHPS BI)', Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

let unitCache = null;
async function getUnits() {
  if (unitCache) return unitCache;
  const json = await getJson(`${BASE}/WebSite/TabelHarga/GetRefCommodityAndCategory`);
  const map = {};
  for (const row of json.data || []) map[row.id] = { name: String(row.name).trim(), unit: row.denomination || 'kg' };
  unitCache = map;
  return map;
}

async function fetchCommodity(priceTypeId, code, rangeKey) {
  const { start, end } = dateWindow(rangeKey);
  const params = new URLSearchParams({
    price_type_id: String(priceTypeId), comcat_id: code, province_id: '', regency_id: '', market_id: '',
    tipe_laporan: String(RANGES[rangeKey].tipe), start_date: start, end_date: end,
  });
  const json = await getJson(`${BASE}/WebSite/TabelHarga/GetGridDataKomoditas?${params}`);
  const rows = Array.isArray(json.data) ? json.data : [];
  const series = {};
  const dates = new Set();
  for (const row of rows) {
    const province = PROVINCE_ALIASES[row.name] || row.name;
    const points = {};
    for (const [key, value] of Object.entries(row)) {
      const iso = headerToIso(key);
      if (!iso) continue;
      dates.add(iso);
      points[iso] = parsePrice(value);
    }
    series[province] = points;
  }
  return { series, dates: [...dates] };
}

const memo = new Map();
const TTL = 3 * 3600 * 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(priceTypeId, code, rangeKey, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fetchCommodity(priceTypeId, code, rangeKey); }
    catch (e) { last = e; await sleep(700 * (i + 1)); }
  }
  throw last;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

async function getPrices(jenis, rangeKey) {
  const place = PLACE_TYPES[jenis];
  const range = RANGES[rangeKey];
  if (!place || !range) throw Object.assign(new Error('Parameter jenis/rentang tidak valid'), { status: 400 });
  const window = dateWindow(rangeKey);

  const units = await getUnits().catch(() => ({}));
  const results = await mapLimit(COMMODITIES, 4, async c => {
    if (!c.code) return [c, { available: false, reason: 'Komoditas ini tidak dipantau oleh PIHPS Bank Indonesia.' }];
    const key = `${jenis}|${rangeKey}|${window.end}|${c.code}`;
    const hit = memo.get(key);
    if (hit && Date.now() - hit.at < TTL) return [c, { ok: true, ...hit.value }];
    try {
      const data = await fetchWithRetry(place.id, c.code, rangeKey);
      memo.set(key, { at: Date.now(), value: data });
      return [c, { ok: true, ...data }];
    } catch (e) {
      return [c, { available: false, transient: true, reason: 'Sumber PIHPS tidak dapat dihubungi untuk komoditas ini. Coba muat ulang beberapa saat lagi.', error: String(e.message || e) }];
    }
  });

  const allDates = new Set();
  for (const [, r] of results) if (r.ok) r.dates.forEach(d => allDates.add(d));
  const dates = [...allDates].sort();

  const commodities = {};
  let partial = false;
  for (const [c, r] of results) {
    if (!r.ok) { commodities[c.name] = { available: false, reason: r.reason }; if (r.transient) partial = true; continue; }
    const series = {};
    let any = false;
    for (const [province, points] of Object.entries(r.series)) {
      const arr = dates.map(d => (d in points ? points[d] : null));
      if (arr.some(v => v != null)) any = true;
      series[province] = arr;
    }
    const meta = units[c.code] || {};
    commodities[c.name] = any
      ? { available: true, sourceCode: c.code, sourceName: meta.name || c.name, unit: meta.unit || 'kg', series }
      : { available: false, reason: `Belum ada data ${place.label.toLowerCase()} untuk periode ini.` };
  }

  const value = {
    ok: true,
    source: { name: SOURCE_NAME, url: place.page, home: BASE, coverage: 'Rata-rata harga pasar pantauan PIHPS per provinsi' },
    jenis, jenisLabel: place.label, rentang: rangeKey, granularity: range.granularity,
    window, fetchedAt: new Date().toISOString(), partial, dates, commodities,
  };
  return value;
}

module.exports = { getPrices, PLACE_TYPES, RANGES, COMMODITIES, SOURCE_NAME, BASE, getJson, getUnits, parsePrice, headerToIso, todayWIB, isoDate, mapLimit };
