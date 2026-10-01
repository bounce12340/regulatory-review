// AI document gap analysis: upload → (browser) extract text / pass PDF → Worker → Claude.
import { h, mount, toast, download, busy, field } from "../lib/dom.js";
import { api, state, canEdit } from "../lib/api.js";
import { ACCEPT, prepareDocument } from "../lib/docparse.js";

const SEV = { high: { icon: "🔴", cls: "b-high", label: "高" }, medium: { icon: "🟡", cls: "b-medium", label: "中" }, low: { icon: "🟢", cls: "b-low", label: "低" } };
const GAP_STATUS = { missing: "缺失", incomplete: "不完整", non_compliant: "不符合" };

// Keep the last result while the user navigates around the app.
let lastResult = null;

export async function renderAi(main, _params, ctx) {
  if (!state.schemas.length) state.schemas = (await api("GET", "/api/schemas")).schemas;
  if (!ctx.isCurrent()) return;

  const header = h("header", { class: "page-header" },
    h("div", {}, h("span", { class: "eyebrow" }, "🤖 AI Analysis"), h("h1", {}, "AI 文件缺口分析"),
      h("p", { class: "page-sub" }, "上傳查驗登記文件，AI 依 TFDA 檢查清單逐項比對並產生缺口報告")));

  if (!state.config.ai_enabled) {
    mount(main, header, h("div", { class: "notice warn" },
      "AI 分析尚未啟用。管理員需在 Cloudflare 設定 Worker 密鑰 ANTHROPIC_API_KEY（",
      h("code", {}, "npx wrangler secret put ANTHROPIC_API_KEY"), "）。"));
    return;
  }
  if (!canEdit()) {
    mount(main, header, h("div", { class: "notice info" }, "檢視者角色無法執行 AI 分析，請聯絡管理員調整權限。"));
    return;
  }

  let file = null;
  const results = h("div", {});
  const fileLabel = h("span", {}, "尚未選擇檔案");
  const input = h("input", { type: "file", accept: ACCEPT, class: "sr-only", id: "ai-file",
    onchange: (e) => pick(e.target.files[0]) });
  const analyzeBtn = h("button", { class: "btn btn-primary", disabled: true, onclick: () => run() }, "🔍 開始 AI 分析");
  const schemaSelect = h("select", { class: "input" }, state.schemas.map((s) => h("option", { value: s.key }, s.name_zh)));

  function pick(f) {
    if (!f) return;
    file = f;
    fileLabel.replaceChildren(h("strong", {}, f.name), ` · ${(f.size / 1024).toFixed(0)} KB`);
    analyzeBtn.disabled = false;
  }

  const drop = h("label", {
    class: "dropzone", for: "ai-file",
    ondragover: (e) => { e.preventDefault(); drop.classList.add("drag"); },
    ondragleave: () => drop.classList.remove("drag"),
    ondrop: (e) => { e.preventDefault(); drop.classList.remove("drag"); pick(e.dataTransfer.files[0]); },
  },
    h("div", { style: "font-size:1.8rem" }, "📄"),
    h("div", {}, h("strong", {}, "點選或拖曳檔案至此")),
    h("div", { class: "small" }, "支援 PDF（含掃描檔）、Word .docx、Excel .xlsx、純文字；上限 20 MB"),
    h("div", { class: "small", style: "margin-top:8px" }, fileLabel),
  );

  async function run() {
    if (!file) return;
    results.replaceChildren();
    try {
      await busy(analyzeBtn, async () => {
        const doc = await prepareDocument(file);
        const body = { schema_type: schemaSelect.value, filename: file.name };
        if (doc.kind === "pdf") body.pdf_base64 = doc.pdf_base64;
        else body.text = doc.text;
        lastResult = await api("POST", "/api/ai/analyze", body);
      }, "分析中，約需 30–120 秒…");
      mount(results, report(lastResult));
    } catch (err) {
      mount(results, h("div", { class: "notice error", role: "alert" }, `分析失敗：${err.message}`));
    }
  }

  mount(main, header,
    h("section", { class: "card" },
      h("div", { class: "card-title" }, "📁 文件上傳與設定"),
      h("div", { class: "grid grid-2" },
        h("div", {}, drop, input),
        h("div", {},
          field("申請類型", schemaSelect, "AI 會依此類型的 TFDA 檢查清單逐項比對"),
          h("p", { class: "help" }, `模型：${state.config.ai_model}。文件內容會傳送至 Anthropic API 進行分析，請勿上傳未經授權的機密資料。`),
          analyzeBtn,
        ),
      ),
    ),
    results,
  );
  if (lastResult) mount(results, report(lastResult));
}

