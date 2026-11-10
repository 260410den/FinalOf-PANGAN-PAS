import React from 'react';
import { fetchPrices, statOf, setFavoriteBridge } from './priceData.js';
import { regencies } from '../api/_regencies.json';

const API = '/api/akun';
let state = { status: 'loading', user: null, configured: true, error: null };
const listeners = new Set();
const emit = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn(state)); };
export const getAccount = () => state;

async function call(endpoint, { action, method = 'GET', body } = {}) {
  const qs = action ? `?action=${encodeURIComponent(action)}` : '';
  let res;
  try {
    res = await fetch(`${API}/${endpoint}${qs}`, {
      method,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(method === 'POST' ? { 'Content-Type': 'application/json', 'X-Pangan-Request': '1' } : {}) },
      body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
    });
  } catch {
    throw Object.assign(new Error('Server akun tidak dapat dihubungi. Periksa koneksi Anda.'), { network: true });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    const err = new Error(data?.error || `Server akun bermasalah (HTTP ${res.status}).`);
    err.status = res.status; err.field = data?.field; err.notConfigured = Boolean(data?.notConfigured);
    throw err;
  }
  return data;
}

const setUser = user => { emit({ user, status: 'ready', error: null }); return user; };

export async function loadAccount() {
  try {
    const data = await call('auth', { action: 'me' });
    emit({ status: 'ready', user: data.user, configured: true, error: null });
  } catch (e) {
    emit({ status: 'ready', user: null, configured: !e.notConfigured, error: e.notConfigured ? null : e.message });
  }
  return state;
}

const LOCAL_FAV_KEY = 'pangan-pas-favorit-provinsi-v1';
async function mergeLocalFavorites() {
  let local = [];
  try { local = JSON.parse(localStorage.getItem(LOCAL_FAV_KEY) || '[]'); } catch {}
  if (!Array.isArray(local) || !local.length) return;
  try {
    const data = await call('profil', { action: 'favorit-gabung', method: 'POST', body: { daftar: local } });
    setUser(data.user);
    localStorage.removeItem(LOCAL_FAV_KEY);
  } catch {}
}

export async function register(form) {
  const data = await call('auth', { action: 'register', method: 'POST', body: form });
  setUser(data.user);
  await mergeLocalFavorites();
  return state.user;
}
export async function login(identitas, password) {
  const data = await call('auth', { action: 'login', method: 'POST', body: { identitas, password } });
  setUser(data.user);
  await mergeLocalFavorites();
  return state.user;
}
export async function logout() {
  try { await call('auth', { action: 'logout', method: 'POST' }); } finally { emit({ user: null }); }
}

export const updateProfile = async (nama, username) => setUser((await call('profil', { action: 'update', method: 'POST', body: { nama, username } })).user);
export const changePassword = async (lama, baru, konfirmasi) => setUser((await call('profil', { action: 'password', method: 'POST', body: { lama, baru, konfirmasi } })).user);
export const savePrefs = async prefs => setUser((await call('profil', { action: 'prefs', method: 'POST', body: prefs })).user);
export const addFavorite = async provinsi => setUser((await call('profil', { action: 'favorit-tambah', method: 'POST', body: { provinsi } })).user);
export const removeFavorite = async provinsi => setUser((await call('profil', { action: 'favorit-hapus', method: 'POST', body: { provinsi } })).user);

export function useAccount() {
  const [s, setS] = React.useState(state);
  React.useEffect(() => { listeners.add(setS); setS(state); return () => listeners.delete(setS); }, []);
  return s;
}
export const subscribeAccount = fn => { listeners.add(fn); return () => listeners.delete(fn); };

setFavoriteBridge({
  list: () => state.user?.favorit ?? null,
  add: name => addFavorite(name).catch(() => {}),
  remove: name => removeFavorite(name).catch(() => {}),
  subscribe: fn => subscribeAccount(() => fn()),
});

export const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';


export const watches = {
  list: () => call('pantauan'),
  create: rule => call('pantauan', { action: 'buat', method: 'POST', body: rule }),
  setActive: (id, aktif) => call('pantauan', { action: 'ubah', method: 'POST', body: { id, aktif } }),
  remove: id => call('pantauan', { action: 'hapus', method: 'POST', body: { id } }),
  report: (id, peringatan) => call('pantauan', { action: 'lapor', method: 'POST', body: { id, peringatan } }),
  markRead: (opts) => call('pantauan', { action: 'baca', method: 'POST', body: opts }),
};
const inboxListeners = new Set();
let inbox = { notifikasi: [], belumDibaca: 0, pantauan: [] };
const emitInbox = next => { inbox = next; inboxListeners.forEach(fn => fn(inbox)); };
export async function refreshInbox() {
  try { const d = await watches.list(); emitInbox({ notifikasi: d.notifikasi, belumDibaca: d.belumDibaca, pantauan: d.pantauan }); } catch {}
  return inbox;
}
export function useInbox() {
  const [s, setS] = React.useState(inbox);
  React.useEffect(() => { inboxListeners.add(setS); setS(inbox); return () => inboxListeners.delete(setS); }, []);
  return s;
}

export const STALE_DAYS = 5; // PIHPS skips weekends/holidays; older than this is treated as outdated
const daysAgo = iso => (Date.now() - new Date(`${iso}T12:00:00+07:00`).getTime()) / 86400000;

