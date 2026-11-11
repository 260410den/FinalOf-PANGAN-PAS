import React from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, LogIn, LogOut, UserPlus, UserRound, Bell, MapPin, LocateFixed, Trash2, Star, Info, ExternalLink, ShieldCheck, ArrowRight, Moon, Sun, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import * as account from './account.js';
import { useAccount, useInbox, initials, COMMODITY_NAMES, PROVINCE_NAMES, CITIES } from './account.js';
import { formatDateLong, formatTimestamp, NO_DATA } from './priceData.js';

const rp = v => (v == null ? NO_DATA : `Rp${Number(v).toLocaleString('id-ID')}`);
const qp = name => new URLSearchParams(location.search).get(name);
const returnPath = () => { const r = qp('kembali'); return r && /^\/[A-Za-z0-9/_\-?=&.%]*$/.test(r) && !r.startsWith('//') ? r : '/profil'; };
const go = path => { location.href = path; };

const LOGIN_ERRORS = {
  'server-akun-belum-diatur': 'Server akun belum dikonfigurasi.',
  server: 'Server akun sedang bermasalah.',
};


export function Avatar({ user, size = 40 }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  return <span className="avatar avatar-initials" style={style} aria-hidden="true">{initials(user?.nama)}</span>;
}

export function NavAccount() {
  const s = useAccount();
  const inbox = useInbox();
  if (s.status === 'loading') return <span className="nav-account-placeholder" aria-hidden="true"><UserRound size={18} /></span>;
  const here = ['/masuk', '/daftar'].includes(location.pathname) ? '' : `?kembali=${encodeURIComponent(location.pathname + location.search)}`;
  if (!s.user) return <a className="nav-account-login" href={`/masuk${here}`} title="Masuk atau daftar"><LogIn size={17} /><span>Masuk</span></a>;
  return <a className="nav-account" href="/profil" title={`Profil ${s.user.nama}`} aria-label={`Profil ${s.user.nama}${inbox.belumDibaca ? `, ${inbox.belumDibaca} notifikasi baru` : ''}`}>
    <Avatar user={s.user} size={38} />
    {inbox.belumDibaca > 0 && <span className="nav-badge">{inbox.belumDibaca > 9 ? '9+' : inbox.belumDibaca}</span>}
  </a>;
}

function Field({ label, error, hint, children }) {
  return <label className={`field${error ? ' has-error' : ''}`}><span className="field-label">{label}</span>{children}{error ? <small className="field-error">{error}</small> : hint ? <small className="field-hint">{hint}</small> : null}</label>;
}
function PasswordInput({ value, onChange, autoComplete, id, onBlur }) {
  const [show, setShow] = React.useState(false);
  return <span className="password-input"><input id={id} type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur} autoComplete={autoComplete} required maxLength={72} />
    <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>;
}
export function Switch({ checked, onChange, label, description, disabled }) {
  return <div className="switch-row">
    <div><b>{label}</b>{description && <p>{description}</p>}</div>
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`switch${checked ? ' on' : ''}`} onClick={() => onChange(!checked)}>
      <motion.span className="switch-knob" animate={{ x: checked ? 20 : 0 }} transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }} />
    </button>
  </div>;
}
function Alert({ tone = 'info', children }) {
  return <p className={`form-alert ${tone}`} role={tone === 'error' ? 'alert' : 'status'}><Info size={16} /> <span>{children}</span></p>;
}
function AuthCard({ title, sub, children, foot }) {
  return <motion.section className="auth-card" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
    <div className="auth-head"><span className="auth-mark"><ShieldCheck size={22} /></span><h1>{title}</h1><p>{sub}</p></div>
    {children}
    {foot && <p className="auth-foot">{foot}</p>}
  </motion.section>;
}
const NotConfigured = () => <Alert tone="error">Server akun belum dikonfigurasi. Isi <code>SUPABASE_URL</code>, <code>SUPABASE_ANON_KEY</code>, dan <code>SUPABASE_SERVICE_ROLE_KEY</code> di Environment Variables Vercel.</Alert>;


export function LoginPage() {
  const s = useAccount();
  const [identitas, setId] = React.useState('');
  const [password, setPw] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(LOGIN_ERRORS[qp('galat')] || '');
  React.useEffect(() => { if (s.user) go(returnPath()); }, [s.user]);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try { await account.login(identitas.trim(), password); go(returnPath()); }
    catch (err) { setError(err.message); setPw(''); } finally { setBusy(false); }
  };
  return <AuthCard title="Masuk ke PANGAN PAS" sub="Simpan lokasi favorit, atur pantauan harga, dan sinkronkan preferensi di semua perangkat."
    foot={<>Belum punya akun? <a href={`/daftar${location.search}`}>Daftar sekarang</a></>}>
    {!s.configured && <NotConfigured />}
    {error && <Alert tone="error">{error}</Alert>}
    <form className="auth-form" onSubmit={submit} noValidate>
      <Field label="Username atau email"><input value={identitas} onChange={e => setId(e.target.value)} autoComplete="username" required maxLength={190} /></Field>
      <Field label="Password"><PasswordInput value={password} onChange={setPw} autoComplete="current-password" /></Field>
      <button className="btn-primary" type="submit" disabled={busy || !s.configured || !identitas || !password}><LogIn size={17} /> {busy ? 'Memproses…' : 'Masuk'}</button>
    </form>
  </AuthCard>;
}


