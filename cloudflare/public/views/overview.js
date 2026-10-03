// Project overview: case header (seal + document strip), checklist form, side rail.
import { h, mount, toast, download, formData, busy, confirmDialog, field } from "../lib/dom.js";
import {
  api, state, canEdit, refreshProjects, timelineElapsed,
  STATUS_LABEL, RISK_LABEL, OVERALL_LABEL,
} from "../lib/api.js";
import { docStrip, stripLegend, meter, seal } from "../lib/charts.js";

const STATUSES = ["pending", "in_progress", "under_review", "blocked", "completed"];
const RISKS = ["low", "medium", "high"];

export async function renderOverview(main, params, ctx) {
  const requested = Number(params[0]);
  if (requested) state.currentProjectId = requested;
  if (!state.currentProjectId) {
    mount(main, emptyState(ctx));
    return;
  }
  mount(main, h("p", { class: "muted" }, "正在開啟案件…"));
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
  let first = true;
  draw();

  function onDetail(d) {
    detail = d;
    refreshProjects().catch(() => {});
    draw();
  }
  function draw() {
    mount(main, view(detail, filters, { onDetail, onFilter: drawTable, animate: first }));
    first = false;
  }
  function drawTable() {
    const body = main.querySelector("#checklist-body");
    if (body) mount(body, checklistRows(detail, filters, onDetail));
    const count = main.querySelector("#checklist-count");
    if (count) count.textContent = countLabel(detail.items, filters);
  }
}

function emptyState(ctx) {
  return h("section", { class: "sheet empty" },
    h("h2", {}, "還沒有任何案件"),
    h("p", {}, "建立第一個查驗登記案件，系統會依申請類型帶入 TFDA 文件清單。"),
    canEdit() ? h("div", { class: "btn-row" },
      h("a", { class: "btn btn-primary", href: "#/projects" }, "建立案件"),
      h("button", {
        class: "btn",
        onclick: async (e) => {
          try {
            const res = await busy(e.currentTarget, () => api("POST", "/api/projects/demo", {}));
            await refreshProjects();
            ctx.navigate(`#/overview/${res.project_ids[0]}`);
          } catch (err) { toast(err.message, "error"); }
        },
      }, "載入示範案件"),
    ) : h("p", {}, "請聯絡管理員建立案件。"),
  );
}