export function evaluateRule(rule, data) {
  const st = statOf(data, rule.komoditas, rule.wilayah);
  if (!st || st.points.length < 2 || !st.firstPrice || st.firstDate === st.date) return { skip: 'Data belum cukup untuk dibandingkan.' };
  if (daysAgo(st.date) > STALE_DAYS) return { skip: 'Data sumber sudah kedaluwarsa.' };
  const diff = st.price - st.firstPrice;
  const pct = (diff / st.firstPrice) * 100;
  const dirOk = rule.arah === 'keduanya' || (rule.arah === 'naik' ? diff > 0 : diff < 0);
  const size = rule.tipeBatas === 'persen' ? Math.abs(pct) : Math.abs(diff);
  if (!dirOk || size < rule.nilaiBatas) return { skip: 'Belum melewati batas.' };
  return { alert: { hargaAwal: st.firstPrice, hargaAkhir: st.price, persen: Math.round(pct * 100) / 100, tanggalAwal: st.firstDate, tanggalAkhir: st.date } };
}

export const trendUrl = n => `/tren?${new URLSearchParams({ komoditas: n.komoditas, wilayah: n.wilayah, jenis: n.jenisPasar, periode: n.periode })}`;

function showSystemNotification(n) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const rp = v => `Rp${Number(v).toLocaleString('id-ID')}`;
  const arah = n.hargaAkhir > n.hargaAwal ? 'naik' : 'turun';
  try {
    const notif = new Notification(`${n.komoditas} ${arah} ${Math.abs(n.persen).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% · ${n.wilayah}`, {
      body: `${rp(n.hargaAwal)} → ${rp(n.hargaAkhir)} (${n.periode}, ${n.tanggalAwal} s.d. ${n.tanggalAkhir}). Sumber: ${n.sumber}.`,
      tag: `pantauan-${n.pantauanId}`,
      icon: '/pangan-mascot.png',
    });
    notif.onclick = () => { window.focus(); location.href = trendUrl(n); };
  } catch {}
}

let checking = false;
export async function checkWatches() {
  const u = state.user;
  if (checking || !u || !u.notifikasiHarga || document.visibilityState === 'hidden') return;
  checking = true;
  try {
    const d = await watches.list();
    emitInbox({ notifikasi: d.notifikasi, belumDibaca: d.belumDibaca, pantauan: d.pantauan });
    const due = d.pantauan.filter(r => r.perluDicek);
    let sent = false;
    for (const rule of due) {
      let data = null;
      try { data = await fetchPrices(rule.jenisPasar, rule.periode); } catch { continue; } // source down: try again later, nothing recorded
      const res = evaluateRule(rule, data);
      try {
        const out = await watches.report(rule.id, res.alert || null);
        if (out.terkirim) { sent = true; showSystemNotification(out.terkirim); }
      } catch {}
    }
    if (sent) await refreshInbox();
  } catch {} finally { checking = false; }
}


export const PROVINCE_ALIASES = { 'Kepulauan Riau': 'Kep. Riau', 'Kepulauan Bangka Belitung': 'Kep. Bangka Belitung' };
export const appProvince = name => PROVINCE_ALIASES[name] || name;
export const CITIES = regencies.filter(r => r.lat != null).map(r => ({ ...r, province: appProvince(r.province) }));

export function haversineKm(a, b) {
  const R = 6371, rad = x => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function locateOnce() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Browser ini tidak mendukung lokasi. Pilih wilayah secara manual.'));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      e => reject(new Error(e.code === 1 ? 'Izin lokasi ditolak. Pilih wilayah secara manual.' : 'Lokasi tidak dapat ditentukan. Pilih wilayah secara manual.')),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    );
  });
}
export function nearestCity(pos) {
  let best = null;
  for (const c of CITIES) { const d = haversineKm(pos, c); if (!best || d < best.km) best = { city: c, km: d }; }
  return best;
}

export async function fetchCityPrices(jenis, komoditas, cityIds) {
  const url = `/api/daerah?${new URLSearchParams({ jenis, komoditas, kota: cityIds.join(',') })}`;
  const r = await fetch(url);
  const body = await r.json().catch(() => null);
  if (!r.ok || !body?.ok) throw new Error(body?.error || 'Sumber harga PIHPS tidak dapat dihubungi saat ini.');
  return body;
}

export const COMMODITY_NAMES = ['Beras medium', 'Beras premium', 'Gula pasir', 'Minyak goreng', 'Telur ayam', 'Daging ayam ras',
  'Daging sapi', 'Bawang merah', 'Bawang putih', 'Cabai merah', 'Cabai rawit merah', 'Jagung pipilan'];
export const PROVINCE_NAMES = ['Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Jambi', 'Sumatera Selatan', 'Bengkulu', 'Lampung',
  'Kep. Bangka Belitung', 'Kep. Riau', 'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur', 'Banten', 'Bali',
  'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur',
  'Kalimantan Utara', 'Sulawesi Utara', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Tenggara', 'Gorontalo', 'Sulawesi Barat',
  'Maluku', 'Maluku Utara', 'Papua Barat', 'Papua Barat Daya', 'Papua', 'Papua Tengah', 'Papua Pegunungan', 'Papua Selatan'];


export const GUEST_LIMIT = 3;
const QUOTA_KEY = 'pangan-pas-akses-tamu-v1';
const readQuota = () => { try { const v = JSON.parse(localStorage.getItem(QUOTA_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
export const guestUsed = feature => Number(readQuota()[feature] || 0);
export function spendGuestCredit(feature) {
  const q = readQuota();
  q[feature] = Number(q[feature] || 0) + 1;
  try { localStorage.setItem(QUOTA_KEY, JSON.stringify(q)); } catch {}
  return q[feature];
}
export const GUEST_FEATURES = { peta: 'Peta harga', tren: 'Tren harga', sekitar: 'Cari di sekitar' };
