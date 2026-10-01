// Dependency-free SVG/CSS charts replacing the Plotly figures of the Streamlit dashboard.
import { h, svg } from "./dom.js";

export function donut(percent, label = "完成度") {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent));
  return svg("svg", { class: "chart", viewBox: "0 0 140 140", role: "img", "aria-label": `${label} ${pct.toFixed(1)}%`, style: "max-width:200px;margin:0 auto" },
    svg("circle", { cx: 70, cy: 70, r, fill: "none", stroke: "var(--surface-2)", "stroke-width": 14 }),
    svg("circle", {
      cx: 70, cy: 70, r, fill: "none", stroke: "var(--accent)", "stroke-width": 14, "stroke-linecap": "round",
      "stroke-dasharray": `${(c * pct) / 100} ${c}`, transform: "rotate(-90 70 70)",
    }),
    svg("text", { x: 70, y: 72, "text-anchor": "middle", class: "label-strong", style: "font-size:24px" }, `${Math.round(pct)}%`),
    svg("text", { x: 70, y: 92, "text-anchor": "middle" }, label),
  );
}

/** Horizontal bars: rows = [{ label, value, color }] */
export function hbars(rows) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return h("div", { class: "hbars" },
    rows.map((r) => h("div", { class: "hbar" },
      h("span", {}, r.label),
      h("div", { class: "hbar-track" },
        h("div", { class: "hbar-fill", style: `width:${(r.value / max) * 100}%;background:${r.color}` })),
      h("b", {}, r.value),
    )),
  );
}

export function progress(label, pct, { invert = false } = {}) {
  const value = Math.max(0, Math.min(100, pct ?? 0));
  // For "time elapsed" a high value is bad, for completion it's good.
  const good = invert ? value < 50 : value >= 70;
  const bad = invert ? value >= 80 : value < 30;
  return h("div", { class: "progress" },
    h("div", { class: "progress-label" }, h("span", {}, label), h("span", {}, pct === null ? "—" : `${value.toFixed(1)}%`)),
    h("div", { class: "progress-track", role: "progressbar", "aria-valuenow": Math.round(value), "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": label },
      h("div", { class: `progress-fill ${good ? "ok" : bad ? "warn" : "mid"}`, style: `width:${value}%` })),
  );
}

/** Radar chart for the multi-project view. series = [{ name, values: [0..100, ...] }] */
export function radar(axes, series) {
  const size = 300, cx = 150, cy = 150, R = 105;
  const palette = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];
  const point = (i, v) => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)];
  };
  const rings = [25, 50, 75, 100].map((v) =>
    svg("polygon", { points: axes.map((_, i) => point(i, v).join(",")).join(" "), fill: "none", class: "grid-line" }));
  const spokes = axes.map((a, i) => {
    const [x, y] = point(i, 100);
    const [lx, ly] = point(i, 122);
    return [
      svg("line", { x1: cx, y1: cy, x2: x, y2: y, class: "grid-line" }),
      svg("text", { x: lx, y: ly + 4, "text-anchor": "middle" }, a),
    ];
  });
  const shapes = series.map((s, idx) => svg("polygon", {
    points: s.values.map((v, i) => point(i, v).join(",")).join(" "),
    fill: palette[idx % palette.length], "fill-opacity": 0.18,
    stroke: palette[idx % palette.length], "stroke-width": 2,
  }));
  return h("div", {},
    svg("svg", { class: "chart", viewBox: `0 0 ${size} ${size}`, role: "img", "aria-label": "專案健康雷達圖", style: "max-width:340px;margin:0 auto" },
      rings, spokes, shapes),
    h("div", { class: "legend", style: "justify-content:center" },
      series.map((s, idx) => h("span", {}, h("i", { style: `background:${palette[idx % palette.length]}` }), s.name))),
  );
}
