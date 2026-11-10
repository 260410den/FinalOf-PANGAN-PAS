import React from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Star, X, Download, ArrowRight, RefreshCw, Info, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { FoodIcon } from './decor.jsx';
import {
  PERIODS, PLACE_TYPES, placeLabel, NO_DATA, usePrices, statOf, indexOf, formatDateLong, formatTimestamp,
  granularityLabel, latestDate, downloadCsv, slug, unitOf, isAvailable, formatDate,
} from './priceData.js';

const rp = n => (n == null ? NO_DATA : 'Rp' + Math.round(n).toLocaleString('id-ID'));
const pct = n => (n == null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('id-ID', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`);

export function DataStatus({ state }) {
  if (state.status === 'loading') return <p className="data-status loading" role="status"><span className="data-status-dot" />Memuat data harga dari PIHPS Bank Indonesia…</p>;
  if (state.status === 'error') return <p className="data-status error" role="alert"><Info size={15} />{NO_DATA}: {state.error} <button type="button" onClick={state.retry}><RefreshCw size={13} /> Coba lagi</button></p>;
  return null;
}

export function SourceNote({ data, inline = false }) {
  if (!data) return <span className="source-note">Sumber: PIHPS Nasional – Bank Indonesia</span>;
  const last = latestDate(data);
  const body = <>Sumber: <a href={data.source.url} target="_blank" rel="noreferrer">{data.source.name}<ExternalLink size={11} /></a> · {data.jenisLabel} · data terakhir {last ? formatDateLong(last) : '—'} · diambil {formatTimestamp(data.fetchedAt)}</>;
  return inline ? <span className="source-note">{body}</span> : <span className="source-note">{body}</span>;
}

export function FavToggle({ name, fav }) {
  const disabled = !name || name === 'Indonesia';
  const on = fav.isFav(name);
  return <button type="button" className={on ? 'fav-toggle on' : 'fav-toggle'} disabled={disabled} aria-pressed={on} title={disabled ? 'Pilih satu provinsi untuk dijadikan favorit' : on ? 'Hapus dari favorit' : 'Tandai sebagai favorit'} onClick={() => fav.toggle(name)}>
    <Star size={15} fill={on ? 'currentColor' : 'none'} />{on ? 'Favorit' : 'Jadikan favorit'}
  </button>;
}

export function FavoritesPanel({ fav, data, period, commodities, onOpen, compact = false }) {
  return <section className={`panel favorites-panel ${compact ? 'is-compact' : ''}`}>
    <div className="panel-head"><div><div className="eyebrow">PROVINSI FAVORIT · {period}</div><h2>Indeks harga provinsi favorit</h2></div><span className="period-chip">{data?.jenisLabel || 'Memuat…'}</span></div>
    <p className="regional-panel-intro">Indeks = rata-rata (harga akhir ÷ harga awal periode × 100) dari komoditas yang punya data. Di atas 100 berarti harga naik.</p>
    {fav.favs.length === 0
      ? <p className="no-data-note"><Star size={15} /> Belum ada favorit. Pilih provinsi lalu tekan “Jadikan favorit”.</p>
      : <div className="favorites-grid">{fav.favs.map(name => {
        const idx = data ? indexOf(data, name, commodities) : null;
        return <article className="favorite-card" key={name}>
          <div className="favorite-card-top"><b>{name}</b><button type="button" className="fav-remove" onClick={() => fav.remove(name)} aria-label={`Hapus ${name} dari favorit`}><X size={14} /></button></div>
          {idx ? <><strong className="favorite-index">{idx.value.toLocaleString('id-ID', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}</strong>
            <span className={idx.change < -0.5 ? 'negative' : idx.change > 0.5 ? 'positive' : ''}>{pct(idx.change)} · {idx.count} komoditas</span></>
            : <span className="favorite-nodata">{data ? NO_DATA : 'Memuat…'}</span>}
          <button type="button" className="text-link favorite-open" onClick={() => onOpen(name)}>Buka detail <ArrowRight size={14} /></button>
        </article>;
      })}</div>}
  </section>;
}

function MiniChart({ points, domain, color, label }) {
  if (!points?.length) return <div className="compare-chart-empty">{NO_DATA}</div>;
  return <ResponsiveContainer width="100%" height={220}>
    <LineChart data={points} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
      <CartesianGrid stroke="var(--pp-rule)" vertical={false} />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} minTickGap={20} />
      <YAxis width={62} domain={domain} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={v => 'Rp' + Math.round(v / 1000) + 'k'} />
      <Tooltip formatter={v => [rp(v), label]} />
      <Line type="monotone" dataKey="price" stroke={color} strokeWidth={2.6} dot={points.length < 20} />
    </LineChart>
  </ResponsiveContainer>;
}

export function ProvinceCompare({ regions, commodities, fav, initialA = 'Jawa Barat', initialB = 'DKI Jakarta' }) {
  const [commodity, setCommodity] = React.useState(commodities[0]);
  const [period, setPeriod] = React.useState('30 hari');
  const [jenis, setJenis] = React.useState('tradisional');
  const [a, setA] = React.useState(initialA);
  const [b, setB] = React.useState(initialB);
  const state = usePrices(jenis, period);
  const data = state.data;
  const sa = statOf(data, commodity, a), sb = statOf(data, commodity, b);
  const unit = unitOf(data, commodity);
  const prices = [...(sa?.points || []), ...(sb?.points || [])].map(p => p.price);
  const pad = prices.length ? Math.max(100, (Math.max(...prices) - Math.min(...prices)) * 0.1) : 0;
  const domain = prices.length ? [Math.floor((Math.min(...prices) - pad) / 100) * 100, Math.ceil((Math.max(...prices) + pad) / 100) * 100] : ['auto', 'auto'];
  const diff = sa && sb ? sa.price - sb.price : null;
  const diffPct = sa && sb && sb.price ? (diff / sb.price) * 100 : null;

  const exportCsv = () => {
    const byDate = new Map();
    (sa?.points || []).forEach(p => byDate.set(p.date, { a: p.price }));
    (sb?.points || []).forEach(p => byDate.set(p.date, { ...(byDate.get(p.date) || {}), b: p.price }));
    const rows = [...byDate.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([date, v]) => [
      commodity, unit, period, data.jenisLabel, a, b, date, v.a ?? NO_DATA, v.b ?? NO_DATA,
      v.a != null && v.b != null ? v.a - v.b : '', `${data.source.name} (${data.source.url}), diambil ${data.fetchedAt}`,
    ]);
    downloadCsv(`perbandingan-${slug(commodity)}-${slug(period)}.csv`,
      ['komoditas', 'satuan', 'periode', 'jenis_tempat', 'provinsi_1', 'provinsi_2', 'tanggal_pengamatan', `harga_${slug(a)}`, `harga_${slug(b)}`, 'selisih_harga_rp', 'sumber_data'], rows);
  };

  const side = (name, s, color) => <article className="compare-side">
    <div className="compare-side-head"><b>{name}</b><FavToggle name={name} fav={fav} /></div>
    <div className="regional-price-stat"><span>Harga terakhir{s ? ` · ${data?.granularity === 'bulanan' ? formatDate(s.date, 'bulanan') : formatDateLong(s.date)}` : ''}</span><strong>{s ? `${rp(s.price)}/${unit}` : NO_DATA}</strong></div>
    <div className="region-delta-stat"><span>Perubahan selama {period}</span><strong className={s?.change < 0 ? 'negative' : s?.change > 0 ? 'positive' : ''}>{s ? pct(s.change) : '—'}</strong></div>
    <MiniChart points={s?.points} domain={domain} color={color} label={name} />
  </article>;

  return <section className="panel province-compare" id="bandingkan">
    <div className="panel-head"><div><div className="eyebrow">BANDINGKAN DUA PROVINSI · PIHPS</div><h2>Perbandingan antarprovinsi</h2></div>
      <button type="button" className="csv-button" disabled={!data || (!sa && !sb)} onClick={exportCsv}><Download size={15} /> Unduh CSV</button></div>
    <div className="compare-controls trends-filter-controls">
      <label>Komoditas<select value={commodity} onChange={e => setCommodity(e.target.value)}>{commodities.map(n => <option key={n}>{n}</option>)}</select></label>
      <label>Periode<select value={period} onChange={e => setPeriod(e.target.value)}>{PERIODS.map(p => <option key={p}>{p}</option>)}</select></label>
      <label>Tempat belanja<select value={jenis} onChange={e => setJenis(e.target.value)}>{PLACE_TYPES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
      <label>Provinsi 1<select value={a} onChange={e => setA(e.target.value)}>{regions.map(n => <option key={n}>{n}</option>)}</select></label>
      <label>Provinsi 2<select value={b} onChange={e => setB(e.target.value)}>{regions.map(n => <option key={n}>{n}</option>)}</select></label>
    </div>
    <DataStatus state={state} />
    {data && !isAvailable(data, commodity) && <p className="no-data-note"><Info size={15} /> {NO_DATA}: {data.commodities[commodity]?.reason}</p>}
    {data && isAvailable(data, commodity) && <>
      <div className="compare-summary">
        <div className="regional-price-stat"><span>Selisih nominal ({a} − {b})</span><strong>{diff == null ? NO_DATA : `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${rp(Math.abs(diff))}/${unit}`}</strong></div>
        <div className="regional-price-stat"><span>Persentase selisih (terhadap {b})</span><strong>{pct(diffPct)}</strong></div>
        <div className="regional-price-stat"><span>Satuan & tempat</span><strong>per {unit} · {placeLabel(jenis)}</strong></div>
      </div>
      <div className="compare-sides">{side(a, sa, 'var(--pp-green)')}{side(b, sb, 'var(--pp-up)')}</div>
      <p className="chart-foot"><span>Skala harga kedua grafik sama · {granularityLabel(data.granularity)}</span><SourceNote data={data} /></p>
    </>}
  </section>;
}

export function PlaceSelect({ value, onChange }) {
  return <label>Tempat belanja<select value={value} onChange={e => onChange(e.target.value)}>{PLACE_TYPES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>;
}


export function PriceTicker({ commodities }) {
  const state = usePrices('tradisional', '7 hari');
  const items = commodities.map(name => {
    const s = statOf(state.data, name, 'Indonesia');
    return { name, s };
  });
  const chip = (it, i) => <span className="ticker-chip" key={i}>
    <b>{it.name}</b>
    {it.s ? <><em>{rp(it.s.price)}</em><i className={it.s.change > 0.05 ? 'up' : it.s.change < -0.05 ? 'down' : 'flat'}>{it.s.change > 0.05 ? '▲' : it.s.change < -0.05 ? '▼' : '■'} {pct(it.s.change)}</i></>
      : <em className="muted">{state.status === 'loading' ? 'memuat…' : NO_DATA}</em>}
  </span>;
  return <div className="price-ticker" aria-label="Harga rata-rata nasional pasar tradisional, 7 hari terakhir, sumber PIHPS Bank Indonesia">
    <span className="ticker-label">Harga nasional · PIHPS</span>
    <div className="ticker-viewport"><div className="ticker-track">{items.map(chip)}{items.map((it, i) => chip(it, i + items.length))}</div></div>
  </div>;
}






export function useCountUp(value, duration = 900) {
  const [shown, setShown] = React.useState(value ?? 0);
  const from = React.useRef(value ?? 0);
  React.useEffect(() => {
    if (value == null) return;
    const start = performance.now(), a = from.current, b = value;
    let raf = 0;
    const tick = t => {
      const k = Math.min(1, (t - start) / duration), e = 1 - Math.pow(1 - k, 3);
      setShown(a + (b - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = b; };
  }, [value, duration]);
  return shown;
}
export function CountRp({ value, suffix = '' }) {
  const v = useCountUp(value);
  return value == null ? <>{NO_DATA}</> : <>{'Rp' + Math.round(v).toLocaleString('id-ID')}{suffix}</>;
}
function CountNum({ value }) { const v = useCountUp(value); return <>{Math.round(v)}</>; }

export function Sparkline({ points, tone = 'flat', height = 46 }) {
  if (!points || points.length < 2) return <div className="spark-empty" style={{ height }} />;
  const W = 200, H = height, vals = points.map(p => p.price), min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${(i / (points.length - 1) * W).toFixed(1)} ${(H - 4 - ((p.price - min) / span) * (H - 10)).toFixed(1)}`).join(' ');
  return <svg className={`sparkline tone-${tone}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
    <path className="spark-area" d={`${d} L${W} ${H} L0 ${H} Z`} />
    <path className="spark-line" d={d} pathLength="100" />
  </svg>;
}

const toneOf = ch => (ch == null ? 'flat' : ch > 0.05 ? 'up' : ch < -0.05 ? 'down' : 'flat');
function ChangePill({ change }) {
  const t = toneOf(change), Icon = t === 'up' ? TrendingUp : t === 'down' ? TrendingDown : Minus;
  return <span className={`change-pill ${t}`}><Icon size={13} />{pct(change)}</span>;
}
function Segmented({ options, value, onChange, label }) {
  const id = React.useId();
  return <div className="segmented" role="group" aria-label={label}>
    {options.map(o => <button key={o.value} type="button" aria-pressed={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
      {value === o.value && <motion.span layoutId={`seg-${id}`} className="seg-knob" transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }} />}
      <span className="seg-label">{o.label}</span>
    </button>)}
  </div>;
}
const PLACE_OPTS = PLACE_TYPES.map(p => ({ value: p.key, label: p.label }));


const HERO_ITEMS = ['Beras medium', 'Cabai merah', 'Bawang merah', 'Telur ayam'];
export function HeroInsight() {
  const state = usePrices('tradisional', '30 hari');
  const data = state.data;
  const [active, setActive] = React.useState(HERO_ITEMS[0]);
  const main = statOf(data, active, 'Indonesia');
  return <aside className="hero-insight" aria-label="Ringkasan harga nasional">
    <div className="hero-insight-head"><div><span>Ringkasan nasional</span><b>30 hari · pasar tradisional</b></div><span className="live-dot">Data PIHPS</span></div>
    <div className="hero-kpis" role="tablist" aria-label="Pilih komoditas">
      {HERO_ITEMS.map(name => { const s = statOf(data, name, 'Indonesia'); return <button key={name} type="button" role="tab" aria-selected={active === name} className={active === name ? 'on' : ''} onClick={() => setActive(name)}>
        <span><FoodIcon name={name} />{name}</span>
        <strong>{s ? <CountRp value={s.price} /> : state.status === 'loading' ? '…' : NO_DATA}</strong>
        {s && <ChangePill change={s.change} />}
      </button>; })}
    </div>
    <div className="hero-insight-chart">
      <div className="hic-head"><span>{active} · rata-rata nasional per kg</span>{main && <b><CountRp value={main.price} /></b>}</div>
      {main ? <ResponsiveContainer width="100%" height={150}>
        <AreaChart data={main.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs><linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2e8b4e" stopOpacity=".28" /><stop offset="1" stopColor="#2e8b4e" stopOpacity="0" /></linearGradient></defs>
          <CartesianGrid stroke="rgba(20,60,35,.08)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} minTickGap={24} />
          <YAxis hide domain={['dataMin - 150', 'dataMax + 150']} />
          <Tooltip formatter={v => [rp(v) + '/kg', active]} />
          <Area key={active} type="monotone" dataKey="price" stroke="#2e8b4e" strokeWidth={2.6} fill="url(#heroFill)" dot={false} activeDot={{ r: 5 }} animationDuration={1200} />
        </AreaChart>
      </ResponsiveContainer> : <div className="compare-chart-empty">{state.status === 'loading' ? 'Memuat data…' : NO_DATA}</div>}
    </div>
    <SourceNote data={data} />
  </aside>;
}


export function MarketPulse({ commodities }) {
  const [jenis, setJenis] = React.useState('tradisional');
  const [period, setPeriod] = React.useState('30 hari');
  const state = usePrices(jenis, period);
  const data = state.data;
  const rows = commodities.map(name => ({ name, s: statOf(data, name, 'Indonesia') }));
  const counts = rows.reduce((c, r) => { c[r.s ? toneOf(r.s.change) : 'none'] += 1; return c; }, { up: 0, down: 0, flat: 0, none: 0 });
  const total = rows.length;
  return <section className="market-pulse" id="denyut-pasar">
    <div className="section-head">
      <div><p className="section-kicker">Denyut pasar</p><h2>Pergerakan harga nasional</h2><p className="section-sub">Rata-rata harga {placeLabel(jenis).toLowerCase()} di provinsi pantauan PIHPS. Pilih jenis tempat dan periode untuk membandingkan.</p></div>
      <div className="section-controls">
        <Segmented label="Jenis tempat" options={PLACE_OPTS} value={jenis} onChange={setJenis} />
        <Segmented label="Periode" options={['7 hari', '30 hari', '3 bulan', '12 bulan'].map(p => ({ value: p, label: p }))} value={period} onChange={setPeriod} />
      </div>
    </div>
    <div className="pulse-summary" aria-label="Ringkasan arah harga">
      <div className="pulse-bar">{['up', 'flat', 'down', 'none'].map(k => <span key={k} className={`seg ${k}`} style={{ width: `${(counts[k] / total) * 100}%` }} />)}</div>
      <div className="pulse-legend">
        <span><i className="up" /> Naik <b><CountNum value={counts.up} /></b></span>
        <span><i className="flat" /> Stabil <b><CountNum value={counts.flat} /></b></span>
        <span><i className="down" /> Turun <b><CountNum value={counts.down} /></b></span>
        <span><i className="none" /> Belum ada data <b><CountNum value={counts.none} /></b></span>
      </div>
    </div>
    <div className="pulse-grid">
      {rows.map(({ name, s }, i) => <a key={name} href="/peta" className={`pulse-card tone-${s ? toneOf(s.change) : 'none'} ${state.status === 'loading' ? 'is-loading' : ''}`} style={{ '--i': i }}>
        <div className="pulse-top"><FoodIcon name={name} /><b>{name}</b>{s ? <ChangePill change={s.change} /> : null}</div>
        <strong className="pulse-price">{s ? <CountRp value={s.price} suffix={<small>/{unitOf(data, name)}</small>} /> : state.status === 'loading' ? <span className="skeleton" /> : <small className="muted">{NO_DATA}</small>}</strong>
        <Sparkline points={s?.points} tone={s ? toneOf(s.change) : 'flat'} />
        <span className="pulse-foot">{s ? `${formatDateLong(s.firstDate)} – ${formatDateLong(s.date)}` : (data?.commodities?.[name]?.reason || 'Memuat…')}</span>
      </a>)}
    </div>
    <p className="section-source"><SourceNote data={data} /></p>
  </section>;
}


const RANK_ITEMS = ['Beras medium', 'Cabai merah', 'Bawang merah', 'Telur ayam', 'Daging ayam ras', 'Minyak goreng'];
export function ProvinceRanking({ regions }) {
  const [commodity, setCommodity] = React.useState(RANK_ITEMS[0]);
  const [jenis, setJenis] = React.useState('tradisional');
  const [order, setOrder] = React.useState('murah');
  const state = usePrices(jenis, '7 hari');
  const data = state.data;
  const all = regions.map(name => ({ name, s: statOf(data, commodity, name) })).filter(r => r.s);
  const missing = regions.length - all.length;
  const sorted = [...all].sort((a, b) => order === 'murah' ? a.s.price - b.s.price : b.s.price - a.s.price).slice(0, 10);
  const nat = statOf(data, commodity, 'Indonesia');
  const max = all.length ? Math.max(...all.map(r => r.s.price)) : 1;
  return <section className="province-ranking">
    <div className="section-head">
      <div><p className="section-kicker">Peringkat provinsi</p><h2>Di mana harga paling {order === 'murah' ? 'terjangkau' : 'tinggi'}?</h2><p className="section-sub">10 provinsi dengan harga {order === 'murah' ? 'terendah' : 'tertinggi'} pada data terakhir. Garis putus-putus menandai rata-rata nasional.</p></div>
      <div className="section-controls">
        <Segmented label="Urutan" options={[{ value: 'murah', label: 'Termurah' }, { value: 'mahal', label: 'Termahal' }]} value={order} onChange={setOrder} />
        <Segmented label="Jenis tempat" options={PLACE_OPTS} value={jenis} onChange={setJenis} />
      </div>
    </div>
    <div className="rank-tabs" role="tablist" aria-label="Komoditas">
      {RANK_ITEMS.map(n => <button key={n} type="button" role="tab" aria-selected={commodity === n} className={commodity === n ? 'on' : ''} onClick={() => setCommodity(n)}><FoodIcon name={n} />{n}</button>)}
    </div>
    <div className="rank-board">
      {state.status === 'loading' && <p className="data-status loading"><span className="data-status-dot" />Memuat data provinsi…</p>}
      {data && !sorted.length && <p className="no-data-note">{NO_DATA} untuk {commodity}.</p>}
      <ol className="rank-list" key={`${commodity}-${jenis}-${order}`}>
        {sorted.map((r, i) => {
          const diff = nat ? ((r.s.price - nat.price) / nat.price) * 100 : null;
          return <li key={r.name} style={{ '--i': i }}>
            <span className="rank-no">{String(i + 1).padStart(2, '0')}</span>
            <span className="rank-name">{r.name}</span>
            <span className="rank-track"><span className="rank-fill" style={{ '--w': `${(r.s.price / max) * 100}%` }} />{nat && <span className="rank-nat" style={{ left: `${(nat.price / max) * 100}%` }} />}</span>
            <span className="rank-val"><CountRp value={r.s.price} /><small className={diff == null ? '' : diff < 0 ? 'negative' : 'positive'}>{diff == null ? '' : `${pct(diff)} vs nasional`}</small></span>
          </li>;
        })}
      </ol>
      <div className="rank-foot"><span>Rata-rata nasional: <b>{nat ? rp(nat.price) + '/' + unitOf(data, commodity) : '—'}</b></span><span>{missing > 0 ? `${missing} provinsi belum ada data` : ''}</span><SourceNote data={data} /></div>
    </div>
  </section>;
}


export function BannerStats({ items }) {
  return <div className="banner-stats">{items.map(it => <div key={it.label} className={`banner-stat ${it.tone || ''}`}><strong>{typeof it.value === 'number' ? <CountNum value={it.value} /> : it.value}</strong><span>{it.label}</span></div>)}</div>;
}