const USERNAME_RE = /^(?!.*\.\.)[a-z0-9][a-z0-9_.-]{1,28}[a-z0-9]$/;
function validateRegister(f) {
  const e = {};
  if (f.nama.trim().length < 2) e.nama = 'Nama minimal 2 karakter.';
  if (f.username.length < 3) e.username = 'Username minimal 3 karakter.';
  else if (!USERNAME_RE.test(f.username)) e.username = 'Username harus diawali dan diakhiri huruf/angka, tanpa dua titik berurutan.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Alamat email tidak valid, contoh: nama@gmail.com';
  if (f.password.length < 8) e.password = 'Password minimal 8 karakter.';
  if (f.konfirmasi !== f.password) e.konfirmasi = 'Konfirmasi password belum sama dengan password.';
  return e;
}
const FIELD_ORDER = ['nama', 'username', 'email', 'password', 'konfirmasi'];
const FIELD_LABEL = { nama: 'Nama', username: 'Username', email: 'Email', password: 'Password', konfirmasi: 'Konfirmasi password' };
const cleanUsername = v => v.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/g, '').slice(0, 30);

export function RegisterPage() {
  const s = useAccount();
  const [f, setF] = React.useState({ nama: '', username: '', email: '', password: '', konfirmasi: '' });
  const [blurred, setBlurred] = React.useState({});
  const [submitted, setSubmitted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [serverField, setServerField] = React.useState({});
  React.useEffect(() => { if (s.user) go(returnPath()); }, [s.user]);
  const all = validateRegister(f);
  const errs = { ...Object.fromEntries(Object.entries(all).filter(([k]) => submitted || blurred[k])), ...Object.fromEntries(Object.entries(serverField).filter(([, v]) => v)) };
  const set = k => v => { setF(x => ({ ...x, [k]: k === 'username' ? cleanUsername(v) : v })); setServerField(x => ({ ...x, [k]: undefined })); setError(''); setNotice(''); };
  const blur = k => () => setBlurred(b => ({ ...b, [k]: true }));
  const focusField = k => { const el = document.getElementById(`reg-${k}`); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); el?.focus({ preventScroll: true }); };
  const submit = async e => {
    e.preventDefault(); setSubmitted(true); setError('');
    const problems = FIELD_ORDER.filter(k => all[k]);
    if (problems.length) {
      setError(`Periksa kembali: ${problems.map(k => FIELD_LABEL[k]).join(', ')}.`);
      focusField(problems[0]);
      return;
    }
    setBusy(true);
    try {
      const result = await account.register({ ...f, nama: f.nama.trim(), email: f.email.trim() });
      if (result?.confirmationRequired) {
        setNotice(`Akun dibuat. Buka tautan konfirmasi yang dikirim ke ${result.email}, lalu masuk.`);
        return;
      }
      go(returnPath());
    }
    catch (err) {
      if (err.field) { setServerField({ [err.field]: err.message }); setError(err.message); focusField(err.field); }
      else setError(err.message);
    }
    finally { setBusy(false); }
  };
  const pwChecks = [[f.password.length >= 8, 'Minimal 8 karakter'], [f.konfirmasi.length > 0 && f.konfirmasi === f.password, 'Konfirmasi sama']];
  return <AuthCard title="Buat akun" sub="Simpan lokasi favorit, pantauan harga, dan temuan komunitas."
    foot={<>Sudah punya akun? <a href={`/masuk${location.search}`}>Masuk</a></>}>
    {!s.configured && <NotConfigured />}
    {error && <Alert tone="error">{error}</Alert>}
    {notice && <Alert>{notice}</Alert>}
    <form className="auth-form" onSubmit={submit} noValidate>
      <Field label="Nama lengkap" error={errs.nama}><input id="reg-nama" value={f.nama} onChange={e => set('nama')(e.target.value)} onBlur={blur('nama')} autoComplete="name" required maxLength={80} placeholder="Contoh: Siti Aminah" /></Field>
      <Field label="Username" error={errs.username} hint="Spasi otomatis jadi _, huruf otomatis kecil. Boleh huruf, angka, titik, - dan _."><input id="reg-username" value={f.username} onChange={e => set('username')(e.target.value)} onBlur={blur('username')} autoComplete="username" autoCapitalize="none" spellCheck="false" required maxLength={30} placeholder="contoh: siti_aminah" /></Field>
      <Field label="Email" error={errs.email}><input id="reg-email" type="email" value={f.email} onChange={e => set('email')(e.target.value)} onBlur={blur('email')} autoComplete="email" autoCapitalize="none" required maxLength={190} placeholder="nama@gmail.com" /></Field>
      <div className="field-pair">
        <Field label="Password" error={errs.password}><PasswordInput id="reg-password" value={f.password} onChange={set('password')} onBlur={blur('password')} autoComplete="new-password" /></Field>
        <Field label="Konfirmasi password" error={errs.konfirmasi}><PasswordInput id="reg-konfirmasi" value={f.konfirmasi} onChange={set('konfirmasi')} onBlur={blur('konfirmasi')} autoComplete="new-password" /></Field>
      </div>
      <ul className="pw-checks" aria-label="Syarat password">{pwChecks.map(([ok, label]) => <li key={label} className={ok ? 'ok' : ''}>{ok ? '✓' : '•'} {label}</li>)}</ul>
      <button className="btn-primary" type="submit" disabled={busy || !s.configured}><UserPlus size={17} /> {busy ? 'Mendaftarkan…' : 'Daftar dan masuk'}</button>
    </form>
  </AuthCard>;
}


