// Project overview: KPIs, charts, editable checklist, action items, exports.
import { h, mount, toast, download, formData, busy, confirmDialog, field } from "../lib/dom.js";
import {
  api, state, canEdit, refreshProjects, urgency, timelineElapsed,
  STATUS_LABEL, STATUS_ICON, STATUS_COLOR, RISK_LABEL, RISK_COLOR, OVERALL_LABEL, OVERALL_CLASS,
} from "../lib/api.js";
import { donut, hbars, progress } from "../lib/charts.js";

const STATUSES = ["pending", "in_progress", "under_review", "blocked", "completed"];
const RISKS = ["low", "medium", "high"];

export async function renderOverview(main, params, ctx) {
  const requested = Number(params[0]);
  if (requested) state.currentProjectId = requested;
  if (!state.currentProjectId) {
    mount(main, emptyState(ctx));
    return;
  }
  mount(main, h("p", { class: "muted" }, "載入專案中…"));
  let detail;
  try {
    detail = await api("GET", `/api/projects/${state.currentProjectId}`);
  } catch (err) {
    if (err.status === 404) {
      await refreshProjects();
      ctx.navigate(state.currentProjectId ? `#/overview/${state.currentProjectId}` : "#/projects");
      return;
    }
    throw err;
  }
  if (!ctx.isCurrent()) return;
  const filters = { status: "", risk: "", q: "" };
  draw();

  function draw() {
    mount(main, view(detail, filters, {
      onDetail: (d) => { detail = d; refreshProjects().catch(() => {}); draw(); },
      onFilter: () => drawTable(),
    }));
  }
  function drawTable() {
    const host = main.querySelector("#checklist-body");
    if (host) mount(host, checklistRows(detail, filters, (d) => { detail = d; refreshProjects().catch(() => {}); draw(); }));
    const count = main.querySelector("#checklist-count");
    if (count) count.textContent = `顯示 ${filterItems(detail.items, filters).length} / ${detail.items.length} 項`;
  }
}

function emptyState(ctx) {
  return h("div", { class: "card empty" },
    h("h2", {}, "尚無專案"),
    h("p", {}, "建立第一個法規審查專案，或載入示範資料快速體驗。"),
    canEdit() ? h("div", { class: "btn-row", style: "justify-content:center" },
      h("a", { class: "btn btn-primary", href: "#/projects" }, "➕ 建立專案"),
      h("button", {
        class: "btn",
        onclick: async (e) => {
          try {
            const res = await busy(e.currentTarget, () => api("POST", "/api/projects/demo", {}));
            await refreshProjects();
            ctx.navigate(`#/overview/${res.project_ids[0]}`);
          } catch (err) { toast(err.message, "error"); }
        },
      }, "載入示範專案"),
    ) : h("p", { class: "muted" }, "請聯絡管理員建立專案。"),
  );
}

