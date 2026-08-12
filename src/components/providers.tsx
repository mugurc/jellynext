"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePrefs } from "@/lib/prefs/store";

/** Toggle the global `.reduce-motion` class from the in-app preference. */
function ReduceMotionSync() {
  const reduceMotion = usePrefs((s) => s.reduceMotion);
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);
  return null;
}

/**
 * Client-side providers. React Query holds all server-state (Jellyfin data);
 * defaults are tuned for a media app where lists change infrequently.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ReduceMotionSync />
      {children}
    </QueryClientProvider>
  );
}