function Section({ title, icon: Icon, children, id, sub }) {
  return <section className="profile-section" id={id}><div className="profile-section-head"><span><Icon size={18} /></span><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div></div>{children}</section>;
}
function useStatus() {
  const [msg, setMsg] = React.useState(null);
  const run = async (fn, ok) => { setMsg(null); try { await fn(); setMsg({ tone: 'ok', text: ok }); } catch (e) { setMsg({ tone: 'error', text: e.message }); } };
  return [msg, run];
}

function ProfileForm({ user }) {
  const [nama, setNama] = React.useState(user.nama);
  const [username, setUsername] = React.useState(user.username);
  const [msg, run] = useStatus();
  const dirty = nama.trim() !== user.nama || username !== user.username;
  return <form className="auth-form" onSubmit={e => { e.preventDefault(); run(() => account.updateProfile(nama.trim(), username), 'Profil disimpan.'); }}>
    <div className="field-pair">
      <Field label="Nama"><input value={nama} onChange={e => setNama(e.target.value)} maxLength={80} required /></Field>
      <Field label="Username"><input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} maxLength={30} required /></Field>
    </div>
    <Field label="Email" hint="Email tidak dapat diubah."><input value={user.email} disabled /></Field>
    {msg && <Alert tone={msg.tone === 'ok' ? 'ok' : 'error'}>{msg.text}</Alert>}
    <button className="btn-primary" type="submit" disabled={!dirty}>Simpan profil</button>
  </form>;
}

function PasswordForm({ user }) {
  const [lama, setLama] = React.useState('');
  const [baru, setBaru] = React.useState('');
  const [konf, setKonf] = React.useState('');
  const [msg, run] = useStatus();
  const submit = e => {
    e.preventDefault();
    run(async () => { await account.changePassword(lama, baru, konf); setLama(''); setBaru(''); setKonf(''); }, user.punyaPassword ? 'Password diperbarui.' : 'Password dibuat. Anda kini juga bisa masuk dengan username/email.');
  };
  return <form className="auth-form" onSubmit={submit}>
    {user.punyaPassword && <Field label="Password lama"><PasswordInput value={lama} onChange={setLama} autoComplete="current-password" /></Field>}
    <div className="field-pair">
      <Field label="Password baru" hint="Minimal 8 karakter."><PasswordInput value={baru} onChange={setBaru} autoComplete="new-password" /></Field>
      <Field label="Konfirmasi password baru"><PasswordInput value={konf} onChange={setKonf} autoComplete="new-password" /></Field>
    </div>
    {msg && <Alert tone={msg.tone === 'ok' ? 'ok' : 'error'}>{msg.text}</Alert>}
    <button className="btn-secondary" type="submit" disabled={!baru || !konf || (user.punyaPassword && !lama)}>{user.punyaPassword ? 'Ubah password' : 'Buat password'}</button>
  </form>;
}

