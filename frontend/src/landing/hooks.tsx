import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { api } from "../api.js";

export type DayRow = { t: string; forecast: number; actual: number | null; lo: number | null; hi: number | null };
export type Stats = {
  acc: {
    summary: { mae: number; bias: number; p90_abs_error: number; n: number };
    baseline?: { skill_score: number };
    by_hour: { hour: number; mae: number }[];
  };
  day: { rows: DayRow[] };
  demo: boolean;
};

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Polls the API until the data is ready (the first request can take a few seconds), then loads the headline numbers. */
export function useLiveStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    let tries = 0;
    const go = async () => {
      try {
        const h = await api("/api/health");
        if (h.status === "ready") {
          const [acc, day] = await Promise.all([
            api("/api/accuracy?cutoff_hour=9"),
            api("/api/decision?date=2026-01-15&cutoff_hour=9"),
          ]);
          if (live) setStats({ acc, day, demo: !!h.demo_data });
          return;
        }
      } catch {
        /* retry below */
      }
      if (!live) return;
      if (++tries < 25) setTimeout(go, 1500);
      else setFailed(true);
    };
    go();
    return () => {
      live = false;
    };
  }, []);
  return { stats, failed };
}

/** Fades content in when it scrolls into view. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ "--d": `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

/** Counts up to `value` the first time it is visible. */
export function Counter({ value, decimals = 0 }: { value: number | null | undefined; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || value == null) return undefined;
    let raf = 0;
    const run = () => {
      if (reducedMotion()) return setV(value);
      const t0 = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / 1300);
        setV(value * (1 - Math.pow(1 - k, 3)));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        run();
        io.disconnect();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);
  if (value == null) return <span ref={ref}>–</span>;
  return <span ref={ref}>{decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString("en-GB")}</span>;
}
