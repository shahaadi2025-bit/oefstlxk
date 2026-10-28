import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt } from "./api.js";
import { useApi } from "./api.js";
import { ChartTip, Notice, Panel, Skeleton, Stat } from "./ui.jsx";

const AX = { stroke: "var(--line-2)", tick: { fill: "var(--dim)", fontSize: 11 }, tickLine: false };

export default function Accuracy({ acc }) {
  const h = useApi("/api/horizon");
  const a = acc.data;
  const m = a?.summary;
  const b = a?.baseline;
  const max = b?.n ? Math.max(b.forecast_mae, b.persistence_mae) : 1;
  return (
    <div className="grid-2">
      {acc.err && <Notice>{acc.err}</Notice>}
      <Panel kicker="At the cutoff" title="Forecast error" className="wide">
        {m ? (
          <div className="stats">
            <Stat label="MAE" value={fmt(m.mae)} unit="MW" />
            <Stat label="RMSE" value={fmt(m.rmse)} unit="MW" />
            <Stat label="Bias" value={fmt(m.bias)} unit="MW" tone={m.bias < 0 ? "cyan" : "warn"} hint={m.bias < 0 ? "under-forecasts wind" : "over-forecasts wind"} />
            <Stat label="MAPE" value={m.mape.toFixed(1)} unit="%" />
            <Stat label="P90 abs error" value={fmt(m.p90_abs_error)} unit="MW" hint="9 in 10 hours are within this" />
            <Stat label="P99 abs error" value={fmt(m.p99_abs_error)} unit="MW" hint={`n = ${m.n} hours`} />
          </div>
        ) : <Skeleton h={120} />}
      </Panel>

      <Panel kicker="Benchmark" title="Better than a naive guess?">
        {b?.n > 0 ? (
          <>
            <div className="bars">
              <div><span>Forecast</span><div className="track"><div className="fill lime" style={{ width: `${(b.forecast_mae / max) * 100}%` }} /></div><b>{fmt(b.forecast_mae)} MW</b></div>
              <div><span>Naive (48h ago)</span><div className="track"><div className="fill dimfill" style={{ width: `${(b.persistence_mae / max) * 100}%` }} /></div><b>{fmt(b.persistence_mae)} MW</b></div>
            </div>
            <Stat label="Skill score" value={(b.skill_score * 100).toFixed(0)} unit="%" tone="lime" hint="1 − forecast MAE ÷ naive MAE" />
          </>
        ) : <Skeleton h={160} />}
      </Panel>

      <Panel kicker="By forecast wind level" title="Where it misses">
        <div className="scroll"><table>
          <thead><tr><th>Level</th><th className="num">Hours</th><th className="num">MAE</th><th className="num">Bias</th></tr></thead>
          <tbody>{(a?.by_wind_level || []).map((r) => (
            <tr key={r.level}><td>{r.level}</td><td className="num">{r.n}</td><td className="num">{fmt(r.mae)}</td><td className="num">{fmt(r.bias)}</td></tr>
          ))}</tbody>
        </table></div>
      </Panel>

      <Panel kicker="By delivery hour" title="MAE across the day (MW)">
        <div role="img" aria-label="Bar chart of mean absolute error by delivery hour">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={a?.by_hour || []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="hour" {...AX} /><YAxis width={48} {...AX} axisLine={false} />
              <Tooltip content={<ChartTip labelPrefix="Hour " />} cursor={{ fill: "var(--line)" }} />
              <Bar dataKey="mae" name="MAE" fill="var(--lime)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel kicker="By hours ahead" title="Older forecasts are less accurate">
        <div role="img" aria-label="Line chart of mean absolute error against forecast horizon in hours">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={h.data?.by_horizon || []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="horizon_h" {...AX} unit="h" /><YAxis width={48} {...AX} axisLine={false} />
              <Tooltip content={<ChartTip labelPrefix="Horizon " />} cursor={{ stroke: "var(--line-2)" }} />
              <Line dataKey="mae" name="MAE" stroke="var(--cyan)" dot={false} strokeWidth={2.2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