function FavoritesManager({ user }) {
  const [pick, setPick] = React.useState('');
  const [msg, run] = useStatus();
  const rest = PROVINCE_NAMES.filter(p => !user.favorit.includes(p));
  return <div className="fav-manager">
    {user.favorit.length ? <ul className="fav-chips">{user.favorit.map(p => <li key={p}><a href={`/peta?provinsi=${encodeURIComponent(p)}`}><Star size={14} /> {p}</a><button type="button" aria-label={`Hapus ${p} dari favorit`} onClick={() => run(() => account.removeFavorite(p), `${p} dihapus dari favorit.`)}><Trash2 size={14} /></button></li>)}</ul>
      : <p className="muted-note">Belum ada lokasi favorit. Tambahkan provinsi yang sering Anda pantau.</p>}
    <form className="fav-add" onSubmit={e => { e.preventDefault(); if (pick) run(async () => { await account.addFavorite(pick); setPick(''); }, `${pick} ditambahkan.`); }}>
      <select value={pick} onChange={e => setPick(e.target.value)} aria-label="Pilih provinsi favorit"><option value="">Pilih provinsi…</option>{rest.map(p => <option key={p}>{p}</option>)}</select>
      <button className="btn-secondary" type="submit" disabled={!pick}>Tambah</button>
    </form>
    {msg && <Alert tone={msg.tone === 'ok' ? 'ok' : 'error'}>{msg.text}</Alert>}
  </div>;
}

const EMPTY_RULE = { komoditas: 'Beras medium', wilayah: 'Indonesia', jenisPasar: 'tradisional', arah: 'keduanya', tipeBatas: 'persen', nilaiBatas: 5, periode: '7 hari' };
function describeRule(r) {
  const arah = { naik: 'naik', turun: 'turun', keduanya: 'naik/turun' }[r.arah];
  const batas = r.tipeBatas === 'persen' ? `${r.nilaiBatas.toLocaleString('id-ID')}%` : rp(r.nilaiBatas);
  return `Kabari bila ${arah} ≥ ${batas} dibanding ${r.periode} sebelumnya`;
}

function WatchManager({ user }) {
  const inbox = useInbox();
  const [rule, setRule] = React.useState(EMPTY_RULE);
  const [msg, run] = useStatus();
  const [locating, setLocating] = React.useState(false);
  const set = k => e => setRule(r => ({ ...r, [k]: k === 'nilaiBatas' ? Number(e.target.value) : e.target.value }));
  React.useEffect(() => { account.refreshInbox(); }, []);
  const useNearby = async () => {
    if (!user.aksesLokasi) return run(async () => { throw new Error('Aktifkan “Akses lokasi” di atas untuk memakai wilayah di sekitar Anda.'); });
    setLocating(true);
    await run(async () => {
      const pos = await account.locateOnce();
      const near = account.nearestCity(pos);
      setRule(r => ({ ...r, wilayah: near.city.province }));
    }, 'Wilayah diatur ke provinsi terdekat. Lokasi Anda tidak disimpan.');
    setLocating(false);
  };
  const create = e => { e.preventDefault(); run(async () => { await account.watches.create(rule); await account.refreshInbox(); }, 'Pantauan ditambahkan. Pengecekan berjalan saat Anda membuka aplikasi, paling sering 2× sehari.'); };
  return <div className="watch-manager">
    <form className="watch-form" onSubmit={create}>
      <Field label="Komoditas"><select value={rule.komoditas} onChange={set('komoditas')}>{COMMODITY_NAMES.filter(n => n !== 'Jagung pipilan').map(n => <option key={n}>{n}</option>)}</select></Field>
      <Field label="Wilayah">
        <span className="select-with-action">
          <select value={rule.wilayah} onChange={set('wilayah')}>
            <option value="Indonesia">Rata-rata nasional</option>
            {user.favorit.length > 0 && <optgroup label="Lokasi favorit">{user.favorit.map(p => <option key={`f-${p}`} value={p}>{p}</option>)}</optgroup>}
            <optgroup label="Semua provinsi">{PROVINCE_NAMES.map(p => <option key={p} value={p}>{p}</option>)}</optgroup>
          </select>
          <button type="button" className="btn-icon" onClick={useNearby} disabled={locating} title="Pakai provinsi di sekitar saya"><LocateFixed size={17} /></button>
        </span>
      </Field>
      <Field label="Tempat"><select value={rule.jenisPasar} onChange={set('jenisPasar')}><option value="tradisional">Pasar tradisional</option><option value="modern">Supermarket</option></select></Field>
      <Field label="Arah"><select value={rule.arah} onChange={set('arah')}><option value="keduanya">Naik atau turun</option><option value="naik">Hanya naik</option><option value="turun">Hanya turun</option></select></Field>
      <Field label="Batas">
        <span className="select-with-action">
          <input type="number" min={rule.tipeBatas === 'persen' ? 0.5 : 50} step={rule.tipeBatas === 'persen' ? 0.5 : 50} value={rule.nilaiBatas} onChange={set('nilaiBatas')} required />
          <select value={rule.tipeBatas} onChange={e => setRule(r => ({ ...r, tipeBatas: e.target.value, nilaiBatas: e.target.value === 'persen' ? 5 : 1000 }))} aria-label="Jenis batas"><option value="persen">%</option><option value="nominal">Rp</option></select>
        </span>
      </Field>
      <Field label="Periode pembanding"><select value={rule.periode} onChange={set('periode')}><option>7 hari</option><option>14 hari</option><option>30 hari</option></select></Field>
      <button className="btn-primary" type="submit" disabled={!user.notifikasiHarga}>Tambah pantauan</button>
    </form>
    {!user.notifikasiHarga && <Alert>Aktifkan “Notifikasi harga” untuk menambah pantauan.</Alert>}
    {msg && <Alert tone={msg.tone === 'ok' ? 'ok' : 'error'}>{msg.text}</Alert>}
    <ul className="watch-list">
      {inbox.pantauan.map(r => <li key={r.id} className={r.aktif ? '' : 'off'}>
        <div><b>{r.komoditas} · {r.wilayah === 'Indonesia' ? 'Nasional' : r.wilayah}</b><span>{r.jenisPasar === 'modern' ? 'Supermarket' : 'Pasar tradisional'} — {describeRule(r)}</span>
          <small>{r.terakhirDicek ? `Terakhir dicek ${formatTimestamp(r.terakhirDicek)}` : 'Belum pernah dicek'}</small></div>
        <Switch checked={r.aktif} label={r.aktif ? 'Aktif' : 'Mati'} onChange={v => run(async () => { await account.watches.setActive(r.id, v); await account.refreshInbox(); }, v ? 'Pantauan diaktifkan.' : 'Pantauan dimatikan.')} />
        <button type="button" className="btn-icon" aria-label="Hapus pantauan" onClick={() => run(async () => { await account.watches.remove(r.id); await account.refreshInbox(); }, 'Pantauan dihapus.')}><Trash2 size={16} /></button>
      </li>)}
      {!inbox.pantauan.length && <li className="muted-note">Belum ada pantauan.</li>}
    </ul>
  </div>;
}

