// Small design-system primitives shared by every view.
/** @param {{ title?: string, kicker?: string, actions?: any, children?: any, className?: string }} props */
export function Panel({ title = "", kicker = "", actions = null, children = null, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="panel-head">
          <div>{kicker && <div className="kicker">{kicker}</div>}{title && <h2>{title}</h2>}</div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, unit, hint, tone }) {
  return (
    <div className={`stat ${tone || ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}{unit && <span className="unit">{unit}</span>}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function SkipLink() {
  const jump = (e) => {
    e.preventDefault();
    const el = document.getElementById("content");
    if (!el) return;
    el.setAttribute("tabindex", "-1");
    el.focus();
    el.scrollIntoView();
  };
  return <a className="skip-link" href="#content" onClick={jump}>Skip to content</a>;
}

export const Skeleton = ({ h = 280 }) => <div className="skeleton" style={{ height: h }} aria-hidden="true" />;

export const Notice = ({ tone = "bad", children }) => (
  <div className={`notice ${tone}`} role={tone === "bad" ? "alert" : "status"}>{children}</div>
);

export const Field = ({ label, children }) => <label className="field"><span>{label}</span>{children}</label>;

export const Key = ({ color, label, dashed }) => (
  <span className="key"><i style={{ background: dashed ? "transparent" : color, borderTop: dashed ? `2px dashed ${color}` : "none" }} />{label}</span>
);

export function ChartTip({ active, payload, label, unit = "MW", labelPrefix = "" }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value != null);
  return (
    <div className="tip">
      <div className="tip-label">{labelPrefix}{label}</div>
      {rows.map((p) => (
        <div className="tip-row" key={p.dataKey}>
          <i style={{ background: p.color || p.stroke || p.fill }} />
          <span>{p.name}</span>
          <b>{Array.isArray(p.value) ? `${Math.round(p.value[0]).toLocaleString()} – ${Math.round(p.value[1]).toLocaleString()}` : Math.round(p.value).toLocaleString()} {unit}</b>
        </div>
      ))}
    </div>
  );
}
