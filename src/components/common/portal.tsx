"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into `document.body`, escaping any ancestor stacking
 * context / transformed containing block. Overlays (modals, dialogs) use this
 * so their `fixed` positioning and z-index are always relative to the viewport
 * and never trapped beneath the header. SSR-safe (renders nothing until mount).
 */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