function view(detail, filters, { onDetail, onFilter }) {
  const { project, summary, items, action_items } = detail;
  const urg = urgency(summary.days_left);
  const elapsed = timelineElapsed(project, state.today);

  return [
    h("header", { class: "page-header" },
      h("div", {},
        h("span", { class: "eyebrow" }, `⚕ ${project.schema_name}`),
        h("h1", {}, project.name,
          h("span", { class: `badge ${OVERALL_CLASS[summary.overall_status]}` }, OVERALL_LABEL[summary.overall_status]),
          project.deadline ? h("span", { class: `badge ${urg.cls}` }, urg.label) : null,
          project.status !== "active" ? h("span", { class: "badge b-neutral" }, project.status === "archived" ? "已封存" : "已結案") : null,
        ),
        h("p", { class: "page-sub" },
          `截止日期：${project.deadline ?? "未設定"}`,
          summary.days_left !== null ? ` · 剩餘 ${summary.days_left} 天` : "",
          ` · 最後更新：${project.updated_at.slice(0, 10)}`),
        project.description ? h("p", { class: "page-sub" }, project.description) : null,
      ),
      h("div", { class: "btn-row no-print" },
        h("a", { class: "btn btn-sm", href: "#/projects" }, "編輯專案"),
      ),
    ),

    h("section", { class: "kpis", "aria-label": "關鍵指標" },
      kpi("k-blue", `${summary.completion_rate.toFixed(1)}%`, "完成度", `${summary.completed} / ${summary.total} 項`),
      kpi("k-green", summary.completed, "已完成項目"),
      kpi(summary.high_risk_items ? "k-red" : "k-green", summary.high_risk_items, "高風險項目",
        summary.high_risk_items ? "需立即處理" : "一切正常"),
      kpi(urg.k, summary.days_left === null ? "N/A" : `${summary.days_left} 天`, "剩餘天數"),
      kpi("k-violet", summary.total, "總項目數"),
    ),

    h("section", { class: "card" },
      h("div", { class: "card-title" }, "進度概覽"),
      progress("文件完成度", summary.completion_rate),
      progress("時程已消耗（建立日 → 截止日）", elapsed, { invert: true }),
    ),

    h("section", { class: "grid grid-3 section-gap" },
      h("div", { class: "card" }, h("div", { class: "card-title" }, "完成度"), donut(summary.completion_rate)),
      h("div", { class: "card" }, h("div", { class: "card-title" }, "狀態分布"),
        hbars(STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: summary.status_counts[s], color: STATUS_COLOR[s] })))),
      h("div", { class: "card" }, h("div", { class: "card-title" }, "風險分布"),
        hbars(RISKS.map((r) => ({ label: `${RISK_LABEL[r]}風險`, value: summary.risk_counts[r], color: RISK_COLOR[r] })))),
    ),

    h("section", { class: "card" },
      h("div", { class: "card-title" }, "📋 檢查清單",
        h("span", { class: "muted small", id: "checklist-count" }, `顯示 ${filterItems(items, filters).length} / ${items.length} 項`)),
      h("div", { class: "filters no-print" },
        h("select", { class: "input", "aria-label": "依狀態篩選", onchange: (e) => { filters.status = e.target.value; onFilter(); } },
          h("option", { value: "" }, "全部狀態"), STATUSES.map((s) => h("option", { value: s, selected: filters.status === s }, STATUS_LABEL[s]))),
        h("select", { class: "input", "aria-label": "依風險篩選", onchange: (e) => { filters.risk = e.target.value; onFilter(); } },
          h("option", { value: "" }, "全部風險"), RISKS.map((r) => h("option", { value: r, selected: filters.risk === r }, `${RISK_LABEL[r]}風險`))),
        h("input", { class: "input search", type: "search", placeholder: "🔍 搜尋項目或備註…", value: filters.q, "aria-label": "搜尋",
          oninput: (e) => { filters.q = e.target.value; onFilter(); } }),
      ),
      h("div", { class: "table-wrap" },
        h("table", {},
          h("thead", {}, h("tr", {},
            h("th", {}, "項目"), h("th", {}, "狀態"), h("th", {}, "風險"), h("th", {}, "備註"), h("th", { class: "no-print" }, ""))),
          h("tbody", { id: "checklist-body" }, checklistRows(detail, filters, onDetail)),
        ),
      ),
      canEdit() ? addItemForm(detail, onDetail) : null,
    ),

    action_items.length ? h("section", { class: "card" },
      h("div", { class: "card-title" }, "⚡ 待辦事項"),
      action_items.map((a) => h("div", { class: "action-row" },
        h("span", { class: `dot ${a.priority}` }),
        h("div", { class: "action-text" }, h("strong", {}, a.item), h("div", { class: "muted small" }, a.action)),
        h("span", { class: `badge ${a.priority === "high" ? "b-high" : "b-medium"}` }, a.priority === "high" ? "高優先" : "中優先"),
      )),
    ) : null,

    h("section", { class: "card no-print" },
      h("div", { class: "card-title" }, "📤 匯出報告"),
      h("div", { class: "btn-row" },
        h("button", { class: "btn", onclick: () => download(`${project.slug}-review-${state.today}.md`, toMarkdown(detail), "text/markdown") }, "⬇ Markdown"),
        h("button", { class: "btn", onclick: () => download(`${project.slug}-review-${state.today}.csv`, toCsv(detail), "text/csv") }, "⬇ CSV（Excel）"),
        h("button", { class: "btn", onclick: () => download(`${project.slug}-review-${state.today}.json`, JSON.stringify(detail, null, 2), "application/json") }, "⬇ JSON"),
        h("button", { class: "btn", onclick: () => window.print() }, "🖨 列印 / 存成 PDF"),
      ),
    ),
  ];
}

function kpi(cls, value, label, delta) {
  return h("div", { class: `kpi ${cls}` },
    h("div", { class: "kpi-value" }, value),
    h("div", { class: "kpi-label" }, label),
    delta ? h("div", { class: "kpi-delta" }, delta) : null);
}

function filterItems(items, f) {
  const q = f.q.trim().toLowerCase();
  return items.filter((i) =>
    (!f.status || i.status === f.status) &&
    (!f.risk || i.risk_level === f.risk) &&
    (!q || i.item_name.toLowerCase().includes(q) || (i.notes ?? "").toLowerCase().includes(q)));
}

