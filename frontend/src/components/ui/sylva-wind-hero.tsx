import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { SylvaHero } from "@/vendor/threeui/LandingPages.js";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const go = (hash: string) => {
  window.location.hash = hash;
};
const scrollToId = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });

/** Maps clicks inside the embedded Sylva scene to WindDesk navigation. Returns true when handled. */
function route(target: Element | null): boolean {
  if (!target?.closest) return false;
  if (target.closest(".liquid-button--explore, .dock-item--enter")) return go("app"), true;
  if (target.closest(".liquid-button--play, .scroll")) return scrollToId("how"), true;
  if (target.closest(".knob")) return scrollToId("method"), true;
  const dock = target.closest("[data-dock]");
  if (dock) {
    const label = dock.textContent?.trim();
    if (label === "Accuracy") go("app/accuracy");
    else window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
    return true;
  }
  return false;
}

/**
 * ThreeUI "Sylva" hero, living-green variant, configured exactly as supplied
 * (lexend 300, white, heading 63, body 16.5, tracking -0.006) with the copy tailored to WindDesk
 * (see scripts/build_sylva_html.py). The scene only mounts while near the viewport, so it
 * costs nothing (no WebGL, no 800 KB download) for visitors who never scroll to it.
 */
export default function SylvaWindHero({ className }: { className?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = outer.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => setMounted(e.isIntersecting), { rootMargin: "60% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el || !mounted) return undefined;
    const onClick = (e: Event) => {
      if (route(e.target as Element | null)) e.preventDefault();
    };
    const attach = () => {
      const doc = el.querySelector("iframe")?.contentDocument as (Document & { __wd?: boolean }) | null | undefined;
      if (!doc || doc.__wd) return;
      doc.__wd = true;
      doc.addEventListener("click", onClick, true);
    };
    el.addEventListener("load", attach, true);
    attach();
    return () => el.removeEventListener("load", attach, true);
  }, [mounted]);

  return (
    <div ref={outer} className={cn("sylva-frame relative w-full bg-[#080808]", className)} role="region" aria-label="WindDesk overview scene">
      <div ref={host} className="absolute inset-0">
        {mounted ? (
          <SylvaHero
            variant="living-green"
            headingFont="lexend"
            bodyFont="lexend"
            headingWeight="300"
            bodyWeight="300"
            primaryColor="#ffffff"
            headingSize={63}
            bodySize={16.5}
            headingLetterSpacing={-0.006}
            title="WindDesk overview scene"
            style={{ width: "100%", height: "100%" }}
          />
        ) : null}
      </div>
    </div>
  );
}
