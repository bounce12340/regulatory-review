// Applied synchronously in <head> so the saved theme is set before first paint.
try {
  const t = localStorage.getItem("rr-theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (_) { /* storage unavailable — fall back to OS preference */ }
