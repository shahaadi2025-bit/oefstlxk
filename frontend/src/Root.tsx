import { lazy, Suspense, useEffect, useState } from "react";

const App = lazy(() => import("./App.jsx"));
const Landing = lazy(() => import("./landing/Landing"));

/** Hash routing keeps this a pure static site: "" = landing, "#app" / "#app/<tab>" / "#day=YYYY-MM-DD" = dashboard. */
const isApp = () => /^#(app|day=)/.test(window.location.hash);

export default function Root() {
  const [app, setApp] = useState(isApp);
  useEffect(() => {
    const on = () => {
      const next = isApp();
      setApp((prev) => {
        if (prev !== next) window.scrollTo({ top: 0 });
        return next;
      });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07090c]" aria-busy="true" />}>
      {app ? <App /> : <Landing />}
    </Suspense>
  );
}
