// AI document gap analysis: upload → (browser) extract text → Worker → Ollama.
import { h, mount, download, busy, field } from "../lib/dom.js";
import { api, state, canEdit, RISK_LABEL } from "../lib/api.js";
import { ACCEPT, prepareDocument } from "../lib/docparse.js";

const GAP_STATUS = { missing: "缺少", incomplete: "不完整", non_compliant: "不符合" };
const SEV_ORDER = ["high", "medium", "low"];

// Keep the last result while the user moves around the app.
let lastResult = null;

export async function renderAi(main, _params, ctx) {
  if (!state.schemas.length) state.schemas = (await api("GET", "/api/schemas")).schemas;
  if (!ctx.isCurrent()) return;

  const header = h("header", { class: "page-head" },
    h("h1", {}, "AI 文件分析"),
    h("p", {}, "上傳申請文件，AI 會依所選申請類型的 TFDA 文件清單逐項比對，列出缺少或不完整的地方。"));

  if (!state.config.ai_enabled) {
    mount(main, header, h("div", { class: "notice warn" },
      "AI 分析尚未啟用。請管理員在 Cloudflare 為這個 Worker 設定密鑰 OLLAMA_API_KEY，例如執行 ",
      h("code", {}, "npx wrangler secret put OLLAMA_API_KEY"), "。"));
    return;
  }
  if (!canEdit()) {
    mount(main, header, h("div", { class: "notice" }, "檢視者無法執行 AI 分析。如需使用，請管理員把你的角色改為成員。"));
    return;
  }

  let file = null;
  const results = h("div", {});
  const fileLine = h("div", { class: "file" }, "尚未選擇檔案");
  const input = h("input", { type: "file", accept: ACCEPT, class: "sr-only", id: "ai-file", onchange: (e) => pick(e.target.files[0]) });
  const analyzeBtn = h("button", { class: "btn btn-primary btn-block", disabled: true, onclick: () => run() }, "開始分析");
  const schemaSelect = h("select", { class: "input" }, state.schemas.map((s) => h("option", { value: s.key }, s.name_zh)));

  function pick(f) {
    if (!f) return;
    file = f;
    fileLine.replaceChildren(h("b", {}, f.name), `（${Math.max(1, Math.round(f.size / 1024))} KB）`);
    analyzeBtn.disabled = false;
  }

  const drop = h("label", {
    class: "dropzone", for: "ai-file",
    ondragover: (e) => { e.preventDefault(); drop.classList.add("drag"); },
    ondragleave: () => drop.classList.remove("drag"),
    ondrop: (e) => { e.preventDefault(); drop.classList.remove("drag"); pick(e.dataTransfer.files[0]); },
  },
    h("strong", {}, "選擇或拖曳文件到這裡"),
    h("div", { class: "small" }, "含文字的 PDF、Word .docx、Excel .xlsx、純文字，20 MB 以內（掃描檔請先做 OCR）"),
    fileLine,
  );

  async function run() {
    if (!file) return;
    results.replaceChildren();
    try {
      await busy(analyzeBtn, async () => {
        const doc = await prepareDocument(file);
        lastResult = await api("POST", "/api/ai/analyze", { schema_type: schemaSelect.value, filename: file.name, text: doc.text });
      }, "分析中，約需 30 秒到 2 分鐘");
      mount(results, report(lastResult));
      results.querySelector("h2")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    } catch (err) {
      mount(results, h("div", { class: "notice error", role: "alert" }, `無法完成分析：${err.message}`));
    }
  }

  mount(main, header,
    h("section", { class: "sheet" },
      h("div", { class: "intake" },
        h("div", {}, drop, input),
        h("div", {},
          field("申請類型", schemaSelect, "AI 會用這個類型的文件清單逐項比對"),
          analyzeBtn,
          h("p", { class: "help", style: "margin-top:12px" },
            `使用模型 ${state.config.ai_model}。文件會先在你的瀏覽器轉成文字，再傳送到 Ollama 雲端分析，請勿上傳未經授權的機密資料。`),
        ),
      ),
    ),
    results,
  );
  if (lastResult) mount(results, report(lastResult));
}

