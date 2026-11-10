// with an approximate centre coordinate from OpenStreetMap Nominatim (© OpenStreetMap contributors).
// Run occasionally: `node scripts/build-regencies.mjs`. Respects Nominatim's 1 request/second policy.
import { writeFile, readFile } from 'node:fs/promises';

const B = 'https://www.bi.go.id/hargapangan/WebSite/TabelHarga/';
const H = { 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'Mozilla/5.0 PANGAN-PAS data build' };
const OUT = new URL('../api/_regencies.json', import.meta.url);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pihps = async p => { for (let i = 0; i < 3; i++) { try { const r = await fetch(B + p, { headers: H }); if (r.ok) return (await r.json()).data || []; } catch {} await sleep(800); } throw new Error('PIHPS gagal: ' + p); };

let previous = {};
try { for (const r of JSON.parse(await readFile(OUT, 'utf8')).regencies) previous[r.id] = r; } catch {}

const provinces = await pihps('GetRefProvince');
const map = new Map();
for (const prov of provinces) {
  for (const type of [1, 2]) {
    for (const reg of await pihps(`GetRefRegency?price_type_id=${type}&ref_prov_id=${prov.id}`)) {
      const cur = map.get(reg.id) || { id: reg.id, name: String(reg.name).trim(), provinceId: prov.id, province: String(prov.name).trim(), types: [] };
      if (!cur.types.includes(type)) cur.types.push(type);
      map.set(reg.id, cur);
    }
    await sleep(150);
  }
}

const list = [...map.values()].sort((a, b) => a.province.localeCompare(b.province) || a.name.localeCompare(b.name));
for (const r of list) {
  const old = previous[r.id];
  if (!process.argv.includes('--ulang') && old && old.name === r.name && old.lat != null) { r.lat = old.lat; r.lon = old.lon; continue; }
  const isKab = /^Kab\.\s*/i.test(r.name);
  const place = isKab ? r.name.replace(/^Kab\.\s*/i, 'Kabupaten ') : r.name.replace(/^Kota\s+/i, '');
  const params = { q: `${place}, ${r.province}, Indonesia`, format: 'jsonv2', limit: '1', countrycodes: 'id', featureType: isKab ? 'state' : 'settlement' };
  if (isKab) { delete params.featureType; }
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams(params)}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'PANGAN-PAS/1.0 (data build script)', 'Accept-Language': 'id' } });
    const [hit] = await res.json();
    if (hit) { r.lat = +(+hit.lat).toFixed(4); r.lon = +(+hit.lon).toFixed(4); }
  } catch {}
  if (r.lat == null) { r.lat = null; r.lon = null; console.warn('Tanpa koordinat:', r.name, r.province); }
  await sleep(1100);
}

const MANUAL = { 'Kota Sukabumi': [-6.9213, 106.927], 'Kota Mamuju': [-2.6749, 118.8885], 'Kota Gunung Sitoli': [1.2885, 97.6145], 'Kota Sibolga': [1.7403, 98.7792] };
for (const r of list) if (MANUAL[r.name]) { [r.lat, r.lon] = MANUAL[r.name]; r.manual = true; }

await writeFile(OUT, JSON.stringify({
  source: 'PIHPS Nasional – Bank Indonesia (daftar kota pantauan); koordinat perkiraan pusat kota © OpenStreetMap contributors',
  generatedAt: new Date().toISOString(),
  regencies: list,
}, null, 1));
console.log('Selesai:', list.length, 'kota/kabupaten');