function view(detail, filters, { onDetail, onFilter, animate }) {
  const { project, summary, items, action_items } = detail;
  const elapsed = timelineElapsed(project, state.today);
  const behind = elapsed !== null && elapsed > summary.completion_rate;
  const stamp = seal(summary.overall_status);
  if (!animate) stamp.style.animation = "none";

  return [
    h("header", { class: "case" },
      stamp,
      h("div", { class: "case-type" }, project.schema_name, project.status !== "active" ? `（${project.status === "archived" ? "已封存" : "已結案"}）` : ""),
      h("h1", { class: "case-title" }, project.name),
      project.description ? h("p", { class: "case-desc" }, project.description) : null,
      h("dl", { class: "facts" },
        fact("文件完成", summary.completed, `／ ${summary.total} 份`),
        fact("截止日", project.deadline ?? "未設定"),
        fact("剩餘", summary.days_left === null ? "—" : summary.days_left < 0 ? `逾期 ${-summary.days_left}` : summary.days_left, "天",
          summary.days_left !== null && summary.days_left < 30),
        fact("高風險", summary.high_risk_items, "項", summary.high_risk_items > 0),
      ),
      docStrip(items),
      stripLegend(summary.status_counts),
    ),

    h("div", { class: "case-body" },
      h("section", { class: "sheet", "aria-labelledby": "checklist-title" },
        h("h2", { class: "sheet-title", id: "checklist-title" }, "文件檢查清單",
          h("span", { class: "aside", id: "checklist-count" }, countLabel(items, filters))),
        h("div", { class: "filters no-print" },
          h("select", { class: "input", "aria-label": "依狀態篩選", onchange: (e) => { filters.status = e.target.value; onFilter(); } },
            h("option", { value: "" }, "所有狀態"), STATUSES.map((s) => h("option", { value: s, selected: filters.status === s }, STATUS_LABEL[s]))),
          h("select", { class: "input", "aria-label": "依風險篩選", onchange: (e) => { filters.risk = e.target.value; onFilter(); } },
            h("option", { value: "" }, "所有風險"), RISKS.map((r) => h("option", { value: r, selected: filters.risk === r }, `${RISK_LABEL[r]}風險`))),
          h("input", { class: "input search", type: "search", placeholder: "搜尋文件或備註", value: filters.q, "aria-label": "搜尋",
            oninput: (e) => { filters.q = e.target.value; onFilter(); } }),
        ),
        h("div", { class: "table-wrap" },
          h("table", { class: "checklist" },
            h("thead", {}, h("tr", {},
              h("th", {}, h("span", { class: "sr-only" }, "序號")), h("th", {}, "文件"), h("th", {}, "狀態"),
              h("th", {}, "風險"), h("th", {}, "備註"), h("th", { class: "no-print" }, h("span", { class: "sr-only" }, "操作")))),
            h("tbody", { id: "checklist-body" }, checklistRows(detail, filters, onDetail)),
          ),
        ),
        canEdit() ? addItemForm(detail, onDetail) : null,
      ),

      h("aside", { class: "rail" },
        h("section", { class: "sheet" },
          h("h2", { class: "sheet-title" }, "時程"),
          meter("文件完成度", summary.completion_rate),
          meter("時程已過（建立日至截止日）", elapsed, { warn: behind }),
          elapsed === null ? null : h("p", { class: `verdict${behind ? " late" : ""}` },
            behind ? "時程消耗已超過文件完成度，進度落後。" : "文件完成度跟得上時程。"),
        ),
        h("section", { class: "sheet" },
          h("h2", { class: "sheet-title" }, "待辦", h("span", { class: "aside" }, `${action_items.length} 項`)),
          action_items.length
            ? h("ul", { class: "todo" }, action_items.map((a) => h("li", { class: a.priority },
              h("strong", {}, a.item), h("span", {}, a.action))))
            : h("p", { class: "muted small" }, "所有文件都已完成。"),
        ),
        h("section", { class: "sheet no-print" },
          h("h2", { class: "sheet-title" }, "匯出"),
          h("div", { class: "export-links" },
            h("button", { class: "link-btn", style: "font-size:inherit", onclick: () => download(`${project.slug}-review-${state.today}.md`, toMarkdown(detail), "text/markdown") }, "下載 Markdown 報告"),
            h("button", { class: "link-btn", style: "font-size:inherit", onclick: () => download(`${project.slug}-review-${state.today}.csv`, toCsv(detail), "text/csv") }, "下載 CSV（可用 Excel 開啟）"),
            h("button", { class: "link-btn", style: "font-size:inherit", onclick: () => download(`${project.slug}-review-${state.today}.json`, JSON.stringify(detail, null, 2), "application/json") }, "下載 JSON"),
            h("button", { class: "link-btn", style: "font-size:inherit", onclick: () => window.print() }, "列印或存成 PDF"),
          ),
          h("p", { class: "help", style: "margin-top:12px" }, h("a", { href: "#/projects" }, "編輯案件名稱、截止日或封存")),
        ),
      ),
    ),
  ];
}

function fact(label, value, unit, alert = false) {
  return h("div", {},
    h("dt", {}, label),
    h("dd", { class: alert ? "alert" : null }, value, unit ? h("small", {}, unit) : null));
}

function filterItems(items, f) {
  const q = f.q.trim().toLowerCase();
  return items.filter((i) =>
    (!f.status || i.status === f.status) &&
    (!f.risk || i.risk_level === f.risk) &&
    (!q || i.item_name.toLowerCase().includes(q) || (i.notes ?? "").toLowerCase().includes(q)));
}

function countLabel(items, f) {
  const n = filterItems(items, f).length;
  return n === items.length ? `共 ${items.length} 份` : `顯示 ${n} ／ ${items.length} 份`;
}

