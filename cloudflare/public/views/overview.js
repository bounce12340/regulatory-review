// Project overview: case header (seal + document strip), checklist form, side rail.
import { h, mount, toast, download, formData, busy, confirmDialog, textDialog, field } from "../lib/dom.js";
import {
  api, state, canEdit, refreshProjects, timelineElapsed, alertText,
  STATUS_LABEL, RISK_LABEL, OVERALL_LABEL,
} from "../lib/api.js";
import { docStrip, stripLegend, meter, seal } from "../lib/charts.js";

const STATUSES = ["pending", "in_progress", "under_review", "blocked", "completed", "not_applicable"];
// 「是」in a TFDA RTF checklist: the document is in, or the item does not apply (with a reason).
const isResolved = (i) => i.status === "completed" || i.status === "not_applicable";
const NA_PREFIX = "不適用原因：";
const RISKS = ["low", "medium", "high"];
const TODO_LIMIT = 6;
// Below this share of elapsed time a timeline meter says nothing useful yet.
const TIMELINE_MIN_ELAPSED = 5;

// Checklist sections, in CTD order. Schemas whose categories don't match any of these
// (the food / device / import templates) keep a flat list.
const GROUPS = [
  { key: "m1_admin", label: "M1 行政文件", cats: ["module1_admin"] },
  { key: "m1_quality", label: "M1 品質證明文件", cats: ["module1_quality_docs"] },
  { key: "m3_s", label: "M3 原料藥（3.2.S）", cats: ["module3_drug_substance"] },
  { key: "m3_p", label: "M3 成品（3.2.P）", cats: ["module3_drug_product"] },
  { key: "m4", label: "M4 非臨床", cats: ["module4_nonclinical"] },
  { key: "m5", label: "M5 臨床", cats: ["module5_clinical"] },
  { key: "cross", label: "全案一致性", cats: ["cross_module"] },
  { key: "nda_type", label: "新藥類別審查重點（依適用性）", cats: ["nda_type"] },
  // 國外藥廠 PMF: sections follow TFDA's forms A, B, C-1, the route-specific documents and C-2～C-5.
  { key: "pmf_a", label: "表A 送審表", cats: ["pmf_form_a"] },
  { key: "pmf_b", label: "表B 行政文件", cats: ["pmf_form_b"] },
  { key: "pmf_c1", label: "表C-1 共通性資料", cats: ["pmf_form_c1"] },
  { key: "pmf_mode", label: "申請方式應附文件（簡化／確效替代）", cats: ["pmf_mode"] },
  { key: "pmf_c", label: "表C-2～C-5 技術查核表", cats: ["pmf_form_c"] },
  { key: "gmp_onsite", label: "實地查核申請文件", cats: ["gmp_onsite"] },
  // 銜接性試驗評估（BSE）: Appendix E items, the self-assessment report, then the study if one is required.
  { key: "bse_check", label: "附錄E 查檢表（Ⅰ～Ⅷ）", cats: ["bse_check"] },
  { key: "bse_report", label: "BSE 自我評估報告", cats: ["bse_report"] },
  { key: "bse_study", label: "銜接性試驗（經評估須執行時）", cats: ["bse_study"] },
  // 原料藥／DMF RTF checklists: sections follow the refuse-to-file rules, so row numbers
  // stay the same as the numbering on TFDA's form.
  { key: "rtf_gate", label: "退件關鍵項", cats: ["rtf_gate"] },
  { key: "rtf_secondary", label: "退件累計項", cats: ["rtf_secondary"] },
];
const CUSTOM_GROUP = { key: "custom", label: "自訂項目" };

