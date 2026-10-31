import { ArrowRight, Check } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AeroHero } from "@/components/ui/aero-hero";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import SylvaWindHero from "@/components/ui/sylva-wind-hero";

import { Logo, WindField } from "../Hero.jsx";
import WindScene from "../WindScene";
import CutoffExplainer from "./CutoffExplainer";
import { SkipLink } from "../ui.jsx";
import { Counter, Reveal, useLiveStats, type DayRow, type Stats } from "./hooks";

const go = (hash: string) => {
  window.location.hash = hash;
};
const scrollToId = (id: string) =>
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });

/* ---------- live chart (plain SVG, no chart library) ---------- */
function DayChart({ rows }: { rows: DayRow[] }) {
  const W = 880, H = 320, L = 52, R = 14, T = 14, B = 28;
  const vals = rows.flatMap((r) => [r.forecast, r.actual ?? r.forecast, r.lo ?? r.forecast, r.hi ?? r.forecast]);
  const min = Math.min(...vals) * 0.96;
  const max = Math.max(...vals) * 1.04;
  const x = (i: number) => L + (i / Math.max(rows.length - 1, 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const path = (f: (r: DayRow) => number | null) =>
    rows.map((r, i) => { const v = f(r); return v == null ? "" : `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`; }).join(" ");
  const hasBand = rows.every((r) => r.lo != null && r.hi != null);
  const band = hasBand
    ? rows.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(r.hi as number).toFixed(1)}`).join(" ") +
      [...rows].reverse().map((r, j) => ` L${x(rows.length - 1 - j).toFixed(1)} ${y(r.lo as number).toFixed(1)}`).join("") + " Z"
    : "";
  const yt = [0, 1, 2, 3].map((k) => min + ((max - min) * k) / 3);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Forecast at cutoff versus actual wind generation for 15 January 2026">
      {yt.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#ffffff" strokeOpacity="0.08" strokeDasharray="2 5" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#7d8a9c">{(v / 1000).toFixed(1)}k</text>
        </g>
      ))}
      {[0, 6, 12, 18, 23].map((i) => rows[i] && <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#7d8a9c">{rows[i].t.slice(11, 16)}</text>)}
      {band && <path d={band} fill="#c8ff3e" fillOpacity="0.13" />}
      <path d={path((r) => r.actual)} fill="none" stroke="#5ad1ff" strokeWidth="2" strokeDasharray="6 5" />
      <path d={path((r) => r.forecast)} fill="none" stroke="#c8ff3e" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- small building blocks ---------- */
const Eyebrow = ({ children }: { children: ReactNode }) => (
  <p className="text-xs font-semibold tracking-[0.16em] text-[#c8ff3e] uppercase">{children}</p>
);
const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className="mt-3 text-3xl leading-tight font-semibold tracking-tight text-balance md:text-5xl">{children}</h2>
);
const Section = ({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) => (
  <section id={id} className={`mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20 md:py-28 ${className}`}>{children}</section>
);

function FeatureCard({ tab, title, text, children, wide = false }: { tab: string; title: string; text: string; children: ReactNode; wide?: boolean }) {
  return (
    <Reveal className={wide ? "md:col-span-2" : ""}>
      <a
        href={`#app/${tab}`}
        className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-[#c8ff3e]/40 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c8ff3e]"
      >
        <div className="mb-5 h-36 overflow-hidden rounded-2xl border border-white/5 bg-black/30">{children}</div>
        <h3 className="flex items-center gap-2 text-xl font-semibold">
          {title}
          <ArrowRight className="size-4 -translate-x-1 text-[#c8ff3e] opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-white/65">{text}</p>
      </a>
    </Reveal>
  );
}

/* tiny CSS/SVG visuals for the feature cards */
const SparkVisual = ({ rows }: { rows?: DayRow[] }) => {
  const pts = rows?.length ? rows.map((r) => r.forecast) : [5, 6, 5.5, 7, 6.2, 8, 7.4, 6, 6.8, 7.9, 7.1, 6.5];
  const min = Math.min(...pts), max = Math.max(...pts);
  const d = pts.map((v, i) => `${i ? "L" : "M"}${(i / (pts.length - 1)) * 300} ${100 - ((v - min) / Math.max(max - min, 1)) * 70 - 10}`).join(" ");
  return <svg viewBox="0 0 300 110" className="size-full" preserveAspectRatio="none" aria-hidden="true"><path d={`${d} L300 110 L0 110 Z`} fill="#c8ff3e" fillOpacity="0.1" /><path d={d} fill="none" stroke="#c8ff3e" strokeWidth="2.5" /></svg>;
};
const BarsVisual = ({ bars }: { bars?: number[] }) => {
  const b = bars?.length ? bars : [5, 7, 4, 8, 6, 9, 7, 5, 8, 6, 7, 9];
  const max = Math.max(...b);
  return <div className="flex size-full items-end gap-1 px-4 pb-3" aria-hidden="true">{b.map((v, i) => <div key={i} className="flex-1 rounded-t bg-[#c8ff3e]/80" style={{ height: `${(v / max) * 85}%` }} />)}</div>;
};
const WheelVisual = () => (
  <div className="relative size-full [perspective:420px]" aria-hidden="true">
    {[-1, 0, 1].map((k) => (
      <div key={k} className="absolute top-1/2 left-1/2 h-14 w-24 rounded-lg border border-white/10 bg-gradient-to-b from-[#182230] to-[#0a0e14]"
        style={{ transform: `translate(-50%, -50%) translateY(${k * 34}px) rotateX(${k * -38}deg) translateZ(${k === 0 ? 20 : -10}px)`, opacity: k === 0 ? 1 : 0.55 }}>
        <svg viewBox="0 0 96 56" className="size-full p-2"><path d="M0 40 L16 28 L30 36 L46 14 L62 30 L80 18 L96 26" fill="none" stroke="#c8ff3e" strokeWidth="2" /></svg>
      </div>
    ))}
  </div>
);
const StepsVisual = () => (
  <svg viewBox="0 0 300 110" className="size-full" preserveAspectRatio="none" aria-hidden="true">
    <path d="M10 70 H60 V30 H110 V80 H160 V45 H210 V60 H260 V40 H290" fill="none" stroke="#c8ff3e" strokeWidth="2.5" />
    <line x1="190" x2="190" y1="8" y2="104" stroke="#ffb020" strokeWidth="1.5" /><line x1="10" x2="290" y1="55" y2="55" stroke="#5ad1ff" strokeDasharray="5 4" />
  </svg>
);
const CheckVisual = () => (
  <ul className="flex size-full flex-col justify-center gap-2 px-5 text-sm text-white/75" aria-hidden="true">
    {["744 hours expected", "Every hour has an actual", "Forecast available at cutoff"].map((t) => (
      <li key={t} className="flex items-center gap-2"><Check className="size-4 text-[#c8ff3e]" />{t}</li>
    ))}
  </ul>
);
const CoverVisual = () => (
  <div className="flex size-full items-center justify-center gap-2 px-4" aria-hidden="true">
    {["80%", "90%", "95%", "99%"].map((c, i) => <div key={c} className="rounded-full border border-white/15 px-3 py-1.5 text-sm" style={{ background: i === 2 ? "#c8ff3e" : "transparent", color: i === 2 ? "#07090c" : "#ffffffb3" }}>{c}</div>)}
  </div>
);

const FAQ: [string, string][] = [
  ["Where does the data come from?", "Elexon's BMRS Insights API: FUELHH for actual wind generation (half-hourly, averaged to hours here) and WINDFOR for the hourly wind forecast, which is published about eight times a day. No other data is used."],
  ["Why hourly?", "WINDFOR forecasts are hourly while FUELHH actuals are half-hourly, so everything is compared on the hour. Hours missing a half-hour are excluded and shown on the Data quality tab."],
  ["Which cutoff does it assume?", "09:00 UTC on the day before delivery by default. The brief gives the day-ahead timing but not the exact time, so the cutoff is adjustable (06:00 to 18:00) to match your real gate closure."],
  ["Is this trading advice?", "No. The cover calculator is illustrative: it assumes flat demand and treats the historical over-forecast at a chosen confidence as the wind shortfall to insure."],
  ["Can the forecast definition differ from the outturn?", "Yes. Elexon describes WINDFOR as a peak-generation forecast while FUELHH is average outturn, so part of any bias can come from the definitions rather than the weather."],
];

export default function Landing() {
  const { stats, failed } = useLiveStats();
  const [noGl, setNoGl] = useState(false);
  const s: Stats | null = stats;
  const m = s?.acc.summary;

  const chips: [ReactNode, string][] = [
    [<Counter key="d" value={31} />, "delivery days"],
    [<Counter key="h" value={m?.n ?? 744} />, "hours evaluated"],
    [m ? <><Counter value={m.mae} /> MW</> : "– MW", "mean forecast error"],
  ];

  return (
    <div className="landing bg-[#07090c] text-white">
      <SkipLink />
      {/* nav */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#07090c]/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="#" className="flex items-center gap-2.5 font-[family-name:var(--display)] text-lg font-bold" aria-label="WindDesk home"><Logo size={28} /> WindDesk</a>
          <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex" aria-label="Sections">
            {[["how", "How it works"], ["features", "Features"], ["proof", "Live numbers"], ["method", "Method"]].map(([id, label]) => (
              <button key={id} type="button" onClick={() => scrollToId(id)} className="cursor-pointer transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-[#c8ff3e]">{label}</button>
            ))}
          </nav>
          <LiquidButton size="default" onClick={() => go("app")}>Open dashboard</LiquidButton>
        </div>
      </header>

      <main id="content">
      <AeroHero
        kicker="UK day-ahead · Elexon BMRS · decisions made in January 2026"
        title={<>Wind risk, <span className="bg-gradient-to-r from-[#c8ff3e] via-[#a8ffb0] to-[#5ad1ff] bg-clip-text text-transparent">priced into</span> the day‑ahead buy.</>}
        description="WindDesk shows the exact wind forecast your desk had at the cutoff, measures how wrong it has been, and sizes the cover that implies."
        ctaLabel="Open the dashboard"
        onCta={() => go("app")}
        secondaryLabel="See how it works"
        onSecondary={() => scrollToId("how")}
        background={noGl ? <div className="absolute inset-0 bg-gradient-to-b from-[#0b1824] to-[#1f4140]"><WindField /></div> : <WindScene onFallback={() => setNoGl(true)} />}
        footer={
          <ul className="mx-auto flex max-w-3xl flex-wrap items-stretch justify-center gap-3">
            {chips.map(([v, l]) => (
              <li key={l} className="min-w-36 rounded-2xl border border-white/10 bg-black/30 px-5 py-3 backdrop-blur-md">
                <div className="font-[family-name:var(--display)] text-2xl font-semibold text-white">{v}</div>
                <div className="text-xs text-white/70">{l}</div>
              </li>
            ))}
          </ul>
        }
      />

      {/* how it works */}
      <Section id="how">
        <Reveal><Eyebrow>How it works</Eyebrow><H2>Only use what you knew when you decided.</H2>
          <p className="mt-4 max-w-2xl text-lg text-white/65">Day-ahead power is bought the day before delivery. WINDFOR publishes a fresh forecast several times a day, so the question is which run your desk could actually see.</p></Reveal>
        <div className="mt-10"><Reveal delay={100}><CutoffExplainer /></Reveal></div>
      </Section>

      {/* features */}
      <Section id="features">
        <Reveal><Eyebrow>Inside the dashboard</Eyebrow><H2>Six views, one question: how much can you trust the forecast?</H2></Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <FeatureCard wide tab="decision" title="Decision day" text="24 hours of the forecast available at the cutoff, with its publish time and a P10–P90 range from errors known before that day. Export it as CSV."><SparkVisual rows={s?.day.rows} /></FeatureCard>
          <FeatureCard tab="decision" title="Cover calculator" text="Extra MWh to buy at 80, 90, 95 or 99% confidence for a demand level you choose."><CoverVisual /></FeatureCard>
          <FeatureCard tab="month" title="Month browser" text="A 3D wheel of all 31 delivery days. Turn it, then open any day."><WheelVisual /></FeatureCard>
          <FeatureCard tab="accuracy" title="Accuracy" text="MAE, RMSE, bias, P90 and P99, by hour, by wind level and by hours ahead, plus a naive benchmark."><BarsVisual bars={s?.acc.by_hour.map((h) => h.mae)} /></FeatureCard>
          <FeatureCard tab="revisions" title="Forecast revisions" text="Watch one hour's forecast change run by run, with the cutoff marked."><StepsVisual /></FeatureCard>
        </div>
        <div className="mt-5"><Reveal><a href="#app/quality" className="group flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md transition hover:border-[#c8ff3e]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c8ff3e]">
          <div><h3 className="text-xl font-semibold">Data quality, shown openly</h3><p className="mt-1 text-sm text-white/65">Missing actuals, hours without a usable forecast and the publish range are always visible.</p></div>
          <div className="h-16 w-72 overflow-hidden"><CheckVisual /></div></a></Reveal></div>
      </Section>

      {/* live numbers */}
      <Section id="proof">
        <Reveal><Eyebrow>Live numbers</Eyebrow><H2>{s?.demo ? "Demo data, same method." : "Real Elexon data, computed live."}</H2>
          <p className="mt-4 max-w-2xl text-lg text-white/65">{failed ? "The data service did not respond. Open the dashboard to retry." : "Forecast at the 09:00 UTC cutoff versus actual outturn across every delivery day in the window."}</p></Reveal>
        <div className="mt-10 grid gap-5 lg:grid-cols-5">
          <Reveal className="lg:col-span-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur-md">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-white/60">
                <span>Thu 15 Jan, forecast at cutoff</span>
                <span className="flex gap-4"><span className="text-[#c8ff3e]">▬ Forecast</span><span className="text-white/70"><span className="text-[#c8ff3e]/50" aria-hidden="true">▮</span> P10–P90</span><span className="text-[#5ad1ff]">╌ Actual</span></span>
              </div>
              {s ? <DayChart rows={s.day.rows} /> : <div className="grid h-64 place-items-center text-white/70">{failed ? "Data unavailable" : "Loading live data…"}</div>}
            </div>
          </Reveal>
          <Reveal className="lg:col-span-2" delay={120}>
            <dl className="grid h-full grid-cols-2 gap-3">
              {([
                ["Mean absolute error", m?.mae, " MW", 0],
                ["Bias", m?.bias, " MW", 0],
                ["9 in 10 hours within", m?.p90_abs_error, " MW", 0],
                ["Skill vs naive", s?.acc.baseline ? s.acc.baseline.skill_score * 100 : null, "%", 0],
              ] as [string, number | null | undefined, string, number][]).map(([l, v, u, d]) => (
                <div key={l} className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur-md">
                  <dt className="text-xs tracking-wide text-white/70 uppercase">{l}</dt>
                  <dd className="mt-3 font-[family-name:var(--display)] text-3xl font-semibold text-[#c8ff3e]"><Counter value={v} decimals={d} /><span className="ml-1 text-base font-medium text-white/70">{u}</span></dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </Section>

      {/* method */}
      <Section id="method">
        <Reveal><Eyebrow>Method</Eyebrow><H2>Built so the numbers hold up to scrutiny.</H2></Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[["No look-ahead", "Every forecast is the latest run published at or before the cutoff on the day before delivery. Later runs are never used."],
            ["Honest error bands", "The P10–P90 range uses only errors from days before the delivery day. Early days fall back to the full window and say so."],
            ["Benchmarked", "Forecast error is compared with a naive guess (actual wind 48 hours earlier), always known on the day before."]].map(([t, d], i) => (
            <Reveal key={t} delay={i * 90}><div className="h-full rounded-3xl border border-white/10 bg-white/[0.035] p-7 backdrop-blur-md">
              <div className="mb-4 grid size-9 place-items-center rounded-full bg-[#c8ff3e] font-semibold text-black">{i + 1}</div>
              <h3 className="text-xl font-semibold">{t}</h3><p className="mt-2 text-white/65">{d}</p></div></Reveal>
          ))}
        </div>
        <div className="mt-12">
          <Reveal><h3 className="mb-4 text-xl font-semibold">Questions</h3></Reveal>
          <div className="divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-md">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-6 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium focus-visible:outline-2 focus-visible:outline-[#c8ff3e]">
                  {q}<span className="text-2xl text-[#c8ff3e] transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 max-w-3xl text-white/65">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      {/* closing scene: ThreeUI Sylva (living-green), tailored; mounts only when scrolled near */}
      <SylvaWindHero />

      </main>

      <footer className="border-t border-white/10 px-5 py-10 text-center text-sm text-white/60">
        <p>Contains BMRS data © Elexon Limited copyright and database right. Procurement figures are illustrative, not trading advice.</p>
      </footer>
    </div>
  );
}
