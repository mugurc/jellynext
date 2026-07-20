"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "jn_search_history";
const CAP = 8;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/** Recent search terms, persisted to localStorage (most-recent first). */
export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);

  // Read once on mount — deferred so it doesn't run synchronously in the
  // effect body (and reads localStorage only on the client, avoiding an SSR
  // hydration mismatch).
  useEffect(() => {
    const id = setTimeout(() => setHistory(read()), 0);
    return () => clearTimeout(id);
  }, []);

  const write = useCallback((next: string[]) => {
    setHistory(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage full / disabled — history is best-effort.
    }
  }, []);

  const push = useCallback(
    (term: string) => {
      const t = term.trim();
      if (t.length < 2) return;
      write(
        [t, ...read().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(
          0,
          CAP,
        ),
      );
    },
    [write],
  );

  const remove = useCallback(
    (term: string) => write(read().filter((x) => x !== term)),
    [write],
  );

  const clear = useCallback(() => write([]), [write]);

  return { history, push, remove, clear };
}