function Inbox() {
  const inbox = useInbox();
  const [msg, run] = useStatus();
  const muteRule = id => run(async () => { await account.watches.setActive(id, false); await account.refreshInbox(); }, 'Pantauan dimatikan.');
  return <div className="inbox">
    {inbox.belumDibaca > 0 && <button type="button" className="btn-link" onClick={() => run(async () => { await account.watches.markRead({ semua: true }); await account.refreshInbox(); }, 'Semua ditandai sudah dibaca.')}>Tandai semua sudah dibaca</button>}
    {msg && <Alert tone={msg.tone === 'ok' ? 'ok' : 'error'}>{msg.text}</Alert>}
    <ul className="notif-list">
      {inbox.notifikasi.map(n => {
        const up = n.hargaAkhir > n.hargaAwal;
        const rule = inbox.pantauan.find(r => r.id === n.pantauanId);
        return <li key={n.id} className={n.dibaca ? '' : 'unread'}>
          <span className={`notif-icon ${up ? 'up' : 'down'}`}>{up ? <TrendingUp size={17} /> : <TrendingDown size={17} />}</span>
          <div>
            <b>{n.komoditas} {up ? 'naik' : 'turun'} {Math.abs(n.persen).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% · {n.wilayah === 'Indonesia' ? 'Nasional' : n.wilayah}</b>
            <span>{rp(n.hargaAwal)} → {rp(n.hargaAkhir)} ({n.jenisPasar === 'modern' ? 'supermarket' : 'pasar tradisional'}), pembanding {n.periode}: {formatDateLong(n.tanggalAwal)} – {formatDateLong(n.tanggalAkhir)}</span>
            <small>Sumber: {n.sumber} · data {formatDateLong(n.tanggalAkhir)} · dikirim {formatTimestamp(n.dibuat)}</small>
            <div className="notif-actions">
              <a className="btn-link" href={account.trendUrl(n)} onClick={() => { if (!n.dibaca) account.watches.markRead({ id: n.id }).catch(() => {}); }}>Lihat detail tren <ArrowRight size={14} /></a>
              {rule?.aktif && <button type="button" className="btn-link danger" onClick={() => muteRule(rule.id)}>Matikan pantauan</button>}
            </div>
          </div>
        </li>;
      })}
      {!inbox.notifikasi.length && <li className="muted-note">Belum ada notifikasi. Anda akan diberi tahu hanya bila harga melewati batas yang Anda atur.</li>}
    </ul>
  </div>;
}

export function ProfilePage({ theme, onToggleTheme }) {
  const s = useAccount();
  const [prefMsg, run] = useStatus();
  React.useEffect(() => { if (s.status === 'ready' && !s.user) go('/masuk?kembali=/profil'); }, [s.status, s.user]);
  if (!s.user) return <div className="account-loading"><RefreshCw size={18} className="spin" /> Memuat akun…</div>;
  const u = s.user;
  const toggleNotif = v => run(async () => {
    if (v && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    await account.savePrefs({ notifikasiHarga: v });
    if (v) account.checkWatches();
  }, v ? ('Notification' in window && Notification.permission === 'denied' ? 'Notifikasi harga aktif di kotak notifikasi aplikasi (notifikasi browser diblokir).' : 'Notifikasi harga aktif.') : 'Notifikasi harga dimatikan. Tidak ada peringatan yang dikirim.');
  return <div className="profile-page">
    <motion.header className="profile-hero" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
      <Avatar user={u} size={84} />
      <div><p className="hero-kicker">Profil</p><h1>{u.nama}</h1><p>@{u.username} · {u.email}</p>
        <div className="profile-badges">{u.punyaPassword && <span>Login dengan password</span>}</div></div>
      <button type="button" className="btn-logout" onClick={async () => { await account.logout(); go('/'); }}><LogOut size={17} /> Keluar</button>
    </motion.header>

    <div className="profile-grid">
      <Section title="Data profil" icon={UserRound}><ProfileForm user={u} /></Section>
      <Section title={u.punyaPassword ? 'Ubah password' : 'Buat password'} icon={ShieldCheck} sub="Password disimpan dalam bentuk hash di server."><PasswordForm user={u} /></Section>
      <Section title="Tampilan & izin" icon={theme === 'dark' ? Moon : Sun}>
        <Switch checked={theme === 'dark'} onChange={() => onToggleTheme()} label="Mode gelap" description="Tersimpan di akun Anda." />
        <Switch checked={u.notifikasiHarga} onChange={toggleNotif} label="Notifikasi harga" description="Opsional. Hanya saat harga yang Anda pantau melewati batas; dicek paling sering 2× sehari." />
        <Switch checked={u.aksesLokasi} onChange={v => run(() => account.savePrefs({ aksesLokasi: v }), v ? 'Akses lokasi diizinkan saat Anda memintanya.' : 'Akses lokasi dimatikan.')} label="Akses lokasi" description="Hanya dipakai ketika Anda menekan “Cari di sekitar saya”. Tidak dilacak dan tidak disimpan." />
        {prefMsg && <Alert tone={prefMsg.tone === 'ok' ? 'ok' : 'error'}>{prefMsg.text}</Alert>}
      </Section>
      <Section title="Lokasi favorit" icon={Star} sub="Dipakai di peta, tren, dan pantauan harga."><FavoritesManager user={u} /></Section>
      <Section title="Pantauan harga" icon={Bell} id="pantauan" sub="Pilih komoditas, wilayah, dan batas perubahan."><WatchManager user={u} /></Section>
      <Section title="Kotak notifikasi" icon={Bell} id="notifikasi"><Inbox /></Section>
    </div>
  </div>;
}


const RADII = [5, 10, 25, 50];
export function NearbyPage() {
  const s = useAccount();
  const [komoditas, setKomoditas] = React.useState(() => COMMODITY_NAMES.includes(qp('komoditas')) ? qp('komoditas') : 'Beras medium');
  const [jenis, setJenis] = React.useState('tradisional');
  const [radius, setRadius] = React.useState(25);
  const [sort, setSort] = React.useState('termurah');
  const [mode, setMode] = React.useState(null); // 'gps' | 'manual'
  const [pos, setPos] = React.useState(null);
  const [province, setProvince] = React.useState('');
  const [state, setState] = React.useState({ loading: false, error: '', data: null, note: '' });
  const pass = useGuestPass('sekitar', { perVisit: false });
  const consumeRef = React.useRef(pass.consume); consumeRef.current = pass.consume;
  const outOfFreeChecks = () => !account.getAccount().user && account.guestUsed('sekitar') >= account.GUEST_LIMIT;

  const cityPool = React.useMemo(() => {
    if (mode === 'gps' && pos) return CITIES.map(c => ({ ...c, km: account.haversineKm(pos, c) })).filter(c => c.km <= radius);
    if (mode === 'manual' && province) return CITIES.filter(c => c.province === province).map(c => ({ ...c, km: null }));
    return [];
  }, [mode, pos, radius, province]);

  React.useEffect(() => {
    if (!mode || (mode === 'manual' && !province) || (mode === 'gps' && !pos)) return;
    if (!cityPool.length) {
      const near = mode === 'gps' && pos ? account.nearestCity(pos) : null;
      setState({ loading: false, error: '', data: null, note: near ? `Belum ada kota pantauan PIHPS dalam radius ${radius} km. Terdekat: ${near.city.name} (±${Math.round(near.km)} km).` : 'Hasil belum tersedia untuk wilayah ini.' });
      return;
    }
    if (!consumeRef.current()) { setState({ loading: false, error: '', data: null, note: '', blocked: true }); return; }
    let live = true;
    setState(x => ({ ...x, loading: true, error: '', note: '' }));
    account.fetchCityPrices(jenis, komoditas, cityPool.map(c => c.id))
      .then(data => { if (live) setState({ loading: false, error: '', data, note: '' }); })
      .catch(e => { if (live) setState({ loading: false, error: e.message, data: null, note: '' }); });
    return () => { live = false; };
  }, [mode, pos, province, cityPool, jenis, komoditas, radius]);

  const findNearby = async () => {
    if (outOfFreeChecks()) { setState({ loading: false, error: '', data: null, note: '', blocked: true }); return; } // no location request when no free checks are left
    if (s.user && !s.user.aksesLokasi) {
      setState({ loading: false, error: 'Akses lokasi dimatikan di profil Anda. Aktifkan di Profil, atau pilih wilayah secara manual.', data: null, note: '' });
      setMode('manual'); return;
    }
    setState({ loading: true, error: '', data: null, note: '' });
    try { const p = await account.locateOnce(); setPos({ lat: p.lat, lon: p.lon }); setMode('gps'); }
    catch (e) { setState({ loading: false, error: e.message, data: null, note: '' }); setMode('manual'); }
  };

  const results = React.useMemo(() => {
    const rows = (state.data?.results || []).map(r => ({ ...r, km: cityPool.find(c => c.id === r.regencyId)?.km ?? null }));
    const priced = rows.filter(r => r.harga != null), missing = rows.filter(r => r.harga == null);
    priced.sort((a, b) => sort === 'termurah' ? a.harga - b.harga || (a.km ?? 0) - (b.km ?? 0) : (a.km ?? 0) - (b.km ?? 0) || a.harga - b.harga);
    return [...priced, ...missing];
  }, [state.data, cityPool, sort]);
  const provinces = [...new Set(CITIES.map(c => c.province))].sort((a, b) => a.localeCompare(b, 'id'));

  return <div className="nearby-page">
    <motion.header className="nearby-hero" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
      <p className="hero-kicker">Di sekitar Anda</p>
      <h1>Cari harga pasar & supermarket terdekat</h1>
      <p>Harga riil terbaru dari kota/kabupaten pantauan PIHPS Bank Indonesia. Lokasi hanya dipakai sekali saat Anda menekan tombol, tidak dilacak, dan tidak disimpan.</p>
    </motion.header>

    <section className="nearby-controls">
      <Field label="Komoditas"><select value={komoditas} onChange={e => setKomoditas(e.target.value)}>{COMMODITY_NAMES.map(n => <option key={n}>{n}</option>)}</select></Field>
      <div className="field"><span className="field-label">Tempat</span><div className="segmented">{[['tradisional', 'Pasar tradisional'], ['modern', 'Supermarket']].map(([v, l]) => <button key={v} type="button" className={jenis === v ? 'on' : ''} aria-pressed={jenis === v} onClick={() => setJenis(v)}>{jenis === v && <motion.span layoutId="near-jenis" className="seg-knob" transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }} />}<span className="seg-label">{l}</span></button>)}</div></div>
      <div className="field"><span className="field-label">Radius</span><div className="segmented">{RADII.map(r => <button key={r} type="button" className={radius === r ? 'on' : ''} aria-pressed={radius === r} onClick={() => setRadius(r)} disabled={mode === 'manual'}>{radius === r && <motion.span layoutId="near-radius" className="seg-knob" transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }} />}<span className="seg-label">{r} km</span></button>)}</div></div>
      <div className="nearby-actions">
        <button type="button" className="btn-primary" onClick={findNearby} disabled={state.loading && !mode}><LocateFixed size={17} /> Cari di sekitar saya</button>
        <span className="muted-note">atau</span>
        <select value={province} onChange={e => { setProvince(e.target.value); setMode(e.target.value ? 'manual' : null); }} aria-label="Pilih wilayah manual"><option value="">Pilih wilayah manual…</option>{provinces.map(p => <option key={p}>{p}</option>)}</select>
      </div>
    </section>

    <section className="nearby-results" aria-live="polite">
      {state.blocked && <GuestWall feature="sekitar" />}
      {pass.status === 'free' && !state.blocked && <GuestBanner left={pass.left} feature="sekitar" perSearch />}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.note && <Alert>{state.note}</Alert>}
      {state.loading && <p className="account-loading"><RefreshCw size={16} className="spin" /> Memuat harga dari PIHPS…</p>}
      {!mode && !state.loading && !state.error && <p className="muted-note"><MapPin size={15} /> Tekan “Cari di sekitar saya” atau pilih wilayah untuk melihat hasil.</p>}
      {state.data && !state.loading && <>
        <div className="nearby-meta">
          <div><b>{state.data.kualitas || komoditas}</b> · per {state.data.unit || 'kg'} · {jenis === 'modern' ? 'Supermarket' : 'Pasar tradisional'}{mode === 'gps' ? ` · radius ${radius} km` : ` · ${province}`}</div>
          <div className="segmented">{[['termurah', 'Termurah'], ['terdekat', 'Terdekat']].map(([v, l]) => <button key={v} type="button" className={sort === v ? 'on' : ''} aria-pressed={sort === v} disabled={v === 'terdekat' && mode !== 'gps'} onClick={() => setSort(v)}>{sort === v && <motion.span layoutId="near-sort" className="seg-knob" transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }} />}<span className="seg-label">{l}</span></button>)}</div>
        </div>
        {state.data.available === false ? <Alert>Hasil belum tersedia: {state.data.reason}</Alert> : !results.length ? <Alert>Hasil belum tersedia untuk pilihan ini.</Alert> :
          <ol className="nearby-list">{results.map((r, i) => <motion.li key={`${r.regencyId}-${i}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: Math.min(i, 8) * 0.05, ease: 'easeOut' }} className={r.harga == null ? 'missing' : ''}>
            <span className="nearby-rank">{r.harga == null ? '–' : i + 1}</span>
            <div className="nearby-place"><b>{r.tempat}</b><span>{r.provinsi}{Array.isArray(r.toko) && r.toko.length ? ` · toko dipantau: ${r.toko.join(', ')}` : ''}</span></div>
            <div className="nearby-price">{r.harga == null ? <span className="muted-note">{r.gagal ? 'Gagal dimuat' : NO_DATA}</span> : <><strong>{rp(r.harga)}</strong><small>/{state.data.unit || 'kg'}</small></>}</div>
            <div className="nearby-dist">{r.km == null ? '—' : `±${r.km < 10 ? r.km.toFixed(1).replace('.', ',') : Math.round(r.km)} km`}</div>
            <div className="nearby-date">{r.tanggal ? <>Data {formatDateLong(r.tanggal)}{r.kedaluwarsa && <em className="stale">kedaluwarsa</em>}</> : '—'}</div>
          </motion.li>)}</ol>}
        <p className="nearby-source"><Info size={14} /> Sumber: <a href={state.data.source.url} target="_blank" rel="noreferrer">{state.data.source.name} <ExternalLink size={12} /></a> · diambil {formatTimestamp(state.data.fetchedAt)}. Harga adalah rata-rata pasar/supermarket pantauan di tiap kota (PIHPS tidak menerbitkan harga per toko). Jarak diukur ke pusat kota (perkiraan, koordinat © OpenStreetMap). Komoditas, kualitas, dan satuan sama untuk semua hasil.</p>
      </>}
    </section>
  </div>;
}


export function useGuestPass(feature, { perVisit = true } = {}) {
  const s = useAccount();
  const counted = React.useRef(false);
  const [used, setUsed] = React.useState(() => (feature ? account.guestUsed(feature) : 0));
  React.useEffect(() => {
    if (!feature || !perVisit || s.status !== 'ready' || s.user || counted.current) return;
    counted.current = true;
    setUsed(account.spendGuestCredit(feature));
  }, [feature, perVisit, s.status, s.user]);
  const status = !feature ? 'member' : s.status !== 'ready' ? 'checking' : s.user ? 'member'
    : (perVisit ? (counted.current ? used : used + 1) : used) > account.GUEST_LIMIT ? 'blocked' : 'free';
  const consume = () => {
    if (!feature || account.getAccount().user) return true;
    if (account.guestUsed(feature) >= account.GUEST_LIMIT) { setUsed(account.guestUsed(feature) + 1); return false; }
    setUsed(account.spendGuestCredit(feature));
    return true;
  };
  return { status, used, left: Math.max(0, account.GUEST_LIMIT - used), consume };
}

export function GuestWall({ feature }) {
  const s = useAccount();
  const name = account.GUEST_FEATURES[feature] || 'fitur ini';
  const ret = location.pathname + location.search;
  return <AuthCard title="Akses gratis Anda sudah habis" sub={`Anda sudah memakai ${account.GUEST_LIMIT} kali akses gratis ${name}. Masuk atau buat akun gratis untuk melanjutkan tanpa batas.`}
    foot={<>Belum punya akun? <a href={`/daftar?kembali=${encodeURIComponent(ret)}`}>Daftar sekarang</a></>}>
    <a className="btn-primary" href={`/masuk?kembali=${encodeURIComponent(ret)}`}><LogIn size={17} /> Masuk dengan username / email</a>
    <p className="auth-note"><Info size={14} /> Dengan akun, lokasi favorit, pantauan harga, dan preferensi tersimpan di semua perangkat.</p>
  </AuthCard>;
}

export function GuestBanner({ left, feature, perSearch }) {
  const ret = encodeURIComponent(location.pathname + location.search);
  return <motion.div className="guest-banner" role="status" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}>
    <span><b>Akses tamu</b> · sisa {left} dari {account.GUEST_LIMIT} {perSearch ? 'pencarian' : 'kunjungan'} {account.GUEST_FEATURES[feature] || ''}</span>
    <a href={`/masuk?kembali=${ret}`}>Masuk</a>
  </motion.div>;
}
