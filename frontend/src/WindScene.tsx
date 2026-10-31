import { useEffect, useRef } from "react";

type SceneApi = {
  resize: (w: number, h: number) => void;
  setPointer: (x: number, y: number) => void;
  setScroll: (p: number) => void;
  start: () => void;
  stop: () => void;
  dispose: () => void;
};

/** Three.js hero background. Loads three.js lazily, pauses off-screen, honours reduced motion,
    and calls onFallback if WebGL is unavailable so the caller can show a static background. */
export default function WindScene({ onFallback }: { onFallback?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fallback = useRef(onFallback);
  useEffect(() => {
    fallback.current = onFallback;
  });

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return undefined;
    let disposed = false;
    let api: SceneApi | null = null;
    const cleanups: Array<() => void> = [];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 700px)").matches;

    import("./scene/windScene.js")
      .then(({ createWindScene }) => {
        if (disposed) return;
        try {
          api = createWindScene(canvas, { reduced, mobile }) as SceneApi;
        } catch {
          fallback.current?.();
          return;
        }
        const scene = api;
        const size = () => scene.resize(host.clientWidth, host.clientHeight);
        size();
        const ro = new ResizeObserver(size);
        ro.observe(host);
        const io = new IntersectionObserver(([e]) => (e.isIntersecting ? scene.start() : scene.stop()));
        io.observe(host);
        const onMove = (e: PointerEvent) => scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
        const onScroll = () => scene.setScroll(window.scrollY / Math.max(host.clientHeight, 1));
        const onVis = () => (document.hidden ? scene.stop() : scene.start());
        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("scroll", onScroll, { passive: true });
        document.addEventListener("visibilitychange", onVis);
        cleanups.push(() => {
          ro.disconnect();
          io.disconnect();
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("scroll", onScroll);
          document.removeEventListener("visibilitychange", onVis);
        });
        scene.start();
      })
      .catch(() => fallback.current?.());

    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
      api?.dispose();
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 block h-full w-full" />;
}