function checklistRows(detail, filters, onDetail) {
  const editable = canEdit();
  const rows = filterItems(detail.items, filters);
  if (!rows.length) {
    return h("tr", {}, h("td", { colspan: 6, class: "muted" },
      detail.items.length ? "沒有符合篩選條件的文件。" : "這個案件還沒有文件項目，可在下方新增。"));
  }

  const save = async (item, patch) => {
    try {
      onDetail(await api("PATCH", `/api/items/${item.id}`, patch));
      toast("已儲存");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return rows.map((item) => h("tr", {},
    h("td", { class: "seq c-seq" }, detail.items.indexOf(item) + 1),
    h("td", { class: "c-name" },
      h("div", { class: "item-name" }, item.item_name),
      h("div", { class: "item-sub" },
        item.item_key ? (item.required ? "必要文件" : "依適用性") : "自訂項目",
        item.category ? `，${item.category.replace(/_/g, " ")}` : ""),
      item.criteria?.length ? h("details", { class: "criteria" },
        h("summary", {}, `審查門檻（${item.criteria.length} 項）`),
        h("ul", {}, item.criteria.map((c) => h("li", {}, c)))) : null,
    ),
    h("td", { class: "c-status" }, editable
      ? h("select", {
        class: `status-select s-${item.status}`, "aria-label": `${item.item_name} 狀態`,
        onchange: async (e) => {
          // A review threshold is a gate: confirm each criterion before marking the item completed.
          if (e.target.value === "completed" && item.criteria?.length) {
            const ok = await confirmDialog(h("div", {},
              h("strong", {}, `「${item.item_name}」確認已達以下審查門檻？`),
              h("ul", { class: "criteria-list" }, item.criteria.map((c) => h("li", {}, c)))),
            { okLabel: "已達門檻，標記完成" });
            if (!ok) { e.target.value = item.status; return; }
          }
          save(item, { status: e.target.value });
        },
      }, STATUSES.map((s) => h("option", { value: s, selected: item.status === s }, STATUS_LABEL[s])))
      : h("span", { class: `status-text s-${item.status}` }, STATUS_LABEL[item.status])),
    h("td", { class: "c-risk" }, editable && !item.auto_risk
      ? h("select", { class: "input risk-select", "aria-label": `${item.item_name} 風險`, onchange: (e) => save(item, { risk_level: e.target.value }) },
        RISKS.map((r) => h("option", { value: r, selected: item.risk_level === r }, `${RISK_LABEL[r]}`)))
      : h("span", { class: `risk ${item.risk_level}`, title: item.auto_risk ? "依 TFDA 檢查規則自動判定" : null }, RISK_LABEL[item.risk_level])),
    h("td", { class: "c-notes" }, editable
      ? h("input", {
        class: "input notes", value: item.notes ?? "", placeholder: "加上備註", maxlength: 2000, "aria-label": `${item.item_name} 備註`,
        onchange: (e) => save(item, { notes: e.target.value }),
      })
      : h("span", { class: "small" }, item.notes ?? "")),
    h("td", { class: "no-print c-act" }, editable && !item.item_key
      ? h("button", {
        class: "btn btn-sm btn-danger", "aria-label": `刪除 ${item.item_name}`,
        onclick: async () => {
          if (!(await confirmDialog(`刪除「${item.item_name}」？`, { okLabel: "刪除", danger: true }))) return;
          try { onDetail(await api("DELETE", `/api/items/${item.id}`)); toast("已刪除"); } catch (err) { toast(err.message, "error"); }
        },
      }, "刪除")
      : null),
  ));
}

function addItemForm(detail, onDetail) {
  return h("details", { class: "disclose no-print", style: "margin-top:16px" },
    h("summary", {}, "新增自訂文件項目"),
    h("form", {
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
    `# 法規審查報告：${project.name}`,
    "",
    `- **申請類型：** ${project.schema_name}`,
    `- **產出日期：** ${state.today}`,
    `- **整體狀態：** ${OVERALL_LABEL[summary.overall_status]}`,
    `- **完成度：** ${summary.completion_rate.toFixed(1)}%（${summary.completed}/${summary.total}）`,
    `- **截止日期：** ${project.deadline ?? "未設定"}${summary.days_left !== null ? `（剩餘 ${summary.days_left} 天）` : ""}`,
    "",
    "## 文件檢查清單",
    "",
    "| # | 文件 | 狀態 | 風險 | 備註 |",
    "|---|------|------|------|------|",
    ...items.map((i, n) => `| ${n + 1} | ${esc(i.item_name)} | ${STATUS_LABEL[i.status]} | ${RISK_LABEL[i.risk_level]} | ${esc(i.notes)} |`),
  ];
  if (action_items.length) {
    lines.push("", "## 待辦", "");
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
  const rows = [["文件", "類別", "必要", "狀態", "風險", "備註", "更新時間"],
    ...items.map((i) => [i.item_name, i.category, i.required ? "是" : "否", STATUS_LABEL[i.status], RISK_LABEL[i.risk_level], i.notes, i.updated_at])];
  // BOM so Excel opens UTF-8 Chinese correctly.
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
