// Runs synchronously in <head>.
// 1) Apply the saved theme before first paint.
try {
  const t = localStorage.getItem("rr-theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (_) { /* storage unavailable — fall back to OS preference */ }

// 2) Load web fonts without blocking rendering: if Google Fonts is unreachable the
//    page still renders immediately with the system 楷體 / sans fallbacks.
(function () {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=LXGW+WenKai+TC:wght@400;700&display=swap";
  document.head.appendChild(link);
})();
