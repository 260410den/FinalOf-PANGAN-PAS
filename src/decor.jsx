import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Wheat, Package, Candy, Droplets, Egg, Drumstick, Beef, Carrot, Sprout, Flame, Popcorn, Leaf } from 'lucide-react';


function wavePath(y, amp, period, width) {
  let d = `M0 ${y} Q ${period / 4} ${y - amp} ${period / 2} ${y}`;
  for (let x = period; x <= width; x += period / 2) d += ` T ${x} ${y}`;
  return d;
}
const ORNAMENT = [62, 58, 64, 55, 60, 48, 52, 44, 50, 40, 46, 36, 42, 30, 38, 28, 34, 24];
function ornamentPath(w, h, top = 0.25, span = 0.55) {
  const step = w / (ORNAMENT.length - 1);
  return ORNAMENT.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)} ${(h * top + (v / 70) * h * span).toFixed(1)}`).join(' ');
}


export function LineScape({ className = '', variant = 'banner' }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const W = 1200, H = 400;
  const line = ornamentPath(W, H, variant === 'hero' ? 0.3 : 0.2, 0.6);
  return <div className={`linescape ls-${variant} ${className}`} aria-hidden="true">
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" focusable="false">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b9f0c4" stopOpacity=".38" /><stop offset="1" stopColor="#b9f0c4" stopOpacity="0" /></linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#d6ffd9" stopOpacity="0" /><stop offset=".25" stopColor="#d6ffd9" stopOpacity=".9" /><stop offset="1" stopColor="#ffffff" stopOpacity=".95" /></linearGradient>
        <pattern id={`${id}g`} width="60" height="50" patternUnits="userSpaceOnUse"><path d="M60 0H0V50" fill="none" stroke="#ffffff" strokeOpacity=".07" strokeWidth="1" /></pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}g)`} />
      <g className="ls-waves">
        <path className="ls-wave w1" d={wavePath(300, 26, 300, W * 2)} />
        <path className="ls-wave w2" d={wavePath(330, 18, 400, W * 2)} />
        <path className="ls-wave w3" d={wavePath(270, 34, 600, W * 2)} />
      </g>
      <path className="ls-area" d={`${line} L${W} ${H} L0 ${H} Z`} fill={`url(#${id}a)`} />
      <path className="ls-line" d={line} stroke={`url(#${id}s)`} pathLength="1000" />
      <path className="ls-pulse" d={line} pathLength="1000" />
      {[0.33, 0.66, 1].map((t, i) => {
        const idx = Math.round(t * (ORNAMENT.length - 1)), x = (idx * W) / (ORNAMENT.length - 1);
        const y = H * (variant === 'hero' ? 0.3 : 0.2) + (ORNAMENT[idx] / 70) * H * 0.6;
        return <circle key={i} className={`ls-dot d${i}`} cx={x - (t === 1 ? 6 : 0)} cy={y} r="5" />;
      })}
    </svg>
  </div>;
}

export function RiceWorld({ className = '', compact = false }) { return <LineScape className={className} variant={compact ? 'banner' : 'hero'} />; }
export function PageBanner() { return <div className="page-banner" aria-hidden="true"><LineScape variant="banner" /></div>; }

export function FooterField({ className = '' }) {
  return <div className={`footer-field ${className}`} aria-hidden="true">
    <svg viewBox="0 0 2400 80" preserveAspectRatio="none" focusable="false">
      <g className="ff-waves">
        <path className="ff-wave a" d={wavePath(44, 14, 300, 2400)} />
        <path className="ff-wave b" d={wavePath(52, 10, 400, 2400)} />
      </g>
    </svg>
  </div>;
}


export function Ambient() {
  return <div className="ambient" aria-hidden="true">
    <span className="amb-glow g1" /><span className="amb-glow g2" />
    <span className="amb-grid" />
    <svg className="amb-lines" viewBox="0 0 2880 900" preserveAspectRatio="none" focusable="false">
      <g className="amb-flow f1"><path d={wavePath(180, 40, 480, 2880)} /><path d={wavePath(210, 26, 360, 2880)} /></g>
      <g className="amb-flow f2"><path d={wavePath(640, 46, 720, 2880)} /><path d={wavePath(690, 24, 480, 2880)} /></g>
      <path className="amb-trace" d={wavePath(420, 60, 960, 2880)} pathLength="1000" />
      <path className="amb-trace t2" d={wavePath(760, 40, 720, 2880)} pathLength="1000" />
    </svg>
    <div className="amb-icons">
      {FLOATERS.map(([Icon, x, y, s, d, r], i) => <span key={i} className="amb-icon" style={{ left: `${x}%`, top: `${y}%`, '--s': `${s}px`, '--dur': `${d}s`, '--rot': `${r}deg`, '--delay': `${-i * 2.3}s` }}><Icon strokeWidth={1.1} /></span>)}
    </div>
  </div>;
}
const FLOATERS = [
  [Wheat, 6, 14, 84, 19, -12], [Egg, 88, 10, 58, 23, 10], [Flame, 72, 42, 64, 21, -8], [Carrot, 14, 58, 70, 25, 14],
  [Sprout, 46, 78, 62, 20, -6], [Drumstick, 92, 70, 66, 24, 12], [Droplets, 32, 30, 52, 22, 6], [Popcorn, 58, 8, 56, 26, -10],
  [Package, 4, 88, 60, 23, 8], [Leaf, 80, 92, 72, 21, -14],
];


