// Brand mark and the animated wind-field backdrop (pure SVG, no external assets).
export function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="WindDesk">
      <rect width="32" height="32" rx="8" fill="var(--lime)" />
      <g stroke="#07090c" strokeWidth="2.2" strokeLinecap="round" fill="none">
        <path d="M16 17v9" /><path d="M16 17V6" /><path d="M16 17l8 5" /><path d="M16 17l-8 5" />
      </g>
    </svg>
  );
}

const LINES = [
  "M-20 60 C 120 20, 220 100, 360 55 S 600 20, 760 70",
  "M-20 100 C 140 60, 240 140, 380 95 S 620 60, 780 110",
  "M-20 140 C 100 110, 260 170, 400 130 S 640 100, 800 150",
  "M-20 180 C 160 150, 280 200, 420 170 S 660 140, 820 190",
];

export function WindField() {
  return (
    <svg className="windfield" viewBox="0 0 760 220" preserveAspectRatio="none" aria-hidden="true">
      {LINES.map((d, i) => (
        <path key={d} d={d} className="flow" style={{ animationDelay: `${-i * 2.2}s`, opacity: 0.18 + i * 0.07 }} />
      ))}
    </svg>
  );
}
