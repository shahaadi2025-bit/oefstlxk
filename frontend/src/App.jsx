import { useEffect, useState } from "react";
import Accuracy from "./Accuracy.jsx";
import Decision from "./Decision.jsx";
import { Logo, WindField } from "./Hero.jsx";
import Quality from "./Quality.jsx";
import Revisions from "./Revisions.jsx";
import { api, fmt, useApi } from "./api.js";
import Hive from "@/components/ui/hive";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import MonthBrowser from "./MonthBrowser.tsx";
import { Notice, Skeleton, SkipLink, Stat } from "./ui.jsx";

const TABS = [["decision", "Decision day"], ["month", "Month"], ["accuracy", "Accuracy"], ["revisions", "Revisions"], ["quality", "Data quality"]];
const CUTOFFS = [6, 8, 9, 10, 12, 15, 18];
const pad = (h) => `${String(h).padStart(2, "0")}:00`;
const TAB_KEYS = TABS.map(([k]) => k);
const tabFromHash = () => {
  const m = /^#app\/(\w+)$/.exec(window.location.hash);
  return m && TAB_KEYS.includes(m[1]) ? m[1] : null;
};
const goHome = (e) => {
  e.preventDefault();
  window.history.pushState(null, "", window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
};
const dayFromHash = () => {
  const m = /^#day=(\d{4}-\d{2}-\d{2})$/.exec(window.location.hash);
  return m ? m[1] : null;
};

export default function App() {
  const [health, setHealth] = useState({ status: "loading" });
  const [tab, setTab] = useState(() => tabFromHash() || "decision");
  const [cutoff, setCutoff] = useState(9);
  const [date, setDate] = useState("2026-01-15");

  // Deep links such as #day=2026-01-20 (used by the Month wheel) open that day's decision view.
  useEffect(() => {
    const open = () => {
      const t = tabFromHash();
      if (t) setTab(t);
      const d = dayFromHash();
      if (d) { setDate(d); setTab("decision"); window.scrollTo({ top: 0 }); }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);

  useEffect(() => {
    let t;
    const poll = () => api("/api/health")
      .then((h) => { setHealth(h); if (h.status === "loading" || h.status === "idle") t = setTimeout(poll, 1500); })
      .catch((e) => setHealth({ status: "error", error: e.message }));
    poll();
    return () => clearTimeout(t);
  }, []);

  const ready = health.status === "ready";
  const acc = useApi(ready ? `/api/accuracy?cutoff_hour=${cutoff}` : null);
  const m = acc.data?.summary;

  return (
    <>
      <SkipLink />
      <header className="top">
        <div className="top-in">
          <a className="brand" href="#" onClick={goHome} aria-label="WindDesk home"><Logo /><span>WindDesk</span></a>
          {ready && (
            <nav role="tablist" aria-label="Views">
              {TABS.map(([k, v]) => (
                <button key={k} role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls="panel" onClick={() => setTab(k)}>{v}</button>
              ))}
            </nav>
          )}
          {ready && (
            <label className="cutoff">
              <span>Decision cutoff</span>
              <select value={cutoff} onChange={(e) => setCutoff(+e.target.value)} aria-label="Decision cutoff, UTC hour on the day before delivery">
                {CUTOFFS.map((h) => <option key={h} value={h}>{pad(h)} UTC · D-1</option>)}
              </select>
            </label>
          )}
        </div>
      </header>

      <main className="wrap" id="content">
        <h1 className="sr-only">WindDesk dashboard: UK day-ahead wind forecast evaluation</h1>
        {tab === "decision" && (
        <section className="intro">
          <WindField />
          <div className="intro-copy">
            <div className="kicker">UK day-ahead · decisions made in January 2026</div>
            <h2 className="intro-title">Wind risk, priced into the day‑ahead buy.</h2>
            <p>See the wind forecast your desk actually had at the cutoff, measure how wrong it has been, and size the cover that implies.</p>
            {health.demo_data && <span className="pill">Synthetic demo data</span>}
            {ready && (
              <div className="cta-row">
                <LiquidButton size="xl" onClick={() => setTab("month")}>Browse January</LiquidButton>
                <LiquidButton size="xl" variant="ghost" onClick={() => setTab("accuracy")}>See accuracy</LiquidButton>
              </div>
            )}
          </div>
          <ol className="clock" aria-label="How the evaluation works">
            <li><b>{pad(cutoff)} UTC, D-1</b><span>Decision cutoff</span></li>
            <li><b>Latest WINDFOR run</b><span>Published before the cutoff</span></li>
            <li><b>FUELHH outturn</b><span>Hourly mean of actuals</span></li>
          </ol>
        </section>
        )}

        {!ready && (
          health.status === "error"
            ? <Notice>Wind data is unavailable. {health.error} <button className="btn ghost" onClick={() => window.location.reload()}>Reload</button></Notice>
            : (
              <div className="loading-panel" role="status">
                <Hive className="loading-hive" />
                <div className="loading-copy"><strong>Loading wind data…</strong><span>This usually takes a few seconds.</span></div>
              </div>
            )
        )}

        {ready && (
          <>
            {tab === "decision" && (
            <section className="kpis" aria-label="Headline accuracy">
              {m ? (
                <>
                  <Stat label="Mean absolute error" value={fmt(m.mae)} unit="MW" />
                  <Stat label="Bias" value={fmt(m.bias)} unit="MW" tone={m.bias < 0 ? "cyan" : "warn"} />
                  <Stat label="9 in 10 hours within" value={fmt(m.p90_abs_error)} unit="MW" />
                  <Stat label="Skill vs naive" value={acc.data.baseline?.n ? (acc.data.baseline.skill_score * 100).toFixed(0) : "–"} unit="%" tone="lime" />
                </>
              ) : <Skeleton h={96} />}
            </section>
            )}
            <div id="panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
              {tab === "decision" && <Decision cutoff={cutoff} date={date} setDate={setDate} />}
              {tab === "month" && <MonthBrowser cutoff={cutoff} />}
              {tab === "accuracy" && <Accuracy acc={acc} />}
              {tab === "revisions" && <Revisions cutoff={cutoff} />}
              {tab === "quality" && <Quality cutoff={cutoff} />}
            </div>
          </>
        )}
      </main>
      <footer>Source: Elexon BMRS · FUELHH actuals averaged to hours, WINDFOR hourly forecasts · all times UTC · procurement figures are illustrative.<br />Contains BMRS data © Elexon Limited copyright and database right.</footer>
    </>
  );
}