function report(r) {
  const gaps = [...r.gaps].sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));
  const high = gaps.filter((g) => g.severity === "high").length;
  const base = r.filename.replace(/\.[^.]+$/, "");

  return h("div", {},
    h("section", { class: "sheet" },
      h("h2", { class: "sheet-title" }, `分析結果：${r.filename}`, h("span", { class: "aside" }, r.schema_type_zh)),
      h("dl", { class: "facts", style: "margin-top:0" },
        h("div", {}, h("dt", {}, "完整度"), h("dd", {}, h("span", { class: "score" }, r.completeness_score), h("small", {}, "／ 100"))),
        h("div", {}, h("dt", {}, "整體風險"), h("dd", { class: r.risk_assessment === "high" ? "alert" : null }, RISK_LABEL[r.risk_assessment] ?? r.risk_assessment)),
        h("div", {}, h("dt", {}, "高風險缺口"), h("dd", { class: high ? "alert" : null }, high, h("small", {}, "項"))),
        h("div", {}, h("dt", {}, "已符合"), h("dd", {}, r.compliant_items.length, h("small", {}, "項"))),
        h("div", {}, h("dt", {}, "預估審查時間"), h("dd", {}, r.estimated_review_time)),
      ),
      h("p", { style: "max-width:72ch" }, r.summary),
      h("p", { class: "help" },
        `模型 ${r.model}，輸入 ${r.token_usage.input_tokens.toLocaleString()} tokens、輸出 ${r.token_usage.output_tokens.toLocaleString()} tokens。`),
      h("div", { class: "notice", style: "margin:12px 0 0" },
        "AI 分析僅供內部初步檢查，不構成法規意見；送件前請由 RA 人員依 TFDA 現行公告確認。"),
    ),
    h("section", { class: "sheet" },
      h("h2", { class: "sheet-title" }, `缺口清單（${gaps.length} 項）`),
      gaps.length ? gaps.map((g) => h("details", { class: "gap", open: g.severity === "high" },
        h("summary", {},
          h("span", { class: `risk ${g.severity}` }, RISK_LABEL[g.severity] ?? g.severity),
          g.requirement,
          h("span", { class: "muted small", style: "font-weight:400" }, GAP_STATUS[g.status] ?? g.status)),
        h("div", { class: "gap-body" },
          h("div", {}, h("b", {}, "原因"), g.explanation),
          h("div", {}, h("b", {}, "建議"), g.recommendation),
        ),
      )) : h("p", { class: "muted" }, "沒有發現缺口。"),
    ),
    r.action_items.length ? h("section", { class: "sheet" },
      h("h2", { class: "sheet-title" }, "建議處理順序"),
      h("ol", { style: "margin:0;padding-left:1.4em;max-width:72ch" }, r.action_items.map((a) => h("li", { style: "margin-bottom:6px" }, a))),
    ) : null,
    h("section", { class: "sheet no-print" },
      h("h2", { class: "sheet-title" }, "匯出"),
      h("div", { class: "btn-row" },
        h("button", { class: "btn", onclick: () => download(`gap-report-${base}.md`, toMarkdown(r), "text/markdown") }, "下載 Markdown"),
        h("button", { class: "btn", onclick: () => download(`gap-report-${base}.json`, JSON.stringify(r, null, 2), "application/json") }, "下載 JSON"),
        h("button", { class: "btn", onclick: () => window.print() }, "列印或存成 PDF"),
      ),
    ),
  );
}

function toMarkdown(r) {
  const lines = [
    "# TFDA 文件缺口分析報告",
    "",
    `- **文件：** ${r.filename}`,
    `- **申請類型：** ${r.schema_type_zh}`,
    `- **完整度：** ${r.completeness_score}/100`,
    `- **整體風險：** ${RISK_LABEL[r.risk_assessment] ?? r.risk_assessment}`,
    `- **預估審查時間：** ${r.estimated_review_time}`,
    `- **分析模型：** ${r.model}`,
    "",
    "## 摘要",
    r.summary,
    "",
    "## 缺口清單",
  ];
  if (!r.gaps.length) lines.push("", "沒有發現缺口。");
  for (const g of r.gaps) {
    lines.push("", `### ${g.requirement}`,
      `- **狀態：** ${GAP_STATUS[g.status] ?? g.status}`,
      `- **風險：** ${RISK_LABEL[g.severity] ?? g.severity}`,
      `- **原因：** ${g.explanation}`,
      `- **建議：** ${g.recommendation}`);
  }
  lines.push("", "## 建議處理順序", ...r.action_items.map((a, i) => `${i + 1}. ${a}`));
  lines.push("", "---", "_AI 分析僅供內部初步檢查，不構成法規意見。_");
  return lines.join("\n");
}
