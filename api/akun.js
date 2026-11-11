const COOKIE_ACCESS = 'pp_access';
const COOKIE_REFRESH = 'pp_refresh';
const COOKIE_AGE = 60 * 60 * 24 * 14;
const COMMODITIES = ['Beras medium', 'Beras premium', 'Gula pasir', 'Minyak goreng', 'Telur ayam', 'Daging ayam ras', 'Daging sapi', 'Bawang merah', 'Bawang putih', 'Cabai merah', 'Cabai rawit merah', 'Jagung pipilan'];
const PROVINCES = ['Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Jambi', 'Sumatera Selatan', 'Bengkulu', 'Lampung', 'Kep. Bangka Belitung', 'Kep. Riau', 'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur', 'Banten', 'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara', 'Sulawesi Utara', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Tenggara', 'Gorontalo', 'Sulawesi Barat', 'Maluku', 'Maluku Utara', 'Papua Barat', 'Papua Barat Daya', 'Papua', 'Papua Tengah', 'Papua Pegunungan', 'Papua Selatan'];

class ApiError extends Error { constructor(status, message, field) { super(message); this.status = status; this.field = field; } }
const config = () => {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anon = process.env.SUPABASE_ANON_KEY || '';
  if (!url || !key || !anon) throw new ApiError(503, 'Supabase belum dikonfigurasi. Isi SUPABASE_URL, SUPABASE_ANON_KEY, dan SUPABASE_SERVICE_ROLE_KEY di Vercel.');
  return { url, key, anon };
};

function json(res, status, body, extra = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}
function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf('='); return [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
  }));
}
function cookieHeader(access, refresh, clear = false) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const flags = `; Path=/; HttpOnly; SameSite=Lax${secure}`;
  return [
    `${COOKIE_ACCESS}=${clear ? '' : encodeURIComponent(access || '')}${flags}; Max-Age=${clear ? 0 : COOKIE_AGE}`,
    `${COOKIE_REFRESH}=${clear ? '' : encodeURIComponent(refresh || '')}${flags}; Max-Age=${clear ? 0 : COOKIE_AGE}`,
  ];
}
async function supa(path, { method = 'GET', body, token, service = false, prefer } = {}) {
  const c = config();
  const headers = { apikey: service ? c.key : c.anon, Authorization: `Bearer ${token || (service ? c.key : c.anon)}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${c.url}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await response.text();
  let data; try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) {
    const msg = data?.msg || data?.message || data?.error_description || data?.error || data?.details || 'Operasi Supabase gagal.';
    const status = response.status === 409 ? 409 : response.status === 401 ? 401 : response.status >= 500 ? 502 : response.status;
    throw new ApiError(status, String(msg));
  }
  return data;
}
async function rest(table, params = '', options = {}) {
  return supa(`/rest/v1/${table}${params ? `?${params}` : ''}`, { service: true, ...options });
}
async function bodyOf(req) {
  if (req.body != null) return typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
  const chunks = []; let n = 0;
  for await (const chunk of req) { n += chunk.length; if (n > 4 * 1024 * 1024) throw new ApiError(413, 'Data terlalu besar.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new ApiError(400, 'Format JSON tidak valid.'); }
}
function cleanText(v, key, max, required = true) {
  const s = String(v || '').replace(/[\x00-\x1f\x7f]/g, '').trim();
  if (!s && required) throw new ApiError(422, `Kolom ${key} wajib diisi.`, key);
  if (s.length > max) throw new ApiError(422, `Kolom ${key} maksimal ${max} karakter.`, key);
  return s || null;
}
function username(v) {
  const s = String(v || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (!/^[a-z0-9][a-z0-9_.-]{1,28}[a-z0-9]$/.test(s) || s.includes('..')) throw new ApiError(422, 'Username 3–30 karakter, diawali dan diakhiri huruf/angka; boleh titik, - dan _.', 'username');
  return s;
}
function userView(row) {
  return { id: Number(row.id), nama: row.nama, username: row.username, email: row.email, tema: row.tema === 'gelap' ? 'dark' : 'light', notifikasiHarga: Boolean(row.notifikasi_harga), aksesLokasi: Boolean(row.akses_lokasi), punyaPassword: true, favorit: row.favorit || [] };
}
async function profileFor(uid) {
  const rows = await rest('pengguna', `auth_uid=eq.${encodeURIComponent(uid)}&select=*`);
  if (!rows?.[0]) throw new ApiError(401, 'Profil akun tidak ditemukan.');
  const fav = await rest('lokasi_favorit', `pengguna_id=eq.${rows[0].id}&select=provinsi&order=dibuat.asc`);
  return { ...rows[0], favorit: (fav || []).map(x => x.provinsi) };
}
async function session(req) {
  const ck = cookies(req); let access = ck[COOKIE_ACCESS], refresh = ck[COOKIE_REFRESH];
  if (!access && !refresh) return null;
  try {
    const auth = await supa('/auth/v1/user', { token: access });
    return { auth, access, refresh, profile: await profileFor(auth.id) };
  } catch (e) {
    if (!refresh) return null;
    const tokenData = await supa('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refresh } });
    const auth = await supa('/auth/v1/user', { token: tokenData.access_token });
    return { auth, access: tokenData.access_token, refresh: tokenData.refresh_token, profile: await profileFor(auth.id), refreshed: true };
  }
}
async function requireSession(req) { const s = await session(req); if (!s) throw new ApiError(401, 'Silakan masuk terlebih dahulu.'); return s; }
async function saveProfile(uid, values) {
  const result = await rest('pengguna', '', { method: 'POST', body: { auth_uid: uid, ...values }, prefer: 'resolution=merge-duplicates,return=representation' });
  return result?.[0];
}
async function getPublic(uid) { return userView(await profileFor(uid)); }

async function authEndpoint(req, url, res) {
  const action = url.searchParams.get('action') || 'me';
  if (req.method === 'GET' && action === 'me') {
    const s = await session(req);
    return json(res, 200, { ok: true, user: s ? userView(s.profile) : null }, s?.refreshed ? { 'Set-Cookie': cookieHeader(s.access, s.refresh) } : {});
  }
  if (req.method !== 'POST') throw new ApiError(405, 'Metode tidak didukung.');
  const input = await bodyOf(req);
  if (action === 'logout') return json(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader('', '', true) });
  if (action === 'register') {
    const nama = cleanText(input.nama, 'nama', 80);
    if (nama.length < 2) throw new ApiError(422, 'Nama minimal 2 karakter.', 'nama');
    const uname = username(input.username);
    const email = String(input.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190) throw new ApiError(422, 'Alamat email tidak valid.', 'email');
    const password = String(input.password || '');
    if (password.length < 8 || password.length > 72) throw new ApiError(422, 'Password harus 8–72 karakter.', 'password');
    if (password !== String(input.konfirmasi || '')) throw new ApiError(422, 'Konfirmasi password tidak sama.', 'konfirmasi');
    const exists = await rest('pengguna', `or=(username.eq.${encodeURIComponent(uname)},email.eq.${encodeURIComponent(email)})&select=id,username,email`);
    if (exists?.some(x => x.username === uname)) throw new ApiError(409, 'Username sudah dipakai.', 'username');
    if (exists?.some(x => x.email === email)) throw new ApiError(409, 'Email sudah terdaftar. Silakan masuk.', 'email');
    const auth = await supa('/auth/v1/signup', { method: 'POST', body: { email, password, data: { nama, username: uname } } });
    const uid = auth.user?.id;
    if (!uid) throw new ApiError(502, 'Supabase Auth tidak mengembalikan akun.');
    if (!auth.access_token) throw new ApiError(409, 'Matikan konfirmasi email di Supabase Auth agar akun langsung dapat masuk.');
    await saveProfile(uid, { nama, username: uname, email });
    return json(res, 201, { ok: true, user: await getPublic(uid) }, { 'Set-Cookie': cookieHeader(auth.access_token, auth.refresh_token) });
  }
  if (action === 'login') {
    const identitas = String(input.identitas || '').trim().toLowerCase();
    const email = identitas.includes('@') ? identitas : (await rest('pengguna', `username=eq.${encodeURIComponent(identitas)}&select=email`))?.[0]?.email;
    if (!email) throw new ApiError(401, 'Username/email atau password salah.');
    const auth = await supa('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password: String(input.password || '') } });
    return json(res, 200, { ok: true, user: await getPublic(auth.user.id) }, { 'Set-Cookie': cookieHeader(auth.access_token, auth.refresh_token) });
  }
  throw new ApiError(400, 'Aksi tidak dikenal.');
}

async function profileEndpoint(req, url, res) {
  if (req.method !== 'POST') throw new ApiError(405, 'Metode tidak didukung.');
  const s = await requireSession(req), input = await bodyOf(req), action = url.searchParams.get('action');
  const uid = s.auth.id, id = s.profile.id;
  if (action === 'update') {
    const nama = cleanText(input.nama, 'nama', 80); if (nama.length < 2) throw new ApiError(422, 'Nama minimal 2 karakter.', 'nama');
    const uname = username(input.username);
    const dup = await rest('pengguna', `username=eq.${encodeURIComponent(uname)}&id=neq.${id}&select=id`);
    if (dup?.length) throw new ApiError(409, 'Username sudah dipakai.', 'username');
    await rest('pengguna', `auth_uid=eq.${uid}`, { method: 'PATCH', body: { nama, username: uname }, prefer: 'return=minimal' });
  } else if (action === 'password') {
    const next = String(input.baru || ''); if (next.length < 8 || next.length > 72) throw new ApiError(422, 'Password harus 8–72 karakter.', 'baru');
    if (next !== String(input.konfirmasi || '')) throw new ApiError(422, 'Konfirmasi password tidak sama.', 'konfirmasi');
    if (input.lama) {
      try { await supa('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: s.auth.email, password: String(input.lama) } }); }
      catch { throw new ApiError(401, 'Password lama salah.', 'lama'); }
    }
    await supa('/auth/v1/user', { method: 'PUT', token: s.access, body: { password: next } });
  } else if (action === 'prefs') {
    const patch = {};
    if ('tema' in input) patch.tema = input.tema === 'dark' ? 'gelap' : 'terang';
    if ('notifikasiHarga' in input) patch.notifikasi_harga = Boolean(input.notifikasiHarga);
    if ('aksesLokasi' in input) patch.akses_lokasi = Boolean(input.aksesLokasi);
    if (Object.keys(patch).length) await rest('pengguna', `auth_uid=eq.${uid}`, { method: 'PATCH', body: patch, prefer: 'return=minimal' });
  } else if (action === 'favorit-tambah') {
    const provinsi = String(input.provinsi || ''); if (!PROVINCES.includes(provinsi)) throw new ApiError(422, 'Provinsi tidak dikenal.');
    const list = await rest('lokasi_favorit', `pengguna_id=eq.${id}&select=id`); if (list.length >= 38) throw new ApiError(422, 'Batas lokasi favorit tercapai.');
    await rest('lokasi_favorit', '', { method: 'POST', body: { pengguna_id: id, provinsi }, prefer: 'resolution=ignore-duplicates,return=minimal' });
  } else if (action === 'favorit-hapus') {
    const provinsi = String(input.provinsi || ''); if (!PROVINCES.includes(provinsi)) throw new ApiError(422, 'Provinsi tidak dikenal.');
    await rest('lokasi_favorit', `pengguna_id=eq.${id}&provinsi=eq.${encodeURIComponent(provinsi)}`, { method: 'DELETE' });
  } else if (action === 'favorit-gabung') {
    const list = Array.isArray(input.daftar) ? [...new Set(input.daftar.filter(p => PROVINCES.includes(p)))].slice(0, 38) : [];
    if (list.length) await rest('lokasi_favorit', '', { method: 'POST', body: list.map(provinsi => ({ pengguna_id: id, provinsi })), prefer: 'resolution=ignore-duplicates,return=minimal' });
  } else throw new ApiError(400, 'Aksi tidak dikenal.');
  return json(res, 200, { ok: true, user: await getPublic(uid) });
}

const dateIso = x => x ? new Date(x).toISOString() : null;
function ruleOut(r) { return { id: Number(r.id), komoditas: r.komoditas, wilayah: r.wilayah, jenisPasar: r.jenis_pasar, arah: r.arah, tipeBatas: r.tipe_batas, nilaiBatas: Number(r.nilai_batas), periode: r.periode, aktif: !!r.aktif, terakhirDicek: dateIso(r.terakhir_dicek), terakhirDikirim: dateIso(r.terakhir_dikirim), perluDicek: !!r.aktif && (!r.terakhir_dicek || Date.now() - Date.parse(r.terakhir_dicek) > 12 * 3600000) }; }
function notifOut(n) { return { id: Number(n.id), pantauanId: n.pantauan_id == null ? null : Number(n.pantauan_id), komoditas: n.komoditas, wilayah: n.wilayah, jenisPasar: n.jenis_pasar, hargaAwal: n.harga_awal, hargaAkhir: n.harga_akhir, persen: Number(n.persen), periode: n.periode, tanggalAwal: n.tanggal_awal, tanggalAkhir: n.tanggal_akhir, sumber: n.sumber, dibaca: !!n.dibaca, dibuat: dateIso(n.dibuat) }; }
async function pantauanEndpoint(req, url, res) {
  const s = await requireSession(req), uid = s.profile.id;
  if (req.method === 'GET') {
    const [rules, ns] = await Promise.all([rest('pantauan_harga', `pengguna_id=eq.${uid}&select=*&order=dibuat.desc&limit=100`), rest('notifikasi_harga', `pengguna_id=eq.${uid}&select=*&order=dibuat.desc&limit=30`)]);
    return json(res, 200, { ok: true, pantauan: rules.map(ruleOut), notifikasi: ns.map(notifOut), belumDibaca: ns.filter(n => !n.dibaca).length });
  }
  if (req.method !== 'POST') throw new ApiError(405, 'Metode tidak didukung.');
  const input = await bodyOf(req), action = url.searchParams.get('action');
  if (action === 'buat') {
    const count = await rest('pantauan_harga', `pengguna_id=eq.${uid}&select=id`); if (count.length >= 20) throw new ApiError(422, 'Maksimal 20 pantauan per akun.');
    const { komoditas, wilayah, jenisPasar = 'tradisional', arah = 'keduanya', tipeBatas = 'persen', nilaiBatas, periode = '7 hari' } = input; const n = Number(nilaiBatas);
    if (!COMMODITIES.includes(komoditas) || (wilayah !== 'Indonesia' && !PROVINCES.includes(wilayah))) throw new ApiError(422, 'Komoditas atau wilayah tidak dikenal.');
    if (!['tradisional', 'modern'].includes(jenisPasar) || !['naik', 'turun', 'keduanya'].includes(arah) || !['persen', 'nominal'].includes(tipeBatas) || !['7 hari', '14 hari', '30 hari'].includes(periode)) throw new ApiError(422, 'Pilihan pantauan tidak valid.');
    if (tipeBatas === 'persen' ? n < .5 || n > 100 : n < 50 || n > 1000000) throw new ApiError(422, 'Nilai batas tidak valid.');
    const rows = await rest('pantauan_harga', '', { method: 'POST', body: { pengguna_id: uid, komoditas, wilayah, jenis_pasar: jenisPasar, arah, tipe_batas: tipeBatas, nilai_batas: n, periode }, prefer: 'return=representation' });
    return json(res, 201, { ok: true, pantauan: ruleOut(rows[0]) });
  }
  const ruleId = Number(input.id); const rows = await rest('pantauan_harga', `id=eq.${ruleId}&pengguna_id=eq.${uid}&select=*`); if (!rows.length) throw new ApiError(404, 'Pantauan tidak ditemukan.');
  if (action === 'ubah') {
    const updated = await rest('pantauan_harga', `id=eq.${ruleId}&pengguna_id=eq.${uid}`, { method: 'PATCH', body: { aktif: !!input.aktif }, prefer: 'return=representation' });
    return json(res, 200, { ok: true, pantauan: ruleOut(updated[0] || { ...rows[0], aktif: !!input.aktif }) });
  }
  if (action === 'hapus') { await rest('pantauan_harga', `id=eq.${ruleId}&pengguna_id=eq.${uid}`, { method: 'DELETE' }); return json(res, 200, { ok: true }); }
  if (action === 'lapor') {
    const rule = rows[0], now = new Date().toISOString(); await rest('pantauan_harga', `id=eq.${ruleId}&pengguna_id=eq.${uid}`, { method: 'PATCH', body: { terakhir_dicek: now }, prefer: 'return=minimal' });
    const alert = input.peringatan; let sent = null;
    if (alert && s.profile.notifikasi_harga && rule.aktif && (!rule.terakhir_dikirim || Date.now() - Date.parse(rule.terakhir_dikirim) > 12 * 3600000) && alert.tanggalAkhir !== rule.tanggal_data_terkirim) {
      const a = Number(alert.hargaAwal), b = Number(alert.hargaAkhir); if (a > 0 && b > 0 && /^\d{4}-\d{2}-\d{2}$/.test(alert.tanggalAwal) && /^\d{4}-\d{2}-\d{2}$/.test(alert.tanggalAkhir)) {
        const created = await rest('notifikasi_harga', '', { method: 'POST', body: { pengguna_id: uid, pantauan_id: ruleId, komoditas: rule.komoditas, wilayah: rule.wilayah, jenis_pasar: rule.jenis_pasar, harga_awal: a, harga_akhir: b, persen: Math.round(((b - a) / a) * 10000) / 100, periode: rule.periode, tanggal_awal: alert.tanggalAwal, tanggal_akhir: alert.tanggalAkhir }, prefer: 'return=representation' });
        await rest('pantauan_harga', `id=eq.${ruleId}`, { method: 'PATCH', body: { terakhir_dikirim: now, tanggal_data_terkirim: alert.tanggalAkhir } }); sent = notifOut(created[0]);
      }
    }
    return json(res, 200, { ok: true, terkirim: sent });
  }
  if (action === 'baca') { await rest('notifikasi_harga', `pengguna_id=eq.${uid}${input.semua ? '' : `&id=eq.${Number(input.id)}`}`, { method: 'PATCH', body: { dibaca: true } }); return json(res, 200, { ok: true }); }
  throw new ApiError(400, 'Aksi tidak dikenal.');
}

async function uploadProof(dataUrl) {
  if (!dataUrl) return null;
  const match = String(dataUrl).match(/^data:image\/(jpeg|png|webp);base64,([\w+/=]+)$/); if (!match) throw new ApiError(422, 'Foto harus berupa JPG, PNG, atau WebP.');
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1], bin = Buffer.from(match[2], 'base64'); if (bin.length > 2 * 1024 * 1024) throw new ApiError(422, 'Foto maksimal 2 MB.');
  const { url, key } = config(), path = `${new Date().toISOString().slice(0, 7).replace('-', '/')}/${crypto.randomUUID()}.${ext}`;
  const response = await fetch(`${url}/storage/v1/object/community/${path}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': `image/${match[1]}`, 'x-upsert': 'false' }, body: bin });
  if (!response.ok) throw new ApiError(502, 'Foto gagal disimpan ke Supabase Storage.');
  return path;
}
async function communityEndpoint(req, url, res, kind) {
  if (kind === 'kiriman' && req.method === 'GET') {
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 50)));
    const rows = await rest('kiriman_harga', `status_verifikasi=neq.ditolak&select=*&order=waktu_kirim.desc&limit=${limit}`);
    const ids = rows.map(r => r.id); let cs = [], bs = [];
    if (ids.length) { cs = await rest('komentar', `kiriman_id=in.(${ids.join(',')})&select=*&order=waktu_kirim.asc`); if (cs.length) bs = await rest('balasan', `komentar_id=in.(${cs.map(c => c.id).join(',')})&select=*&order=waktu_kirim.asc`); }
    const { url: base } = config();
    const items = rows.map(r => ({ id: String(r.id), name: r.nama_kontributor, commodity: r.komoditas, price: r.harga, unit: r.satuan, seller: r.jenis_tempat, marketName: r.nama_pasar_toko, region: r.provinsi, date: r.tanggal_pengamatan, notes: r.catatan, proof: r.foto_path ? `${base}/storage/v1/object/public/community/${r.foto_path}` : null, status: r.status_verifikasi, createdAt: dateIso(r.waktu_kirim), ownerId: r.pengguna_id == null ? null : Number(r.pengguna_id), comments: cs.filter(c => c.kiriman_id === r.id).map(c => ({ id: String(c.id), author: c.nama, text: c.isi, createdAt: dateIso(c.waktu_kirim), replies: bs.filter(b => b.komentar_id === c.id).map(b => ({ id: String(b.id), author: b.nama, text: b.isi, createdAt: dateIso(b.waktu_kirim) })) })) }));
    return json(res, 200, { ok: true, items });
  }
  const s = await requireSession(req), uid = s.profile.id, author = String(s.profile.nama).slice(0, 48);
  if (kind === 'kiriman' && req.method === 'POST') {
    const input = await bodyOf(req), commodity = cleanText(input.commodity, 'commodity', 60), seller = cleanText(input.seller, 'seller', 20);
    if (!['Pasar tradisional', 'Supermarket'].includes(seller)) throw new ApiError(422, 'Jenis tempat tidak valid.');
    const price = Number(input.price), date = String(input.date || ''); if (!Number.isInteger(price) || price < 500 || price > 100000000) throw new ApiError(422, 'Harga minimal Rp500.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || Date.parse(`${date}T00:00:00`) > Date.now() + 86400000) throw new ApiError(422, 'Tanggal pengamatan tidak valid.');
    const photo = await uploadProof(input.proof); const rows = await rest('kiriman_harga', '', { method: 'POST', body: { pengguna_id: uid, nama_kontributor: author, komoditas: commodity, harga: price, satuan: cleanText(input.unit, 'unit', 16), jenis_tempat: seller, nama_pasar_toko: cleanText(input.marketName, 'marketName', 80), provinsi: cleanText(input.region, 'region', 60), tanggal_pengamatan: date, catatan: cleanText(input.notes, 'notes', 240, false), foto_path: photo }, prefer: 'return=representation' });
    return json(res, 201, { ok: true, id: String(rows[0].id), status: 'belum_diverifikasi' });
  }
  if (kind === 'kiriman' && req.method === 'DELETE') {
    const id = Number(url.searchParams.get('id')); const rows = await rest('kiriman_harga', `id=eq.${id}&pengguna_id=eq.${uid}&select=id,foto_path`); if (!rows.length) throw new ApiError(403, 'Kiriman tidak ditemukan atau bukan milik Anda.');
    await rest('kiriman_harga', `id=eq.${id}&pengguna_id=eq.${uid}`, { method: 'DELETE' });
    if (rows[0].foto_path) { const { url: base, key } = config(); await fetch(`${base}/storage/v1/object/community/${rows[0].foto_path}`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } }); }
    return json(res, 200, { ok: true });
  }
  if (kind === 'komentar' && req.method === 'POST') {
    const input = await bodyOf(req), isi = cleanText(input.text, 'text', 240);
    if (input.reply) {
      const commentId = Number(input.komentar_id), found = await rest('komentar', `id=eq.${commentId}&select=id`); if (!found.length) throw new ApiError(404, 'Komentar tidak ditemukan.');
      const rows = await rest('balasan', '', { method: 'POST', body: { komentar_id: commentId, pengguna_id: uid, nama: author, isi }, prefer: 'return=representation' }); return json(res, 201, { ok: true, id: String(rows[0].id) });
    }
    const postId = Number(input.kiriman_id), found = await rest('kiriman_harga', `id=eq.${postId}&select=id`); if (!found.length) throw new ApiError(404, 'Kiriman tidak ditemukan.');
    const rows = await rest('komentar', '', { method: 'POST', body: { kiriman_id: postId, pengguna_id: uid, nama: author, isi }, prefer: 'return=representation' }); return json(res, 201, { ok: true, id: String(rows[0].id) });
  }
  throw new ApiError(405, 'Metode tidak didukung.');
}

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const ep = url.pathname.match(/\/api\/akun\/([a-z-]+)\/?$/)?.[1] || url.searchParams.get('ep') || '';
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) throw new ApiError(405, 'Metode tidak didukung.');
    if (req.method !== 'GET' && req.headers['x-pangan-request'] !== '1') throw new ApiError(403, 'Permintaan ditolak.');
    if (ep === 'auth') return await authEndpoint(req, url, res);
    if (ep === 'profil') return await profileEndpoint(req, url, res);
    if (ep === 'pantauan') return await pantauanEndpoint(req, url, res);
    if (ep === 'kiriman') return await communityEndpoint(req, url, res, 'kiriman');
    if (ep === 'komentar') return await communityEndpoint(req, url, res, 'komentar');
    throw new ApiError(404, 'Endpoint akun tidak dikenal.');
  } catch (e) {
    if (e.status) return json(res, e.status, { ok: false, error: e.message, ...(e.field ? { field: e.field } : {}), ...(e.status === 503 ? { notConfigured: true } : {}) });
    console.error('[pangan-pas supabase]', e);
    return json(res, 502, { ok: false, error: 'Server Supabase tidak dapat dihubungi.' });
  }
};
module.exports.config = { maxDuration: 20, api: { bodyParser: { sizeLimit: '4mb' } } };
