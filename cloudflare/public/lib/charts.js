// Dependency-free visual primitives: document strip, meters, seal, Gantt timeline.
import { h } from "./dom.js";
import { STATUS_LABEL, OVERALL_LABEL, daysBetween } from "./api.js";

const STATUS_ORDER = ["completed", "under_review", "in_progress", "blocked", "pending"];

/** One block per checklist item, in checklist order, coloured by status. */
export function docStrip(items, { mini = false } = {}) {
  return h("div", {
    class: `strip${mini ? " mini" : ""}`,
    role: "img",
    "aria-label": `文件狀態：${STATUS_ORDER.map((s) => `${STATUS_LABEL[s]} ${items.filter((i) => i.status === s).length}`).join("，")}`,
  }, items.map((i) => h("span", { class: `s-${i.status}`, title: i.item_name ? `${i.item_name}：${STATUS_LABEL[i.status]}` : STATUS_LABEL[i.status] })));
}

/** Strip built from counts only (portfolio views don't load every item). */
export function countStrip(counts, opts) {
  const items = STATUS_ORDER.flatMap((s) => Array.from({ length: counts[s] ?? 0 }, () => ({ status: s })));
  return docStrip(items, opts);
}

export function stripLegend(counts) {
  return h("div", { class: "strip-legend" },
    STATUS_ORDER.filter((s) => counts[s]).map((s) =>
      h("span", { class: `s-${s}` }, h("i"), STATUS_LABEL[s], h("b", {}, counts[s]))));
}

export function meter(label, pct, { warn = false } = {}) {
  const value = pct === null || pct === undefined ? null : Math.max(0, Math.min(100, pct));
  return h("div", { class: "meter" },
    h("div", { class: "meter-label" }, h("span", {}, label), h("b", {}, value === null ? "—" : `${value.toFixed(0)}%`)),
    h("div", { class: "meter-track", role: "progressbar", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(value ?? 0) },
      h("div", { class: `meter-fill${warn ? " warn" : ""}`, style: `width:${value ?? 0}%` })));
}

/** The case status stamp. */
export function seal(overall) {
  // Four characters, read like a real seal: vertical columns, right to left.
  return h("div", { class: `seal ${overall}`, role: "img", "aria-label": `整體狀態：${OVERALL_LABEL[overall]}` },
    h("div", { class: "seal-text", "aria-hidden": "true" }, [...(OVERALL_LABEL[overall] ?? "")].map((ch) => h("span", {}, ch))));
}

/**
 * Gantt: each project is a bar from creation to deadline, filled by completion,
 * with a "today" line across all rows.
 */
export function gantt(projects, today) {
  const rows = projects.filter((p) => p.deadline);
  if (!rows.length) return h("p", { class: "muted" }, "目前的專案都沒有設定截止日。");
  const starts = rows.map((p) => p.created_at.slice(0, 10));
  let min = [...starts, today].sort()[0];
  let max = [...rows.map((p) => p.deadline), today].sort().at(-1);
  // Pad the range a little so bars don't touch the edges.
  const span = Math.max(14, daysBetween(min, max));
  min = shift(min, -Math.round(span * 0.04));
  max = shift(max, Math.round(span * 0.12));
  const total = daysBetween(min, max);
  const pos = (iso) => (daysBetween(min, iso) / total) * 100;

  return h("div", { class: "gantt" },
    h("div", { class: "gantt-axis", "aria-hidden": "true" },
      monthTicks(min, max).map((m) => h("span", { style: `left:${pos(m)}%` }, `${Number(m.slice(5, 7))} 月`))),
    h("div", { class: "gantt-body", style: `--x:${pos(today) / 100}` },
      h("div", { class: "gantt-today", "aria-hidden": "true" }, h("span", {}, `今天 ${today.slice(5).replace("-", "/")}`)),
      rows.map((p) => {
        const start = p.created_at.slice(0, 10);
        const left = pos(start);
        const width = Math.max(0.5, pos(p.deadline) - left);
        const days = p.summary.days_left;
        const late = days < 0 || (days < 30 && p.summary.completion_rate < 100);
        // Deadline label hangs under the bar's end; right-aligned unless the bar is short and near the start.
        const flip = left + width > 40;
        return h("div", { class: "gantt-row" },
          h("div", { class: "gantt-label" },
            h("a", { href: `#/overview/${p.id}` }, p.name),
            h("div", {}, p.schema_name)),
          h("div", { class: "gantt-track" },
            h("div", {
              class: `gantt-bar${late ? " late" : ""}`, style: `left:${left}%;width:${width}%`,
              role: "img", "aria-label": `${p.name}：完成 ${p.summary.completion_rate}%，截止 ${p.deadline}`,
            }, h("div", { class: "done", style: `width:${p.summary.completion_rate}%` })),
            h("div", { class: `gantt-end${days < 30 ? " alert" : ""}${flip ? " flip" : ""}`, style: `left:${left + width}%` },
              h("b", {}, days < 0 ? `逾期 ${-days} 天` : `剩 ${days} 天`), `　截止 ${p.deadline}`)),
        );
      }),
    ),
  );
}

function shift(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthTicks(min, max) {
  const out = [];
  const d = new Date(`${min.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const months = Math.max(1, daysBetween(min, max) / 30);
  const step = months > 14 ? 3 : months > 7 ? 2 : 1;
  while (d.toISOString().slice(0, 10) < max) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCMonth(d.getUTCMonth() + step);
  }
  return out;
}