export function WordBand({ items = [] }) {
  const words = items.length ? items : Object.keys(ICONS);
  const ref = React.useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const xA = useTransform(scrollYProgress, [0, 1], [0, -400]);
  const xB = useTransform(scrollYProgress, [0, 1], [-400, 0]);
  const row = (rev) => <div className={`wb-row${rev ? ' rev' : ''}`}><motion.div className="wb-shift" style={{ x: rev ? xB : xA }}><div className="wb-track">
    {[0, 1].map(k => <span key={k} className="wb-set">{(rev ? [...words].reverse() : words).map(w => <span key={w} className="wb-word">{w}<i>✦</i></span>)}</span>)}
  </div></motion.div></div>;
  return <div className="word-band" ref={ref} aria-hidden="true">{row(false)}{row(true)}</div>;
}

const SPOT = '.pulse-card,.hero-insight,.bento-map,.landing-proof>div,.about-step,.about-products,.reading-card,.data-context,.panel,.market-option,.trend-index-card,.trend-chart-card,.commodity-row,.community-submission,.compare-side,.favorite-card,.rank-board,.assistant-side-panel,.map-panel,.trends-filter,.community-feed,.community-form-panel';
export function InteractionLayer() {
  const bar = React.useRef(null);
  React.useEffect(() => {
    let raf = 0, ev = null, current = null;
    const move = () => {
      raf = 0;
      const el = ev?.target instanceof Element ? ev.target.closest(SPOT) : null;
      if (current && current !== el) current.classList.remove('is-lit');
      current = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${ev.clientX - r.left}px`);
      el.style.setProperty('--my', `${ev.clientY - r.top}px`);
      el.classList.add('is-lit');
    };
    const onMove = e => { ev = e; if (!raf) raf = requestAnimationFrame(move); };
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);
  return <div className="read-progress" aria-hidden="true"><span ref={bar} /></div>;
}
export function FieldEdge() { return null; }
export function Garnish() { return null; }


const ICONS = {
  'Beras medium': [Wheat, 'leaf'], 'Beras premium': [Package, 'leaf'], 'Gula pasir': [Candy, 'sky'],
  'Minyak goreng': [Droplets, 'sun'], 'Telur ayam': [Egg, 'sun'], 'Daging ayam ras': [Drumstick, 'coral'],
  'Daging sapi': [Beef, 'coral'], 'Bawang merah': [Carrot, 'ube'], 'Bawang putih': [Sprout, 'sky'],
  'Cabai merah': [Flame, 'coral'], 'Cabai rawit merah': [Flame, 'coral'], 'Jagung pipilan': [Popcorn, 'sun'],
};
export function FoodIcon({ name, className = '' }) {
  const [Icon, tint] = ICONS[name] || [Leaf, 'leaf'];
  return <span className={`food-icon tint-${tint} ${className}`} aria-hidden="true"><Icon size={20} strokeWidth={1.8} /></span>;
}


export function FoodMarquee({ items = [] }) {
  return <div className="food-marquee is-slim" aria-hidden="true"><div className="marquee-row"><div className="marquee-track">
    {[...items, ...items].map((name, i) => <span key={i} className="marquee-chip"><FoodIcon name={name} /><b>{name}</b></span>)}
  </div></div></div>;
}


export function FarmerAvatar({ className = '' }) {
  return <span className={`emblem ${className}`} aria-hidden="true"><span className="emblem-ring" /><span className="emblem-core"><Wheat size={34} strokeWidth={1.6} /></span></span>;
}

export function Squiggle({ className = '' }) {
  return <svg className={`squiggle ${className}`} viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M4 14 C 30 2 52 22 78 12 S 128 2 154 12 S 204 22 230 12 S 280 4 296 12" /></svg>;
}


const SR = [
  '.bento-map', '.about-heading', '.commodity-tags>span', '.about-note', '.reading-footnote',
  '.map-panel', '.assistant-side-panel', '.market-compare', '.market-option', '.overall-panel', '.regional-prices-panel', '.region-insight-panel', '.commodity-row',
  '.trends-filter', '.trend-section-heading', '.trend-index-card', '.trend-chart-card', '.trend-detail-panel', '.trends-note',
  '.community-feed', '.community-submission', '.community-form-panel', '.community-boundary', '.community-empty', '.brand-footer-main',
].join(',');
export function ScrollReveal() {
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('sr-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: .06 });
    const seen = new WeakSet();
    const scan = () => {
      document.querySelectorAll(SR).forEach(el => {
        if (seen.has(el)) return;
        seen.add(el);
        const idx = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
        el.style.setProperty('--sr-i', String(Math.min(idx % 6, 5)));
        el.classList.add('sr');
        io.observe(el);
      });
    };
    scan();
    let raf = 0;
    const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; scan(); }); });
    const root = document.getElementById('root');
    if (root) mo.observe(root, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return null;
}

