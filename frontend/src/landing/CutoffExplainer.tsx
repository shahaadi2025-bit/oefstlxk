import { useState } from "react";

// WINDFOR publication times (UTC) observed in the data.
const RUNS: [number, number][] = [[2, 30], [4, 30], [7, 30], [9, 30], [11, 30], [15, 30], [18, 30], [22, 30]];
const hm = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

/** Interactive explainer of the core rule: only forecast runs published before the cutoff can be used. */
export default function CutoffExplainer() {
  const [cut, setCut] = useState(9);
  const usable = RUNS.filter(([h, m]) => h * 60 + m <= cut * 60);
  const latest = usable[usable.length - 1];
  const late = RUNS.length - usable.length;
  const pct = (h: number, m = 0) => ((h + m / 60) / 24) * 100;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md md:p-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.14em] text-[#c8ff3e] uppercase">Try it</p>
          <h3 className="mt-1 text-2xl font-semibold md:text-3xl">When does your desk decide?</h3>
        </div>
        <label className="flex items-center gap-3 text-sm text-white/70">
          Cutoff (UTC, day before delivery)
          <input
            type="range"
            min={6}
            max={18}
            step={1}
            value={cut}
            onChange={(e) => setCut(+e.target.value)}
            aria-label="Decision cutoff hour in UTC"
            className="w-40 accent-[#c8ff3e] md:w-56"
          />
          <output className="w-14 text-right font-semibold text-white">{String(cut).padStart(2, "0")}:00</output>
        </label>
      </div>

      <div className="relative mx-3 h-24" role="img" aria-label={`Timeline of the day before delivery with ${RUNS.length} forecast runs and a cutoff at ${cut}:00 UTC`}>
        <div className="absolute top-10 right-0 left-0 h-px bg-white/20" />
        {[0, 6, 12, 18, 24].map((h) => (
          <div key={h} className="absolute top-12 -translate-x-1/2 text-[11px] text-white/60" style={{ left: `${pct(h)}%` }}>
            {String(h % 24).padStart(2, "0")}:00
          </div>
        ))}
        <div className="absolute top-2 bottom-5 w-px bg-[#ffb020] transition-[left] duration-300" style={{ left: `${pct(cut)}%` }}>
          <span className="absolute -top-1 left-2 text-[11px] font-medium whitespace-nowrap text-[#ffb020]">cutoff</span>
        </div>
        {RUNS.map(([h, m]) => {
          const ok = h * 60 + m <= cut * 60;
          const isLatest = latest && latest[0] === h && latest[1] === m;
          return (
            <div
              key={`${h}${m}`}
              className="absolute top-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
              style={{ left: `${pct(h, m)}%` }}
              title={`${hm(h, m)} run${ok ? "" : " (too late)"}`}
            >
              <div
                className={
                  "rounded-full transition-all duration-300 " +
                  (isLatest ? "size-5 bg-[#c8ff3e] shadow-[0_0_24px_6px_rgba(200,255,62,0.55)]" : ok ? "size-3 bg-[#c8ff3e]/70" : "size-3 bg-white/20")
                }
              />
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-lg text-white/85" aria-live="polite">
        {latest ? (
          <>
            The latest run you can use is <strong className="text-[#c8ff3e]">{hm(latest[0], latest[1])}</strong>.
          </>
        ) : (
          <>No run has been published yet at this cutoff.</>
        )}{" "}
        {late > 0 ? (
          <span className="text-white/60">
            {late} later {late === 1 ? "run arrives" : "runs arrive"} too late and {late === 1 ? "is" : "are"} ignored, because using {late === 1 ? "it" : "them"} would be look-ahead.
          </span>
        ) : null}
      </p>
    </div>
  );
}