function checklistRows(detail, filters, onDetail) {
  const editable = canEdit();
  const rows = filterItems(detail.items, filters);
  if (!rows.length) return h("tr", {}, h("td", { colspan: 5, class: "muted" }, detail.items.length ? "沒有符合篩選條件的項目。" : "尚無檢查項目。"));

  const save = async (item, patch) => {
    try {
      onDetail(await api("PATCH", `/api/items/${item.id}`, patch));
      toast("已更新");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return rows.map((item) => h("tr", {},
    h("td", {},
      h("div", { class: "item-name" }, item.item_name),
      h("div", { class: "small muted" },
        item.category ? item.category.replace(/_/g, " ") : "",
        item.item_key ? (item.required ? " · 必要" : " · 選填") : " · 自訂項目"),
    ),
    h("td", {}, editable
      ? h("select", { class: "input", "aria-label": `${item.item_name} 狀態`, onchange: (e) => save(item, { status: e.target.value }) },
        STATUSES.map((s) => h("option", { value: s, selected: item.status === s }, `${STATUS_ICON[s]} ${STATUS_LABEL[s]}`)))
      : h("span", { class: `badge b-${item.status}` }, `${STATUS_ICON[item.status]} ${STATUS_LABEL[item.status]}`)),
    h("td", {}, editable && !item.auto_risk
      ? h("select", { class: "input", style: "min-width:80px", "aria-label": `${item.item_name} 風險`, onchange: (e) => save(item, { risk_level: e.target.value }) },
        RISKS.map((r) => h("option", { value: r, selected: item.risk_level === r }, RISK_LABEL[r])))
      : h("span", { class: `badge b-${item.risk_level}`, title: item.auto_risk ? "依 TFDA 檢查規則自動判定" : null },
        `${RISK_LABEL[item.risk_level]}風險`)),
    h("td", {}, editable
      ? h("input", {
        class: "input notes", value: item.notes ?? "", placeholder: "新增備註…", maxlength: 2000, "aria-label": `${item.item_name} 備註`,
        onchange: (e) => save(item, { notes: e.target.value }),
      })
      : h("span", { class: "small" }, item.notes ?? "")),
    h("td", { class: "no-print" }, editable && !item.item_key
      ? h("button", {
        class: "btn btn-sm btn-ghost btn-danger", "aria-label": `刪除 ${item.item_name}`,
        onclick: async () => {
          if (!(await confirmDialog(`確定刪除「${item.item_name}」？`, { okLabel: "刪除", danger: true }))) return;
          try { onDetail(await api("DELETE", `/api/items/${item.id}`)); toast("已刪除"); } catch (err) { toast(err.message, "error"); }
        },
      }, "刪除")
      : null),
  ));
}

function addItemForm(detail, onDetail) {
  return h("details", { class: "no-print", style: "margin-top:14px" },
    h("summary", { class: "btn btn-sm", style: "display:inline-flex" }, "➕ 新增自訂審查項目"),
    h("form", {
      style: "margin-top:14px",
      onsubmit: async (e) => {
        e.preventDefault();
        try {
          const d = await busy(e.submitter, () => api("POST", `/api/projects/${detail.project.id}/items`, formData(e.target)));
          onDetail(d);
          toast("已新增項目");
        } catch (err) { toast(err.message, "error"); }
      },
    },
      h("div", { class: "form-grid" },
        field("項目名稱", h("input", { class: "input", name: "item_name", required: true, maxlength: 500 })),
        field("類別", h("select", { class: "input", name: "category" },
          ["document", "gmp", "specification", "risk_assessment", "platform_upload", "other"].map((c) => h("option", { value: c }, c)))),
        field("狀態", h("select", { class: "input", name: "status" }, STATUSES.map((s) => h("option", { value: s }, STATUS_LABEL[s])))),
        field("風險等級", h("select", { class: "input", name: "risk_level" }, RISKS.map((r) => h("option", { value: r, selected: r === "medium" }, RISK_LABEL[r])))),
      ),
      field("備註", h("textarea", { class: "input", name: "notes", maxlength: 2000 })),
      h("button", { class: "btn btn-primary", type: "submit" }, "新增項目"),
    ),
  );
}

function toMarkdown({ project, summary, items, action_items }) {
  const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  const lines = [
    `# 法規審查報告 — ${project.name}`,
    "",
    `- **申請類型：** ${project.schema_name}`,
    `- **產出日期：** ${state.today}`,
    `- **整體狀態：** ${OVERALL_LABEL[summary.overall_status]}`,
    `- **完成度：** ${summary.completion_rate.toFixed(1)}%（${summary.completed}/${summary.total}）`,
    `- **截止日期：** ${project.deadline ?? "未設定"}${summary.days_left !== null ? `（剩餘 ${summary.days_left} 天）` : ""}`,
    "",
    "## 檢查清單",
    "",
    "| # | 項目 | 狀態 | 風險 | 備註 |",
    "|---|------|------|------|------|",
    ...items.map((i, n) => `| ${n + 1} | ${esc(i.item_name)} | ${STATUS_LABEL[i.status]} | ${RISK_LABEL[i.risk_level]} | ${esc(i.notes)} |`),
  ];
  if (action_items.length) {
    lines.push("", "## 待辦事項", "");
    for (const a of action_items) lines.push(`- [${a.priority === "high" ? "高" : "中"}] **${a.item}**：${a.action}`);
  }
  return lines.join("\n");
}

function toCsv({ items }) {
  // Leading =+-@ would be evaluated as a formula by Excel (CSV injection), so neutralise it.
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = [["項目", "類別", "必要", "狀態", "風險", "備註", "更新時間"],
    ...items.map((i) => [i.item_name, i.category, i.required ? "是" : "否", STATUS_LABEL[i.status], RISK_LABEL[i.risk_level], i.notes, i.updated_at])];
  // BOM so Excel opens UTF-8 Chinese correctly.
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
