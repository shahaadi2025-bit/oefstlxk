import { useEffect, useState } from "react";

export async function api(path) {
  let r;
  try {
    r = await fetch(path);
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  if (!r.ok) {
    let m = r.statusText;
    try { m = (await r.json()).detail || m; } catch { /* non-JSON error body */ }
    throw new Error(m);
  }
  return r.json();
}

export const fmt = (n) => (n == null || Number.isNaN(n) ? "–" : Math.round(n).toLocaleString());

export function useApi(path) {
  const [res, setRes] = useState({ path: null, data: null, err: "" });
  useEffect(() => {
    if (!path) return undefined;
    let live = true;
    api(path)
      .then((data) => live && setRes({ path, data, err: "" }))
      .catch((e) => live && setRes({ path, data: null, err: e.message }));
    return () => { live = false; };
  }, [path]);
  const settled = res.path === path;
  // Previous data stays visible while a new request is in flight (no flicker).
  return { data: path ? res.data : null, err: settled ? res.err : "", loading: !!path && !settled };
}
