import { useEffect, useMemo, useState } from "react";

import { WorksWheel, type WorksWheelItem } from "@/components/ui/works-wheel";

import { useApi } from "./api.js";
import { Notice, Panel, Skeleton } from "./ui.jsx";

type Point = { t: string; actual: number; forecast: number };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

const line = (vals: number[], min: number, max: number, w: number, top: number, h: number) =>
  vals
    .map((v, i) => {
      const x = 28 + (i / Math.max(vals.length - 1, 1)) * (w - 56);
      const y = top + h - ((v - min) / Math.max(max - min, 1)) * h;
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

/** A small forecast-vs-actual chart for one delivery day, as an SVG data URI.
    Built from numbers only (no user text), so there is nothing to inject. */
function dayCard(label: string, pts: Point[]): string {
  const w = 580;
  const h = 400;
  const f = pts.map((p) => p.forecast);
  const a = pts.map((p) => p.actual);
  const all = [...f, ...a];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const mae = pts.reduce((s, p) => s + Math.abs(p.forecast - p.actual), 0) / pts.length;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#182230"/><stop offset="1" stop-color="#0a0e14"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
    `<text x="28" y="66" font-size="42" font-weight="700" fill="#eef2f6" font-family="system-ui,sans-serif">${label}</text>` +
    `<text x="28" y="98" font-size="20" fill="#9aa7b8" font-family="system-ui,sans-serif">Mean error ${Math.round(mae).toLocaleString("en-GB")} MW</text>` +
    `<path d="${line(f, min, max, w, 130, 220)}" fill="none" stroke="#c8ff3e" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="${line(a, min, max, w, 130, 220)}" fill="none" stroke="#5ad1ff" stroke-width="3" stroke-dasharray="8 7" stroke-linejoin="round"/>` +
    `<text x="28" y="${h - 22}" font-size="16" fill="#c8ff3e" font-family="system-ui,sans-serif">Forecast</text>` +
    `<text x="118" y="${h - 22}" font-size="16" fill="#5ad1ff" font-family="system-ui,sans-serif">Actual</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function useNarrow(px = 700) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const q = window.matchMedia(`(max-width: ${px}px)`);
    const read = () => setNarrow(q.matches);
    read();
    q.addEventListener("change", read);
    return () => q.removeEventListener("change", read);
  }, [px]);
  return narrow;
}

export default function MonthBrowser({ cutoff }: { cutoff: number }) {
  const narrow = useNarrow();
  const { data, err, loading } = useApi(`/api/series?start=2026-01-02&end=2026-02-02&cutoff_hour=${cutoff}`) as {
    data: { points: Point[] } | null;
    err: string;
    loading: boolean;
  };

  const items: WorksWheelItem[] = useMemo(() => {
    const points = data?.points ?? [];
    const byDay = new Map<string, Point[]>();
    for (const p of points) {
      const day = p.t.slice(0, 10);
      byDay.set(day, [...(byDay.get(day) ?? []), p]);
    }
    return [...byDay.entries()]
      .filter(([, pts]) => pts.length >= 12)
      .map(([day, pts]) => ({
        title: dayLabel(day),
        image: dayCard(dayLabel(day), pts),
        href: `#day=${day}`,
      }));
  }, [data]);

  return (
    <Panel kicker="Browse the month" title="Every delivery day, one turn at a time">
      {err && <Notice>{err}</Notice>}
      {loading && !items.length && <Skeleton h={420} />}
      {items.length > 0 && !narrow && (
        <>
          <div className="wheel-shell">
            <WorksWheel items={items} label="January 2026" action="Open day" />
          </div>
          <p className="note">Scroll, drag, or use the arrow keys to turn the wheel. Click a day (or press Enter) to open its decision view.</p>
        </>
      )}
      {items.length > 0 && narrow && (
        <ul className="day-grid">
          {items.map((it) => (
            <li key={it.title}>
              <a href={it.href}>
                <img src={it.image} alt={`${it.title}: forecast versus actual wind generation`} loading="lazy" />
                <span>{it.title}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