// Sections the user opened or closed, per project, for this browser tab. Unset sections
// start closed only when every document in them is completed.
const sectionOpen = new Map();

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
    const table = main.querySelector("#checklist-table");
    if (table) {
      table.querySelectorAll(":scope > tbody").forEach((b) => b.remove());
      table.append(...checklistBodies(detail, filters, onDetail));
    }
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
  const urgent = alertText(summary);
  const stamp = seal(summary.overall_status, urgent);
  if (!animate) stamp.style.animation = "none";

  return [
    h("header", { class: "case" },
      stamp,
      h("div", { class: "case-type" }, project.schema_name, project.status !== "active" ? `（${project.status === "archived" ? "已封存" : "已結案"}）` : ""),
      h("h1", { class: "case-title" }, project.name),
      project.description ? h("p", { class: "case-desc" }, project.description) : null,
      h("dl", { class: "facts" },
        fact("文件完成", summary.completed, `／ ${summary.total - summary.not_applicable} 份${summary.not_applicable ? `（不適用 ${summary.not_applicable}）` : ""}`),
        fact("截止日", project.deadline ?? "未設定"),
        fact("剩餘", summary.days_left === null ? "—" : summary.days_left < 0 ? `逾期 ${-summary.days_left}` : summary.days_left, "天",
          summary.alert_reasons.includes("overdue") || summary.alert_reasons.includes("due_soon")),
        fact("高風險", summary.high_risk_items, "項", summary.alert && summary.high_risk_items > 0),
        summary.blocked_items ? fact("受阻", summary.blocked_items, "項", true) : null,
        detail.rtf ? fact("RTF 判定", detail.rtf.verdict === "refuse" ? "退件" : "續審", null, detail.rtf.verdict === "refuse") : null,
      ),
      urgent ? h("p", { class: "case-alert" }, `需要立即處理：${urgent}。`) : null,
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
          h("table", { class: "checklist", id: "checklist-table" },
            h("thead", {}, h("tr", {},
              h("th", {}, h("span", { class: "sr-only" }, "序號")), h("th", {}, "文件"), h("th", {}, "狀態"),
              h("th", {}, "風險"), h("th", {}, "備註"), h("th", { class: "no-print" }, h("span", { class: "sr-only" }, "操作")))),
            checklistBodies(detail, filters, onDetail),
          ),
        ),
        canEdit() ? addItemForm(detail, onDetail) : null,
      ),

      h("aside", { class: "rail" },
        detail.rtf ? rtfPanel(detail.rtf) : null,
        h("section", { class: "sheet" },
          h("h2", { class: "sheet-title" }, "時程"),
          meter("文件完成度", summary.completion_rate),
          elapsed !== null && elapsed < TIMELINE_MIN_ELAPSED
            ? h("p", { class: "verdict" }, `案件剛開始，剩 ${summary.days_left} 天。時程過了 ${TIMELINE_MIN_ELAPSED}% 之後，這裡會比較時程與文件完成度。`)
            : [
              meter("時程已過（建立日至截止日）", elapsed, { warn: behind }),
              elapsed === null ? null : h("p", { class: `verdict${behind ? " late" : ""}` },
                behind ? "時程消耗已超過文件完成度，進度落後。" : "文件完成度跟得上時程。"),
            ],
        ),
        h("section", { class: "sheet" },
          h("h2", { class: "sheet-title" }, "待辦", h("span", { class: "aside" }, `${action_items.length} 項`)),
          todoList(action_items),
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

/** TFDA refuse-to-file self-check: what the RTF review would decide if the case went in today. */
function rtfPanel(rtf) {
  const refused = rtf.verdict === "refuse";
  return h("section", { class: "sheet rtf" },
    h("h2", { class: "sheet-title" }, "RTF 退件判定"),
    h("p", { class: `rtf-verdict${refused ? " refuse" : " pass"}` },
      h("span", {}, "若現在送件"), h("b", {}, refused ? "退件" : "續審")),
    h("ol", { class: "rtf-rules" }, rtf.rules.map((r) => h("li", { class: r.refused ? "refused" : null },
      h("div", { class: "rtf-rule" }, r.rule),
      h("div", { class: "rtf-count" },
        r.failures.length ? `目前「否」${r.failures.length} 項` : "目前沒有「否」",
        r.max_failures ? `，可容許 ${r.max_failures} 項` : ""),
      r.failures.length ? h("ul", {}, r.failures.map((f) => h("li", {}, f.item))) : null))),
    h("p", { class: "help" }, "「已完成」或「不適用（附原因）」視為「是」，其他狀態視為「否」。正式結果以 TFDA 審核為準。"),
  );
}

function todoList(actionItems) {
  if (!actionItems.length) return h("p", { class: "muted small" }, "所有文件都已完成。");
  // High priority first; the full list is in the checklist and the exported report.
  const sorted = [...actionItems].sort((a, b) => (a.priority === "high" ? 0 : 1) - (b.priority === "high" ? 0 : 1));
  const shown = sorted.slice(0, TODO_LIMIT);
  const rest = sorted.length - shown.length;
  return [
    h("ul", { class: "todo" }, shown.map((a) => h("li", { class: a.priority },
      h("strong", {}, a.item), h("span", {}, a.action)))),
    rest > 0 ? h("p", { class: "todo-more" }, `另有 ${rest} 項，完整內容見文件檢查清單或匯出報告。`) : null,
  ];
}

function groupItems(items) {
  const byCat = new Map(GROUPS.flatMap((g) => g.cats.map((c) => [c, g])));
  if (!items.some((i) => i.item_key && byCat.has(i.category))) return null;
  const groups = new Map([...GROUPS, CUSTOM_GROUP].map((g) => [g.key, { ...g, items: [] }]));
  for (const item of items) {
    const g = (item.item_key && byCat.get(item.category)) || CUSTOM_GROUP;
    groups.get(g.key).items.push(item);
  }
  return [...groups.values()].filter((g) => g.items.length);
}

// Section order, so row numbers match what the user sees (and the exported report).
function displayOrder(items) {
  return groupItems(items)?.flatMap((g) => g.items) ?? items;
}

function checklistBodies(detail, filters, onDetail) {
  const { items } = detail;
  const shown = filterItems(items, filters);
  const groups = groupItems(items);
  const seq = new Map(displayOrder(items).map((item, n) => [item, n + 1]));
  const emptyBody = (text) => h("tbody", {}, h("tr", {}, h("td", { colspan: 6, class: "muted" }, text)));
  if (!items.length) return [emptyBody("這個案件還沒有文件項目，可在下方新增。")];
  if (!shown.length) return [emptyBody("沒有符合篩選條件的文件。")];

  const save = async (item, patch) => {
    try {
      onDetail(await api("PATCH", `/api/items/${item.id}`, patch));
      toast("已儲存");
    } catch (err) {
      toast(err.message, "error");
    }
  };
  const row = (item) => itemRow(item, seq.get(item), save, onDetail);

  if (!groups) return [h("tbody", {}, shown.map(row))];

  // While filtering, every matching row stays visible; sections with no match drop out.
  const filtering = Boolean(filters.status || filters.risk || filters.q.trim());
  const visible = new Set(shown);
  return groups.flatMap((g) => {
    const rows = g.items.filter((i) => visible.has(i));
    if (!rows.length) return [];
    const done = g.items.filter(isResolved).length;
    const na = g.items.filter((i) => i.status === "not_applicable").length;
    const stateKey = `${detail.project.id}:${g.key}`;
    const open = filtering || (sectionOpen.get(stateKey) ?? done < g.items.length);
    const headId = `grp-${g.key}`;
    const body = h("tbody", { class: open ? null : "collapsed", "aria-labelledby": headId },
      h("tr", { class: "group-row" }, h("th", { colspan: 6, scope: "rowgroup" },
        h("button", {
          type: "button", class: "group-toggle", id: headId, "aria-expanded": String(open), disabled: filtering,
          onclick: (e) => {
            const next = body.classList.toggle("collapsed") === false;
            sectionOpen.set(stateKey, next);
            e.currentTarget.setAttribute("aria-expanded", String(next));
          },
        },
          h("span", { class: "group-label" }, g.label),
          decorative(docStrip(g.items, { mini: true })),
          h("span", { class: `group-count${done === g.items.length ? " all-done" : ""}` }, `完成 ${done}／${g.items.length}${na ? `（含不適用 ${na}）` : ""}`),
        ))),
      rows.map(row));
    return [body];
  });
}

// The count next to it already says it; keep the button's accessible name short.
function decorative(el) {
  el.setAttribute("aria-hidden", "true");
  return el;
}

function itemRow(item, n, save, onDetail) {
  const editable = canEdit();
  return h("tr", {},
    h("td", { class: "seq c-seq" }, n),
    h("td", { class: "c-name" },
      h("div", { class: "item-name" }, item.item_name),
      h("div", { class: "item-sub" }, item.item_key ? (item.required ? "必要文件" : "依適用性") : "自訂項目"),
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
          // TFDA's RTF forms ask for a reason next to every「不適用」; it is kept in the notes.
          if (e.target.value === "not_applicable") {
            const prior = (item.notes ?? "").startsWith(NA_PREFIX) ? item.notes.slice(NA_PREFIX.length) : "";
            const reason = await textDialog(h("strong", {}, `「${item.item_name}」為什麼不適用？`),
              { label: "不適用原因", value: prior, okLabel: "標記不適用" });
            if (reason === null) { e.target.value = item.status; return; }
            const rest = item.notes && !item.notes.startsWith(NA_PREFIX) ? `\n${item.notes}` : "";
            save(item, { status: "not_applicable", notes: `${NA_PREFIX}${reason}${rest}`.slice(0, 2000) });
            return;
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
  );
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

function toMarkdown({ project, summary, items, action_items, rtf }) {
  const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  const lines = [
    `# 法規審查報告：${project.name}`,
    "",
    `- **申請類型：** ${project.schema_name}`,
    `- **產出日期：** ${state.today}`,
    `- **整體狀態：** ${OVERALL_LABEL[summary.overall_status]}`,
    `- **完成度：** ${summary.completion_rate.toFixed(1)}%（${summary.completed}/${summary.total - summary.not_applicable}${summary.not_applicable ? `，另 ${summary.not_applicable} 項不適用` : ""}）`,
    `- **截止日期：** ${project.deadline ?? "未設定"}${summary.days_left !== null ? `（剩餘 ${summary.days_left} 天）` : ""}`,
    "",
    "## 文件檢查清單",
    "",
    "| # | 文件 | 狀態 | 風險 | 備註 |",
    "|---|------|------|------|------|",
    ...displayOrder(items).map((i, n) => `| ${n + 1} | ${esc(i.item_name)} | ${STATUS_LABEL[i.status]} | ${RISK_LABEL[i.risk_level]} | ${esc(i.notes)} |`),
  ];
  if (rtf) {
    lines.push("", "## RTF 退件判定（自我檢核）", "", `- **若現在送件：** ${rtf.verdict === "refuse" ? "退件" : "續審"}`);
    for (const r of rtf.rules) {
      lines.push(`- ${r.rule}：目前「否」${r.failures.length} 項${r.refused ? "（觸發退件）" : ""}`);
      for (const f of r.failures) lines.push(`  - ${f.item}`);
    }
  }
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
