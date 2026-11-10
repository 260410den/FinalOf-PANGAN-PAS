const LOCAL_KEY = 'pangan-pas-community-v1';
export const mode = import.meta.env.VITE_COMMUNITY_API_URL ? 'server' : 'local';
const API = '/api/akun';

const readLocal = () => {
  try {
    const items = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    return Array.isArray(items) ? items.map(i => ({ status: 'belum_diverifikasi', ...i, comments: (i.comments || []).map(c => ({ ...c, replies: c.replies || [] })) })) : [];
  } catch { return []; }
};
const writeLocal = items => {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(items)); }
  catch { throw new Error('Penyimpanan browser penuh. Hapus kiriman lama atau gunakan foto yang lebih kecil.'); }
};
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const needUser = user => { if (!user) throw Object.assign(new Error('Silakan masuk terlebih dahulu.'), { needLogin: true }); };

async function call(path, options = {}) {
  const method = options.method || 'GET';
  const res = await fetch(`${API}/${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'X-Pangan-Request': '1' } : {}), ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) throw Object.assign(new Error(body?.error || `Server komunitas tidak dapat dihubungi (HTTP ${res.status}).`), { needLogin: res.status === 401 });
  return body;
}

export async function list() {
  if (mode === 'local') return readLocal();
  return (await call('kiriman')).items;
}

export async function create(row, user) {
  needUser(user);
  if (mode === 'local') {
    const item = { ...row, name: user.nama, ownerId: user.id, id: newId(), status: 'belum_diverifikasi', comments: [], createdAt: new Date().toISOString() };
    writeLocal([item, ...readLocal()].slice(0, 12));
    return item;
  }
  return call('kiriman', { method: 'POST', body: JSON.stringify(row) });
}

export async function addComment(postId, text, user) {
  needUser(user);
  if (mode === 'local') {
    writeLocal(readLocal().map(i => i.id === postId ? { ...i, comments: [...i.comments, { id: newId(), author: user.nama, ownerId: user.id, text, createdAt: new Date().toISOString(), replies: [] }].slice(-40) } : i));
    return;
  }
  await call('komentar', { method: 'POST', body: JSON.stringify({ kiriman_id: postId, text }) });
}

export async function addReply(postId, commentId, text, user) {
  needUser(user);
  if (mode === 'local') {
    writeLocal(readLocal().map(i => i.id === postId ? { ...i, comments: i.comments.map(c => c.id === commentId ? { ...c, replies: [...c.replies, { id: newId(), author: user.nama, ownerId: user.id, text, createdAt: new Date().toISOString() }].slice(-40) } : c) } : i));
    return;
  }
  await call('komentar', { method: 'POST', body: JSON.stringify({ komentar_id: commentId, text, reply: true }) });
}

export const canDelete = (item, user) => Boolean(user && item?.ownerId != null && Number(item.ownerId) === Number(user.id));

export async function remove(id, user) {
  needUser(user);
  if (mode === 'local') { writeLocal(readLocal().filter(i => i.id !== id)); return; }
  await call(`kiriman?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}
