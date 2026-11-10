import React from 'react';
import { motion, useInView, animate } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

export const EASE_OUT = [0.16, 1, 0.3, 1];
export const EASE_SNAP = [0.4, 0, 0.2, 1];
export const EASE_TREE = [0.25, 1, 0.5, 1];
export const EASE_SPRING = [0.175, 0.885, 0.32, 1.275];


export function heroIn(step, { y = 30, scale } = {}) {
  return {
    initial: { opacity: 0, y, ...(scale ? { scale } : {}) },
    animate: { opacity: 1, y: 0, ...(scale ? { scale: 1 } : {}) },
    transition: { duration: 0.6, delay: step * 0.1, ease: EASE_OUT },
  };
}


export function PingNode({ i = 0, left, top, tone = '' }) {
  return <motion.span className="ping-node" style={{ left, top }} aria-hidden="true"
    initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.6 }}
    transition={{ duration: 0.8, delay: 0.2 + i * 0.15, ease: 'easeOut' }}>
    <span className={`map-ping ${tone}`.trim()} />
  </motion.span>;
}


export const featureList = { hidden: {}, show: { transition: { staggerChildren: 0.2 } } };
export const featureItem = { hidden: { opacity: 0, y: 50 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } } };


export const treeLine = { hidden: { pathLength: 0, opacity: 0 }, show: { pathLength: 1, opacity: 1, transition: { duration: 0.7, ease: EASE_TREE } } };
export const treeNode = (level, i = 0) => ({
  hidden: { opacity: 0, y: 20, scale: 0.8 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, delay: level * 0.2 + i * 0.06, ease: EASE_TREE } },
});
export function WorkflowLines() {
  const stroke = { fill: 'none', strokeWidth: 1.6, vectorEffect: 'non-scaling-stroke', strokeLinecap: 'round' };
  return <>
    <svg className="workflow-lines wf-top" viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <motion.path variants={treeLine} d="M300 0V20M100 40V20H500V40M300 20V40" {...stroke} />
    </svg>
    <svg className="workflow-lines wf-bottom" viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <motion.path variants={treeLine} d="M100 0V20H500V0M300 20V40" {...stroke} />
    </svg>
  </>;
}


export function DarkScene({ as = 'section', className = '', children, ...rest }) {
  const ref = React.useRef(null);
  const inView = useInView(ref, { margin: '-38% 0px -38% 0px' });
  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('scene-dark', inView);
    return () => root.classList.remove('scene-dark');
  }, [inView]);
  const Tag = motion[as];
  return <Tag ref={ref} className={className} {...rest}>{children}</Tag>;
}

export function RollingCounter({ value, suffix = '', label }) {
  const ref = React.useRef(null);
  const num = React.useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  React.useEffect(() => {
    if (!inView || !num.current) return;
    const ctrl = animate(0, value, {
      duration: 1.2, ease: 'easeInOut',
      onUpdate: v => { if (num.current) num.current.textContent = Math.round(v).toLocaleString('id-ID'); },
    });
    return () => ctrl.stop();
  }, [inView, value]);
  return <div ref={ref} className="tw:flex tw:flex-col tw:gap-1">
    <motion.strong className="dc-count tw:block tw:origin-left"
      animate={inView ? { scale: [1, 1.05, 1] } : { scale: 1 }} transition={{ duration: 1.2, ease: 'easeInOut' }}>
      <span ref={num}>0</span>{suffix}
    </motion.strong>
    <span className="tw:text-[12.5px] tw:font-semibold tw:tracking-wide tw:opacity-75">{label}</span>
  </div>;
}


export const badgeIn = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_SPRING } } };
export const springList = { hidden: {}, show: { transition: { staggerChildren: 0.15 } } };
export const springItem = { hidden: { opacity: 0, y: 60 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_SPRING } } };


export const ctaIn = {
  initial: { opacity: 0, scale: 0.95 },
  whileInView: { opacity: 1, scale: 1 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.5, ease: 'easeInOut' },
};
export function BackToTop() {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const on = () => setShow(window.scrollY > Math.max(600, (document.documentElement.scrollHeight - innerHeight) * 0.55));
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const toTop = () => {
    const ctrl = animate(window.scrollY, 0, { duration: 1, ease: 'easeInOut', onUpdate: v => window.scrollTo(0, v) });
    const stop = () => ctrl.stop();
    window.addEventListener('wheel', stop, { once: true, passive: true });
    window.addEventListener('touchstart', stop, { once: true, passive: true });
  };
  return <motion.button type="button" onClick={toTop} aria-label="Kembali ke atas" tabIndex={show ? 0 : -1}
    className="back-to-top tw:fixed tw:right-5 tw:bottom-6 tw:z-[95] tw:flex tw:items-center tw:gap-2 tw:rounded-full tw:border-0 tw:px-4 tw:py-3 tw:text-[13px] tw:font-bold tw:shadow-lg tw:cursor-pointer tw:max-[1080px]:bottom-24"
    initial={false} animate={show ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 16, scale: 0.9 }}
    transition={{ duration: 0.35, ease: EASE_OUT }} style={{ pointerEvents: show ? 'auto' : 'none' }}
    whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}>
    <ArrowUp size={16} /> <span className="tw:max-sm:hidden">Kembali ke atas</span>
  </motion.button>;
}
