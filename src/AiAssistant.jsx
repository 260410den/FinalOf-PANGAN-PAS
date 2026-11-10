import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, ImagePlus, Trash2, ArrowRight, Loader2 } from 'lucide-react';
import { askAI, answerFromContext, buildContext, imageToDataUrl, splitActions, SYSTEM_PROMPT } from './ai.js';

const SUGGESTIONS = {
  '/': ['Komoditas apa yang paling naik bulan ini?', 'Di provinsi mana beras medium paling murah?', 'Bagaimana cara memasang notifikasi harga?'],
  '/tren': ['Jelaskan tren cabai merah 30 hari terakhir', 'Bandingkan harga telur ayam di Jawa Barat dan DKI Jakarta'],
  '/sekitar': ['Bagaimana cara mencari harga di dekat saya?', 'Kenapa harga per toko tidak tersedia?'],
  '/komunitas': ['Bagaimana cara mengirim temuan harga?', 'Apakah kiriman komunitas sudah diverifikasi?'],
  '/profil': ['Bagaimana pantauan harga bekerja?', 'Apa saja yang disimpan di akun saya?'],
};
const pageInfo = () => {
  const q = new URLSearchParams(location.search);
  return { path: location.pathname.replace(/\/+$/, '') || '/', komoditas: q.get('komoditas') || undefined, wilayah: q.get('wilayah') || q.get('provinsi') || undefined };
};

function Rich({ text }) {
  const blocks = [];
  let list = null;
  text.split('\n').forEach((line, i) => {
    const bold = s => s.split(/(\*\*[^*]+\*\*)/g).map((part, k) => part.startsWith('**') && part.endsWith('**') ? <b key={k}>{part.slice(2, -2)}</b> : part);
    const m = line.match(/^\s*[-*•]\s+(.*)$/);
    if (m) { (list ||= []).push(<li key={i}>{bold(m[1])}</li>); return; }
    if (list) { blocks.push(<ul key={`l${i}`}>{list}</ul>); list = null; }
    if (line.trim()) blocks.push(<p key={i}>{bold(line.replace(/^#+\s*/, ''))}</p>);
  });
  if (list) blocks.push(<ul key="last">{list}</ul>);
  return <>{blocks}</>;
}

export function AiAssistant() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [image, setImage] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [thinking, setThinking] = React.useState(false);
  const [error, setError] = React.useState('');
  const listRef = React.useRef(null);
  const abortRef = React.useRef(null);
  const fileRef = React.useRef(null);
  const page = pageInfo();

  React.useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, thinking]);
  React.useEffect(() => () => abortRef.current?.abort(), []);

  const send = React.useCallback(async (question, extraPage) => {
    const q = String(question || '').trim();
    if ((!q && !image) || busy) return;
    setError(''); setBusy(true); setOpen(true);
    const img = image; setImage(null); setInput('');
    const shown = q || 'Tolong baca gambar ini.';
    const history = messages.slice(-6).map(m => ({ role: m.role, content: m.text }));
    const previousQuestions = messages.filter(m => m.role === 'user').slice(-3).map(m => m.text);
    setMessages(prev => [...prev, { role: 'user', text: shown, image: img?.url }, { role: 'assistant', text: '' }]);
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      const ctx = await buildContext([...previousQuestions, shown].join('\n'), { ...pageInfo(), ...extraPage });
      ctx.pertanyaan_sebelumnya = previousQuestions.at(-1) || '';
      const userText = `KONTEKS (data riil): ${JSON.stringify(ctx)}\nHalaman saat ini: ${pageInfo().path}${extraPage ? `\nPilihan di halaman: ${JSON.stringify(extraPage)}` : ''}\n\nPertanyaan: ${shown}`;
      const content = img ? [{ type: 'text', text: userText }, { type: 'image_url', image_url: { url: img.url } }] : userText;
      const final = await askAI({
        mode: 'chat', signal: ctrl.signal,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history, { role: 'user', content }],
        onThinking: setThinking,
        onDelta: t => setMessages(prev => { const next = [...prev]; next[next.length - 1] = { role: 'assistant', text: splitActions(t, true).body }; return next; }),
        fallback: () => answerFromContext(shown, ctx, { hasImage: Boolean(img) }),
      });
      const { body, actions } = splitActions(final || 'Maaf, saya belum bisa menjawab. Coba ulangi pertanyaannya.');
      setMessages(prev => { const next = [...prev]; next[next.length - 1] = { role: 'assistant', text: body, actions }; return next; });
    } catch (e) {
      if (e.name === 'AbortError') return;
      setMessages(prev => prev.slice(0, -1));
      setError(e.notConfigured ? 'Asisten AI belum aktif: kunci NVIDIA_API_KEY belum diisi di server.' : e.message);
    } finally { setBusy(false); setThinking(false); abortRef.current = null; }
  }, [busy, image, messages]);

  React.useEffect(() => {
    const onAsk = e => { setOpen(true); if (e.detail?.question) send(e.detail.question, e.detail.page); };
    window.addEventListener('pangan-ai-ask', onAsk);
    return () => window.removeEventListener('pangan-ai-ask', onAsk);
  }, [send]);

  const pick = async e => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { setImage({ url: await imageToDataUrl(file), name: file.name }); setError(''); } catch (err) { setError(err.message); }
  };
  const suggestions = SUGGESTIONS[page.path] || SUGGESTIONS['/'];

  return <>
    <motion.button type="button" className="ai-fab" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls="ai-panel"
      initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.8, ease: [0.16, 1, 0.3, 1] }} whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}>
      {open ? <X size={20} /> : <Sparkles size={20} />}<span>{open ? 'Tutup' : 'Tanya AI'}</span>
    </motion.button>
    <AnimatePresence>
      {open && <motion.section id="ai-panel" className="ai-panel" role="dialog" aria-label="Asisten AI PANGAN PAS"
        initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
        <header className="ai-head">
          <span className="ai-mark"><Sparkles size={18} /></span>
          <div><b>Asisten PANGAN PAS</b><small>Data PIHPS BI · bisa membaca foto label harga</small></div>
          {messages.length > 0 && <button type="button" className="ai-icon-btn" onClick={() => { abortRef.current?.abort(); setMessages([]); setError(''); }} aria-label="Hapus percakapan"><Trash2 size={16} /></button>}
          <button type="button" className="ai-icon-btn" onClick={() => setOpen(false)} aria-label="Tutup asisten"><X size={17} /></button>
        </header>
        <div className="ai-list" ref={listRef}>
          {!messages.length && <div className="ai-empty">
            <p>Tanyakan harga, tren, perbandingan wilayah, atau cara memakai fitur. Anda juga bisa melampirkan foto label harga atau struk.</p>
            <div className="ai-suggest">{suggestions.map(s => <button key={s} type="button" onClick={() => send(s)}>{s}</button>)}</div>
          </div>}
          {messages.map((m, i) => <div key={i} className={`ai-msg ${m.role}`}>
            {m.image && <img src={m.image} alt="Gambar yang dilampirkan" />}
            {m.role === 'assistant' && !m.text ? <span className="ai-typing"><Loader2 size={15} className="spin" /> {thinking ? 'Sedang menganalisis data…' : 'Menyiapkan jawaban…'}</span> : <Rich text={m.text} />}
            {m.actions?.length > 0 && <div className="ai-actions">{m.actions.map(a => <a key={a.href} href={a.href}>{a.label} <ArrowRight size={13} /></a>)}</div>}
          </div>)}
        </div>
        {error && <p className="ai-error" role="alert">{error}</p>}
        <form className="ai-input" onSubmit={e => { e.preventDefault(); send(input); }}>
          {image && <span className="ai-attach"><img src={image.url} alt="" /><button type="button" onClick={() => setImage(null)} aria-label="Hapus gambar"><X size={13} /></button></span>}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} />
          <button type="button" className="ai-icon-btn" onClick={() => fileRef.current?.click()} aria-label="Lampirkan foto" disabled={busy}><ImagePlus size={18} /></button>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Tulis pertanyaan…" maxLength={600} aria-label="Pertanyaan untuk asisten" />
          <button type="submit" className="ai-send" disabled={busy || (!input.trim() && !image)} aria-label="Kirim"><Send size={17} /></button>
        </form>
        <p className="ai-foot">AI dapat keliru. Angka harga diambil dari PIHPS; periksa kembali sebelum memutuskan.</p>
      </motion.section>}
    </AnimatePresence>
  </>;
}

