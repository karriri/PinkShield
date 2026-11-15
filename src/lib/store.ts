import { useCallback, useEffect, useState } from "react";

const EVT = "pinkshield:store";

function read<T>(key: string): T | undefined {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

/** Hydration-safe localStorage state shared across components. Only fictional/demo or user-entered planner data. */
export function usePersistent<T>(key: string, makeInitial: () => T) {
  const [value, setValue] = useState<T>(makeInitial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = read<T>(key);
    if (stored !== undefined) setValue(stored);
    else window.localStorage.setItem(key, JSON.stringify(makeInitial()));
    setReady(true);
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      if (detail?.key === key) {
        const v = read<T>(key);
        if (v !== undefined) setValue(v);
      }
    };
    window.addEventListener(EVT, onChange);
    return () => window.removeEventListener(EVT, onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (fn: (prev: T) => T) => {
      setValue((prev) => {
        const next = fn(prev);
        window.localStorage.setItem(key, JSON.stringify(next));
        queueMicrotask(() => window.dispatchEvent(new CustomEvent(EVT, { detail: { key } })));
        return next;
      });
    },
    [key],
  );

  return [value, update, ready] as const;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
