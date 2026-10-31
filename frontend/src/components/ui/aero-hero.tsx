import { ArrowUpRight } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AeroHeroProps {
  /** Small label above the headline. */
  kicker?: string;
  title: React.ReactNode;
  description?: string;
  ctaLabel: string;
  onCta: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Full-bleed layer behind the content (image, canvas, gradient). */
  background?: React.ReactNode;
  /** Rendered under the call to action (stat chips, scroll hint ...). */
  footer?: React.ReactNode;
  className?: string;
}

/** Full-screen hero: 12-column rule lines over a background, centred headline and the pill call to action.
    Adapted from the "aero hero 3" demo; the demo's stock image is replaced by the `background` slot. */
export function AeroHero({
  kicker,
  title,
  description,
  ctaLabel,
  onCta,
  secondaryLabel,
  onSecondary,
  background,
  footer,
  className,
}: AeroHeroProps) {
  return (
    <section className={cn("relative flex min-h-screen w-full items-center justify-center overflow-hidden", className)}>
      <div className="absolute inset-0">
        {background}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-[#07090c]" />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 size-full" aria-hidden="true">
        <div className="grid h-full w-full grid-cols-12 divide-x divide-white/10">
          <div className="col-span-1" />
          <div className="col-span-3" />
          <div className="col-span-4" />
          <div className="col-span-3" />
          <div className="col-span-1" />
        </div>
      </div>

      <div className="relative z-20 max-w-5xl px-6 pt-24 pb-16 text-center text-white">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-[75%] -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(7,9,12,0.62),transparent_70%)]" aria-hidden="true" />
        {kicker ? (
          <p className="mx-auto mb-6 inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-[0.14em] text-[#e1fcad] uppercase backdrop-blur-md">
            {kicker}
          </p>
        ) : null}
        <h1 className="font-[family-name:var(--display)] text-5xl leading-[1.02] font-semibold tracking-tight text-balance text-white md:text-6xl lg:text-7xl">
          {title}
        </h1>
        {description ? (
          <p className="mx-auto mt-6 mb-9 max-w-2xl text-lg font-light text-pretty text-white/85 md:text-xl">{description}</p>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <Button
            type="button"
            onClick={onCta}
            className="group not-disabled:inset-shadow-none mx-auto flex h-auto cursor-pointer items-center justify-center gap-0 rounded-full border-none bg-transparent px-0 py-5 font-normal shadow-none hover:bg-transparent sm:mx-0"
          >
            <span className="rounded-full bg-[#e1fcad] px-6 py-3 font-medium text-black duration-500 ease-in-out group-hover:bg-[#122023] group-hover:text-[#e1fcad] group-hover:transition-colors">
              {ctaLabel}
            </span>
            <div className="relative flex h-fit cursor-pointer items-center overflow-hidden rounded-full bg-[#e1fcad] p-5 text-black duration-500 ease-in-out group-hover:bg-[#122023] group-hover:text-[#e1fcad] group-hover:transition-colors">
              <ArrowUpRight className="absolute h-5 w-5 -translate-x-1/2 transition-all duration-500 ease-in-out group-hover:translate-x-10" />
              <ArrowUpRight className="absolute h-5 w-5 -translate-x-10 transition-all duration-500 ease-in-out group-hover:-translate-x-1/2" />
            </div>
          </Button>
          {secondaryLabel ? (
            <button
              type="button"
              onClick={onSecondary}
              className="cursor-pointer rounded-full px-4 py-3 text-base text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e1fcad]"
            >
              {secondaryLabel}
            </button>
          ) : null}
        </div>
        {footer ? <div className="mt-14">{footer}</div> : null}
      </div>
    </section>
  );
}

export default AeroHero;
