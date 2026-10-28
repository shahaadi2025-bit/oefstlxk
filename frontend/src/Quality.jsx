import { fmt, useApi } from "./api.js";
import { Notice, Panel, Skeleton, Stat } from "./ui.jsx";

export default function Quality({ cutoff }) {
  const { data: q, err } = useApi(`/api/quality?cutoff_hour=${cutoff}`);
  if (err) return <Notice>{err}</Notice>;
  if (!q) return <Skeleton h={260} />;
  const gaps = q.missing_actuals + q.targets_without_forecast_at_cutoff;
  return (
    <Panel kicker="Coverage" title="Data quality">
      <Notice tone={gaps ? "warn" : "ok"}>{gaps ? `${gaps} gaps found: see the counts below.` : "No gaps: every hour has an actual and a forecast available at the cutoff."}</Notice>
      <div className="stats">
        <Stat label="Expected hours" value={fmt(q.expected_hours)} />
        <Stat label="Hours with actuals" value={fmt(q.actual_hours)} />
        <Stat label="Missing actuals" value={fmt(q.missing_actuals)} tone={q.missing_actuals ? "warn" : ""} />
        <Stat label="Zero / negative actuals" value={fmt(q.zero_or_negative_actuals)} />
        <Stat label="Forecast rows" value={fmt(q.forecast_rows)} />
        <Stat label="Targets with a forecast at cutoff" value={fmt(q.targets_with_forecast_at_cutoff)} />
        <Stat label="Targets without one" value={fmt(q.targets_without_forecast_at_cutoff)} tone={q.targets_without_forecast_at_cutoff ? "warn" : ""} />
        <Stat label="Avg runs per target hour" value={q.avg_forecasts_per_target} />
      </div>
      <p className="note">Forecast runs published {q.forecast_publish_min} to {q.forecast_publish_max} UTC.
        {q.missing_examples.length > 0 && ` Missing actuals include: ${q.missing_examples.join(", ")}.`}</p>
    </Panel>
  );
}
