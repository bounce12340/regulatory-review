// Timeline & multi-project comparison views (portfolio-level).
import { h, mount } from "../lib/dom.js";
import {
  api, state, refreshProjects, urgency, timelineElapsed,
  STATUS_LABEL, RISK_LABEL, OVERALL_LABEL, OVERALL_CLASS,
} from "../lib/api.js";
import { hbars, progress, radar } from "../lib/charts.js";

function header(eyebrow, title, sub) {
  return h("header", { class: "page-header" },
    h("div", {}, h("span", { class: "eyebrow" }, eyebrow), h("h1", {}, title), h("p", { class: "page-sub" }, sub)));
}

function noProjects() {
  return h("div", { class: "card empty" }, h("h2", {}, "尚無進行中的專案"), h("a", { class: "btn btn-primary", href: "#/projects" }, "前往專案管理"));
}

const urgencyColor = (days) => (days === null ? "#94a3b8" : days < 30 ? "#ef4444" : days < 90 ? "#f59e0b" : "#10b981");

export async function renderTimeline(main, _params, ctx) {
  await refreshProjects();
  if (!ctx.isCurrent()) return;
  const projects = state.projects.filter((p) => p.status === "active");
  if (!projects.length) { mount(main, header("📅 Timeline", "時程與截止日", ""), noProjects()); return; }

  const withDeadline = projects.filter((p) => p.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline));
  mount(main,
    header("📅 Timeline", "時程與截止日", "所有進行中專案的截止日倒數"),
    h("section", { class: "kpis" },
      projects.map((p) => {
        const d = p.summary.days_left;
        const u = urgency(d);
        return h("a", { class: `kpi ${u.k}`, href: `#/overview/${p.id}`, style: "text-decoration:none;color:inherit" },
          h("div", { class: "kpi-value" }, d === null ? "N/A" : `${d} 天`),
          h("div", { class: "kpi-label" }, p.name),
          h("div", { class: "kpi-delta" }, p.deadline ? `截止：${p.deadline}` : "未設定截止日"));
      }),
    ),
    withDeadline.length ? h("section", { class: "card" },
      h("div", { class: "card-title" }, "距截止日天數"),
      hbars(withDeadline.map((p) => ({ label: p.name, value: Math.max(0, p.summary.days_left), color: urgencyColor(p.summary.days_left) }))),
      h("p", { class: "help" }, "紅色：30 天內 · 黃色：90 天內 · 綠色：90 天以上"),
    ) : null,
    h("section", { class: "card" },
      h("div", { class: "card-title" }, "完成度 vs. 時程消耗"),
      h("p", { class: "help", style: "margin-top:-8px" }, "時程消耗高於完成度時，代表進度落後。"),
      projects.map((p) => h("div", { style: "margin-bottom:18px" },
        h("div", { style: "font-weight:600;margin-bottom:6px" }, p.name, " ",
          h("span", { class: `badge ${OVERALL_CLASS[p.summary.overall_status]}` }, OVERALL_LABEL[p.summary.overall_status])),
        progress("完成度", p.summary.completion_rate),
        progress("時程消耗", timelineElapsed(p, state.today), { invert: true }),
      )),
    ),
  );
}

export async function renderCompare(main, _params, ctx) {
  await refreshProjects();
  if (!ctx.isCurrent()) return;
  const projects = state.projects.filter((p) => p.status === "active");
  if (!projects.length) { mount(main, header("📊 Comparison", "多專案比較", ""), noProjects()); return; }

  mount(main,
    header("📊 Comparison", "多專案比較", "並列比較所有進行中的法規專案"),
    h("section", { class: "card" },
      h("div", { class: "card-title" }, "專案摘要"),
      h("div", { class: "table-wrap" }, h("table", {},
        h("thead", {}, h("tr", {}, ["專案", "類型", "完成度", "狀態", "高風險", "截止日"].map((t) => h("th", {}, t)))),
        h("tbody", {}, projects.map((p) => h("tr", {},
          h("td", {}, h("a", { href: `#/overview/${p.id}`, class: "item-name" }, p.name)),
          h("td", { class: "small" }, p.schema_name),
          h("td", { style: "min-width:140px" }, progress("", p.summary.completion_rate)),
          h("td", {}, h("span", { class: `badge ${OVERALL_CLASS[p.summary.overall_status]}` }, OVERALL_LABEL[p.summary.overall_status])),
          h("td", {}, h("span", { class: `badge ${p.summary.high_risk_items ? "b-high" : "b-low"}` }, p.summary.high_risk_items)),
          h("td", { class: "nowrap", style: `color:${urgencyColor(p.summary.days_left)};font-weight:600` },
            p.deadline ?? "—", p.summary.days_left !== null ? h("div", { class: "small muted" }, `${p.summary.days_left} 天`) : null),
        ))),
      )),
    ),
    h("section", { class: "grid grid-2 section-gap" },
      h("div", { class: "card" },
        h("div", { class: "card-title" }, "專案健康雷達"),
        radar(["完成度", "安全度", "時間緩衝"], projects.map((p) => ({
          name: p.name,
          values: [
            p.summary.completion_rate,
            Math.max(0, 100 - p.summary.high_risk_items * 25),
            Math.min(100, Math.max(0, (p.summary.days_left ?? 0) / 2)),
          ],
        }))),
        h("p", { class: "help" }, "安全度＝100 − 25×高風險項目數；時間緩衝＝剩餘天數 ÷ 2（上限 100）。"),
      ),
      h("div", { class: "card" },
        h("div", { class: "card-title" }, "風險項目數"),
        hbars(projects.map((p) => ({ label: p.name, value: p.summary.high_risk_items, color: "#ef4444" }))),
      ),
    ),
    h("section", { class: "card" },
      h("div", { class: "card-title" }, "🔍 明細"),
      projects.map((p) => detailsFor(p)),
    ),
  );
}

function detailsFor(p) {
  const body = h("div", { class: "gap-body" }, h("p", { class: "muted" }, "載入中…"));
  let loaded = false;
  const icon = p.summary.high_risk_items > 1 ? "🔴" : p.summary.high_risk_items ? "🟡" : "🟢";
  return h("details", {
    class: "gap",
    ontoggle: async (e) => {
      if (!e.target.open || loaded) return;
      loaded = true;
      try {
        const d = await api("GET", `/api/projects/${p.id}`);
        mount(body, h("div", { class: "table-wrap" }, h("table", {},
          h("thead", {}, h("tr", {}, ["項目", "狀態", "風險", "備註"].map((t) => h("th", {}, t)))),
          h("tbody", {}, d.items.map((i) => h("tr", {},
            h("td", {}, i.item_name),
            h("td", {}, h("span", { class: `badge b-${i.status}` }, STATUS_LABEL[i.status])),
            h("td", {}, h("span", { class: `badge b-${i.risk_level}` }, RISK_LABEL[i.risk_level])),
            h("td", { class: "small" }, i.notes ?? ""),
          ))))));
      } catch (err) {
        loaded = false;
        mount(body, h("p", { class: "error-text" }, err.message));
      }
    },
  }, h("summary", {}, `${icon} ${p.name} — ${p.summary.completion_rate.toFixed(0)}% 完成`), body);
}
