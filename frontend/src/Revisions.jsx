import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, useApi } from "./api.js";
import { ChartTip, Field, Notice, Panel, Skeleton } from "./ui.jsx";

const AX = { stroke: "var(--line-2)", tick: { fill: "var(--dim)", fontSize: 11 }, tickLine: false };

export default function Revisions({ cutoff }) {
  const [date, setDate] = useState("2026-01-15");
  const [time, setTime] = useState("12:00");
  const r = useApi(`/api/revisions?target=${date}T${time}:00Z&cutoff_hour=${cutoff}`);
  const rows = r.data?.revisions || [];
  const cutIdx = rows.filter((x) => x.before_cutoff).length - 1;
  return (
    <Panel kicker="Forecast revisions" title="How one hour's forecast changed run by run"
      actions={<>
        <Field label="Target day"><input type="date" min="2026-01-02" max="2026-02-01" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Hour (UTC)"><input type="time" step="3600" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </>}>
      {r.err && <Notice>{r.err}</Notice>}
      {r.loading && !rows.length ? <Skeleton h={320} /> : (
        <div role="img" aria-label="Successive forecast values for the chosen hour, with the actual value and the decision cutoff marked">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={rows} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="published" tickFormatter={(v) => `${v.slice(5, 10)} ${v.slice(11, 13)}h`} minTickGap={40} {...AX} />
              <YAxis width={64} domain={["auto", "auto"]} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} {...AX} axisLine={false} />
              <Tooltip content={<ChartTip labelPrefix="Run " />} cursor={{ stroke: "var(--line-2)" }} />
              <Line type="stepAfter" dataKey="forecast" name="Forecast" stroke="var(--lime)" strokeWidth={2.2} dot={{ r: 3, fill: "var(--lime)" }} isAnimationActive={false} />
              {r.data?.actual != null && <ReferenceLine y={r.data.actual} stroke="var(--cyan)" strokeDasharray="5 4" label={{ value: `Actual ${fmt(r.data.actual)} MW`, fill: "var(--cyan)", position: "insideTopRight", fontSize: 11 }} />}
              {cutIdx >= 0 && <ReferenceLine x={rows[cutIdx].published} stroke="var(--warn)" label={{ value: "Last run before cutoff", fill: "var(--warn)", fontSize: 11, position: "insideTopLeft" }} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="note">Runs to the right of the amber line were not available to the buyer at the decision cutoff.</p>
    </Panel>
  );
}