function report(r) {
  const scoreCls = r.completeness_score >= 80 ? "k-green" : r.completeness_score >= 50 ? "k-amber" : "k-red";
  const riskCls = { high: "k-red", medium: "k-amber", low: "k-green" }[r.risk_assessment];
  const gaps = [...r.gaps].sort((a, b) => ["high", "medium", "low"].indexOf(a.severity) - ["high", "medium", "low"].indexOf(b.severity));
  const base = r.filename.replace(/\.[^.]+$/, "");

  return h("div", {},
    h("section", { class: "kpis" },
      kpi(scoreCls, `${r.completeness_score}%`, "完整度評分"),
      kpi(riskCls, SEV[r.risk_assessment]?.label ?? r.risk_assessment, "整體風險"),
      kpi("k-red", gaps.filter((g) => g.severity === "high").length, "高風險缺口"),
      kpi("k-green", r.compliant_items.length, "符合項目"),
    ),
    h("section", { class: "card" },
      h("div", { class: "card-title" }, "📝 分析摘要"),
      h("p", { style: "margin-top:0" }, r.summary),
      h("p", { class: "help" },
        `檔案：${r.filename} · 類型：${r.schema_type_zh} · 預估審查時間：${r.estimated_review_time} · ` +
        `模型：${r.model} · Token：輸入 ${r.token_usage.input_tokens.toLocaleString()} / 輸出 ${r.token_usage.output_tokens.toLocaleString()} · ` +
        `估計費用：US$${r.cost_usd.toFixed(4)}（約 NT$${r.cost_twd.toFixed(2)}）`),
      h("div", { class: "notice info small", style: "margin:10px 0 0" },
        "AI 分析結果僅供內部初步檢查參考，不構成法規意見；送件前請由 RA 人員依 TFDA 現行公告與審查要求確認。"),
    ),
    h("section", { class: "card" },
      h("div", { class: "card-title" }, `⚠️ 缺口清單（${gaps.length} 項）`),
      gaps.length ? gaps.map((g) => h("details", { class: "gap", open: g.severity === "high" },
        h("summary", {}, SEV[g.severity]?.icon ?? "⚪", g.requirement,
          h("span", { class: `badge ${SEV[g.severity]?.cls ?? "b-neutral"}` }, `${SEV[g.severity]?.label ?? g.severity} · ${GAP_STATUS[g.status] ?? g.status}`)),
        h("div", { class: "gap-body" },
          h("div", {}, h("strong", {}, "說明："), g.explanation),
          h("div", {}, h("strong", {}, "建議："), g.recommendation),
        ),
      )) : h("p", { class: "muted" }, "未發現缺口。"),
    ),
    r.action_items.length ? h("section", { class: "card" },
      h("div", { class: "card-title" }, "🎯 優先處理項目"),
      h("ol", { style: "margin:0;padding-left:20px" }, r.action_items.map((a) => h("li", { style: "margin-bottom:6px" }, a))),
    ) : null,
    h("section", { class: "card no-print" },
      h("div", { class: "card-title" }, "匯出報告"),
      h("div", { class: "btn-row" },
        h("button", { class: "btn", onclick: () => download(`gap-report-${base}.md`, toMarkdown(r), "text/markdown") }, "⬇ Markdown"),
        h("button", { class: "btn", onclick: () => download(`gap-report-${base}.json`, JSON.stringify(r, null, 2), "application/json") }, "⬇ JSON"),
        h("button", { class: "btn", onclick: () => window.print() }, "🖨 列印 / 存成 PDF"),
      ),
    ),
  );
}

function kpi(cls, value, label) {
  return h("div", { class: `kpi ${cls}` }, h("div", { class: "kpi-value" }, value), h("div", { class: "kpi-label" }, label));
}

function toMarkdown(r) {
  const lines = [
    "# TFDA 法規缺口分析報告",
    "",
    `- **文件：** ${r.filename}`,
    `- **申請類型：** ${r.schema_type_zh}`,
    `- **完整度評分：** ${r.completeness_score}/100`,
    `- **風險等級：** ${SEV[r.risk_assessment]?.label ?? r.risk_assessment}`,
    `- **預估審查時間：** ${r.estimated_review_time}`,
    `- **分析模型：** ${r.model}`,
    "",
    "## 摘要",
    r.summary,
    "",
    "## 缺口清單",
  ];
  if (!r.gaps.length) lines.push("", "未發現缺口。");
  for (const g of r.gaps) {
    lines.push("", `### ${SEV[g.severity]?.icon ?? ""} ${g.requirement}`,
      `- **狀態：** ${GAP_STATUS[g.status] ?? g.status}`,
      `- **嚴重程度：** ${SEV[g.severity]?.label ?? g.severity}`,
      `- **說明：** ${g.explanation}`,
      `- **建議：** ${g.recommendation}`);
  }
  lines.push("", "## 優先處理項目", ...r.action_items.map((a, i) => `${i + 1}. ${a}`));
  lines.push("", "---", "_AI 分析結果僅供內部初步檢查參考，不構成法規意見。_");
  return lines.join("\n");
}
