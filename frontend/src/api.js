import { useEffect, useState } from "react";

export async function api(path) {
  const r = await fetch(path);
  if (!r.ok) {
    let m = r.statusText;
    try { m = (await r.json()).detail || m; } catch { /* non-JSON error body */ }
    throw new Error(m);
  }
  return r.json();
}

export const fmt = (n) => (n == null || Number.isNaN(n) ? "–" : Math.round(n).toLocaleString());

export function useApi(path) {
  const [s, set] = useState({ data: null, err: "", loading: !!path });
  useEffect(() => {
    if (!path) { set({ data: null, err: "", loading: false }); return undefined; }
    let live = true;
    set((x) => ({ ...x, loading: true, err: "" }));
    api(path)
      .then((d) => live && set({ data: d, err: "", loading: false }))
      .catch((e) => live && set({ data: null, err: e.message, loading: false }));
    return () => { live = false; };
  }, [path]);
  return s;
}