export function AiPhotoFill({ file, onFill }) {
  const [state, setState] = React.useState({ busy: false, msg: '', tone: '' });
  React.useEffect(() => setState({ busy: false, msg: '', tone: '' }), [file]);
  const run = async () => {
    setState({ busy: true, msg: '', tone: '' });
    try {
      const { extractPriceFromImage } = await import('./ai.js');
      const r = await extractPriceFromImage(file);
      const filled = onFill(r);
      if (!filled) setState({ busy: false, tone: 'warn', msg: `AI tidak menemukan data yang bisa diisi. ${r.note || ''}`.trim() });
      else setState({ busy: false, tone: r.confidence < 0.6 ? 'warn' : 'ok', msg: `Terisi otomatis: ${filled}. Periksa kembali sebelum menyimpan.${r.note ? ` ${r.note}` : ''}` });
    } catch (e) {
      setState({ busy: false, tone: 'error', msg: e.notConfigured ? 'Asisten AI belum aktif: kunci NVIDIA_API_KEY belum diisi di server.' : e.message });
    }
  };
  return <div className="ai-photo-fill">
    <button type="button" onClick={run} disabled={state.busy}>{state.busy ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} {state.busy ? 'AI sedang membaca foto…' : 'Isi otomatis dari foto (AI)'}</button>
    {state.msg && <p className={`ai-photo-msg ${state.tone}`} role="status">{state.msg}</p>}
  </div>;
}
