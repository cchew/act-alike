// src/analytics.ts
declare global {
  interface Window {
    umami?: { track: (name: string, data?: Record<string, unknown>) => void };
  }
}

// Analytics must never break the app or block a caller — Umami is commonly
// ad-blocked, and the script may load slowly or not at all.
export function track(name: string, data?: Record<string, unknown>): void {
  try {
    window.umami?.track(name, data);
  } catch {
    // swallow — see comment above
  }
}
