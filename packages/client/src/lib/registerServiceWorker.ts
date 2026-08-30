// Registers the PWA service worker THROUGH vite-plugin-pwa's virtual module instead of letting
// the plugin auto-inject its own <script> tag (see vite.config.ts's injectRegister: null) — that
// auto-injected script is just a bare `navigator.serviceWorker.register(...)` call for a plain
// app like this one, with none of registerType: 'autoUpdate's actual behavior: the generated
// sw.js DOES self-activate a new version in the background (it calls self.skipWaiting() +
// clientsClaim(), baked in by that registerType), but nothing was ever telling the ALREADY OPEN
// page to reload and start using it — that reload-on-update logic only exists in this virtual
// module's workbox-window wrapper, which nothing in the app was importing.
//
// Practical effect of the old setup, and the actual real-world report this fixes: a copy of the
// game saved to the desktop (installed as a standalone app) would just never show new changes.
// Re-launching it from the shortcut mostly REFOCUSES the already-running window rather than doing
// a fresh navigation, so even the browser's own passive "check for a new sw.js on page load" path
// rarely got a chance to run — the app could sit open for weeks running the exact bundle it had
// the day it was installed.
//
// Calling registerSW ourselves gets two things the auto-injected script never had:
//  1. registerType 'autoUpdate's real behavior — see vite-plugin-pwa's own
//     client/build/register.ts: an 'activated' listener that calls window.location.reload()
//     once a genuinely NEW service worker takes over, so the page actually starts running the
//     fresh bundle instead of silently having a new SW active underneath a stale one.
//  2. A periodic registration.update() poll (below), so that check happens on some cadence even
//     if the installed window is simply left open/refocused instead of freshly navigated.
import { registerSW } from 'virtual:pwa-register';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly is plenty for a game with no urgent fixes

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        registration.update().catch(() => {
          // Best-effort — a failed check just means we try again next interval, same as any
          // other transient network hiccup elsewhere in this app.
        });
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });
}
