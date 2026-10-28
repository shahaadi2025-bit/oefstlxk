import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, useApi } from "./api.js";
import { ChartTip, Field, Key, Notice, Panel, Skeleton, Stat } from "./ui.jsx";

const AX = { stroke: "var(--line-2)", tick: { fill: "var(--dim)", fontSize: 11 }, tickLine: false };

export default function Decision({ cutoff }) {
  const [date, setDate] = useState("2026-01-15");
  const [demand, setDemand] = useState(25000);
  const [conf, setConf] = useState(0.95);
  const [showActual, setShowActual] = useState(true);
  const q = `date=${date}&cutoff_hour=${cutoff}`;
  const d = useApi(`/api/decision?${q}`);
  const p = useApi(`/api/procurement?${q}&demand_mw=${demand || 0}&confidence=${conf}`);
  const rows = (d.data?.rows || []).map((r) => ({ ...r, label: r.t.slice(11, 16), band: r.lo == null ? null : [r.lo, r.hi] }));
  const pr = p.data;

  return (
    <div className="split">
      <Panel kicker="Delivery day" title="Forecast the desk had at the cutoff"
        actions={<>
          <Field label="Delivery day"><input type="date" min="2026-01-02" max="2026-02-01" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <a className="btn ghost" href={`/api/decision.csv?${q}`}>Export CSV</a>
        </>}>
        {d.err && <Notice>{d.err}</Notice>}
        <div className="legend">
          <Key color="var(--lime)" label="Forecast at cutoff" /><Key color="var(--lime)" label="P10–P90 range" dashed />
          <label className="check"><input type="checkbox" checked={showActual} onChange={(e) => setShowActual(e.target.checked)} />
            <Key color="var(--cyan)" label="Actual (backtest)" /></label>
        </div>
        {d.loading && !rows.length ? <Skeleton h={340} /> : (
          <div role="img" aria-label="Hourly forecast at cutoff with P10 to P90 range, optionally with actual wind generation">
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="label" minTickGap={28} {...AX} />
                <YAxis width={64} tickFormatter={(v) => `${v / 1000}k`} {...AX} axisLine={false} />
                <Tooltip content={<ChartTip labelPrefix="UTC " />} cursor={{ stroke: "var(--line-2)" }} />
                <Area dataKey="band" name="P10–P90 range" stroke="none" fill="var(--lime)" fillOpacity={0.13} isAnimationActive={false} />
                <Line dataKey="forecast" name="Forecast" stroke="var(--lime)" dot={false} strokeWidth={2.4} isAnimationActive={false} />
                {showActual && <Line dataKey="actual" name="Actual" stroke="var(--cyan)" dot={false} strokeWidth={1.6} strokeDasharray="5 4" isAnimationActive={false} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="note">Latest run published at or before {String(cutoff).padStart(2, "0")}:00 UTC the day before. Forecasts are hourly.
          The range comes from errors known before this day{d.data?.band_uses_all_history ? " (too little prior history, so the whole window is used)" : ""}.</p>
      </Panel>

      <Panel kicker="Cover calculator" title="How much extra to buy">
        <div className="form-row">
          <Field label="Flat demand (MW)"><input type="number" inputMode="numeric" min="0" step="500" value={demand} onChange={(e) => setDemand(+e.target.value)} /></Field>
          <Field label="Confidence">
            <select value={conf} onChange={(e) => setConf(+e.target.value)}>{[0.8, 0.9, 0.95, 0.99].map((c) => <option key={c} value={c}>{Math.round(c * 100)}%</option>)}</select>
          </Field>
        </div>
        {p.err && <Notice>{p.err}</Notice>}
        {pr ? (
          <div className="stack">
            <Stat label="Buy on forecast alone" value={fmt(pr.base_mwh)} unit="MWh" />
            <Stat label={`Wind shortfall buffer at ${Math.round(conf * 100)}%`} value={fmt(pr.buffer_mw)} unit="MW" tone="warn" />
            <Stat label="Extra cover" value={`+${fmt(pr.extra_mwh)}`} unit="MWh" tone="lime" hint={`Total with cover: ${fmt(pr.with_buffer_mwh)} MWh`} />
          </div>
        ) : <Skeleton h={220} />}
        <p className="note">Illustrative: flat demand, and historical over-forecast at the chosen quantile is treated as the wind shortfall to insure.</p>
      </Panel>

      <details className="panel wide">
        <summary>All 24 hours <span className="dim">table</span></summary>
        <div className="scroll"><table>
          <thead><tr><th>Hour (UTC)</th><th className="num">Forecast MW</th><th className="num">P10–P90 MW</th><th>Run published</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.t}><td>{r.label}</td><td className="num">{fmt(r.forecast)}</td>
              <td className="num">{r.lo == null ? "–" : `${fmt(r.lo)} – ${fmt(r.hi)}`}</td><td>{r.published.slice(5, 16).replace("T", " ")}</td></tr>
          ))}</tbody>
        </table></div>
      </details>
    </div>
  );
}
