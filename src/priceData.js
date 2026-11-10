import React from 'react';

export const PERIODS = ['7 hari', '14 hari', '30 hari', '3 bulan', '6 bulan', '12 bulan'];
export const PERIOD_KEYS = { '7 hari': '7d', '14 hari': '14d', '30 hari': '30d', '3 bulan': '3m', '6 bulan': '6m', '12 bulan': '12m' };
export const PLACE_TYPES = [
  { key: 'tradisional', label: 'Pasar tradisional' },
  { key: 'modern', label: 'Supermarket' },
];
export const placeLabel = key => PLACE_TYPES.find(p => p.key === key)?.label || key;
export const NO_DATA = 'Data belum tersedia';

const cache = new Map();
export function fetchPrices(jenis, period) {
  const key = `${jenis}|${PERIOD_KEYS[period] || '7d'}`;
  if (!cache.has(key)) {
    const p = fetch(`/api/harga?jenis=${encodeURIComponent(jenis)}&rentang=${PERIOD_KEYS[period] || '7d'}`)
      .then(async r => {
        const body = await r.json().catch(() => null);
        if (!r.ok || !body?.ok) throw new Error(body?.error || `Sumber harga tidak dapat dihubungi (HTTP ${r.status}).`);
        return body;
      })
      .catch(e => { cache.delete(key); throw e; });
    cache.set(key, p);
  }
  return cache.get(key);
}

export function usePrices(jenis, period) {
  const [state, setState] = React.useState({ status: 'loading', data: null, error: null });
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    setState({ status: 'loading', data: null, error: null });
    fetchPrices(jenis, period)
      .then(data => { if (live) setState({ status: 'ready', data, error: null }); })
      .catch(error => { if (live) setState({ status: 'error', data: null, error: error.message }); });
    return () => { live = false; };
  }, [jenis, period, attempt]);
  return { ...state, retry: () => setAttempt(a => a + 1) };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export function formatDate(iso, granularity = 'harian') {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (granularity === 'bulanan') return `${MONTHS[m - 1]} ${y}`;
  return `${d} ${MONTHS[m - 1]}${granularity === 'mingguan' ? ` ${String(y).slice(2)}` : ''}`;
}
export function formatDateLong(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
export function formatTimestamp(isoTs) {
  if (!isoTs) return '';
  return new Date(isoTs).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';
}
export const granularityLabel = g => ({ harian: 'harga harian', mingguan: 'harga per minggu', bulanan: 'harga per bulan' }[g] || g);

export const commodityInfo = (data, commodity) => data?.commodities?.[commodity] || null;
export const isAvailable = (data, commodity) => Boolean(commodityInfo(data, commodity)?.available);
export const unitOf = (data, commodity, fallback = 'kg') => commodityInfo(data, commodity)?.unit || fallback;

export function seriesOf(data, commodity, province) {
  const c = commodityInfo(data, commodity);
  if (!c?.available) return null;
  const arr = c.series[province];
  if (!arr) return null;
  const pts = [];
  data.dates.forEach((date, i) => { if (arr[i] != null) pts.push({ date, label: formatDate(date, data.granularity), price: arr[i] }); });
  return pts.length ? pts : null;
}

export function statOf(data, commodity, province) {
  const pts = seriesOf(data, commodity, province);
  if (!pts) return null;
  const first = pts[0], last = pts[pts.length - 1];
  return {
    price: last.price, date: last.date, firstPrice: first.price, firstDate: first.date,
    change: pts.length > 1 && first.price ? ((last.price - first.price) / first.price) * 100 : null,
    points: pts,
  };
}

export function indexOf(data, province, commodities) {
  const ratios = [];
  for (const name of commodities) {
    const s = statOf(data, name, province);
    if (s && s.points.length > 1 && s.firstPrice) ratios.push((s.price / s.firstPrice) * 100);
  }
  if (!ratios.length) return null;
  const value = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return { value, change: value - 100, count: ratios.length };
}

export function indexSeries(data, province, commodities) {
  if (!data) return null;
  const sums = data.dates.map(() => ({ s: 0, n: 0 }));
  for (const name of commodities) {
    const c = commodityInfo(data, name);
    const arr = c?.available ? c.series[province] : null;
    if (!arr) continue;
    const base = arr.find(v => v != null);
    if (!base) continue;
    arr.forEach((v, i) => { if (v != null) { sums[i].s += (v / base) * 100; sums[i].n += 1; } });
  }
  const pts = [];
  data.dates.forEach((date, i) => { if (sums[i].n) pts.push({ date, label: formatDate(date, data.granularity), price: Number((sums[i].s / sums[i].n).toFixed(2)) }); });
  return pts.length ? pts : null;
}

export const latestDate = data => {
  if (!data) return null;
  for (let i = data.dates.length - 1; i >= 0; i--) {
    for (const c of Object.values(data.commodities)) if (c.available && Object.values(c.series).some(arr => arr[i] != null)) return data.dates[i];
  }
  return null;
};

export const trendStatus = change => change == null ? 'nodata' : change < -0.5 ? 'turun' : change > 0.5 ? 'naik' : 'stabil';

export function toRecords(data, commodity, provinces) {
  const c = commodityInfo(data, commodity);
  if (!c?.available) return [];
  const out = [];
  for (const province of provinces) {
    const arr = c.series[province];
    if (!arr) continue;
    data.dates.forEach((date, i) => {
      if (arr[i] == null) return;
      out.push({
        komoditas: commodity, komoditas_sumber: c.sourceName, harga: arr[i], satuan: c.unit, provinsi: province,
        jenis_tempat: data.jenisLabel, nama_pasar_toko: data.source.coverage, tanggal_pengamatan: date,
        url_sumber: data.source.url, diambil_pada: data.fetchedAt,
      });
    });
  }
  return out;
}


const FAV_KEY = 'pangan-pas-favorit-provinsi-v1';
const readFavs = () => { try { const v = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch { return []; } };
const favListeners = new Set();
let favBridge = null; // { list(): string[]|null, add(name), remove(name), subscribe(fn): unsubscribe }
export function setFavoriteBridge(bridge) { favBridge = bridge; favListeners.forEach(fn => fn()); }
const currentFavs = () => favBridge?.list() ?? readFavs();

export function useFavorites() {
  const [favs, setFavs] = React.useState(currentFavs);
  React.useEffect(() => {
    const sync = () => setFavs(currentFavs());
    favListeners.add(sync);
    const offBridge = favBridge?.subscribe(sync);
    const onStorage = e => { if (e.key === FAV_KEY) sync(); };
    window.addEventListener('storage', onStorage);
    sync();
    return () => { favListeners.delete(sync); offBridge?.(); window.removeEventListener('storage', onStorage); };
  }, []);
  const save = next => { try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch {} favListeners.forEach(fn => fn()); };
  const isFav = name => favs.includes(name);
  const toggle = name => {
    if (!name || name === 'Indonesia') return;
    if (favBridge?.list()) { (currentFavs().includes(name) ? favBridge.remove(name) : favBridge.add(name)); return; }
    const cur = readFavs(); save(cur.includes(name) ? cur.filter(x => x !== name) : [...cur, name]);
  };
  const remove = name => { if (favBridge?.list()) favBridge.remove(name); else save(readFavs().filter(x => x !== name)); };
  return { favs, isFav, toggle, remove };
}


export function downloadCsv(filename, header, rows) {
  const esc = v => { const s = v == null ? '' : String(v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = '﻿' + [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}
export const slug = s => String(s).toLocaleLowerCase('id-ID').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
