export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // La app debe seguir funcionando aunque falle el service worker.
    });
  });
}
