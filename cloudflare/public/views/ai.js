// AI document gap analysis: upload → (browser) extract text → Worker → Ollama.
import { h, mount, download, busy, field, toast } from "../lib/dom.js";
import { api, state, canEdit, groupSchemas, RISK_LABEL } from "../lib/api.js";
import { ACCEPT, MAX_TEXT_CHARS, prepareDocument } from "../lib/docparse.js";

const MAX_FILES = 20; // keep in step with MAX_FILES in src/ai.ts

const GAP_STATUS = { missing: "缺少", incomplete: "不完整", non_compliant: "不符合" };
const SEV_ORDER = ["high", "medium", "low"];

// Keep the last result while the user moves around the app.
let lastResult = null;

export async function renderAi(main, _params, ctx) {
  if (!state.schemas.length) state.schemas = (await api("GET", "/api/schemas")).schemas;
  if (!ctx.isCurrent()) return;

  const header = h("header", { class: "page-head" },
    h("h1", {}, "AI 文件分析"),
    h("p", {}, "上傳一份或多份申請文件，AI 會依所選申請類型的 TFDA 文件清單逐項比對，列出缺少或不完整的地方。"));

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

  // Picked documents, extracted to text as soon as they are added so problems show up early.
  // Each: {file, text, error} — text is null while extracting.
  const docs = [];
  let running = false;
  const results = h("div", {});
  const fileList = h("ul", { class: "file-list" });
  const totalLine = h("p", { class: "small file-total", "aria-live": "polite" });
  const input = h("input", { type: "file", accept: ACCEPT, multiple: true, class: "sr-only", id: "ai-file",
    onchange: (e) => { add(e.target.files); e.target.value = ""; } }); // reset so the same file can be picked again
  const analyzeBtn = h("button", { class: "btn btn-primary btn-block", disabled: true, onclick: () => run() }, "開始分析");
  const schemaSelect = h("select", { class: "input" }, groupSchemas(state.schemas).map((g) =>
    h("optgroup", { label: g.label }, g.items.map((s) => h("option", { value: s.key }, s.name_zh)))));

  function add(list) {
    for (const f of list) {
      if (docs.some((d) => d.file.name === f.name && d.file.size === f.size)) continue;
      if (docs.length >= MAX_FILES) { toast(`一次最多分析 ${MAX_FILES} 份文件。`, "error"); break; }
      const d = { file: f, text: null, error: null };
      docs.push(d);
      prepareDocument(f).then((r) => { d.text = r.text; }, (err) => { d.error = err.message; }).finally(render);
    }
    render();
  }

  function remove(d) {
    docs.splice(docs.indexOf(d), 1);
    render();
  }

  const ready = () => docs.filter((d) => d.text);
  const totalChars = () => ready().reduce((n, d) => n + d.text.length, 0);

  function render() {
    fileList.replaceChildren(...docs.map((d) => h("li", { class: d.error ? "bad" : null },
      h("b", {}, d.file.name),
      h("span", { class: "muted" }, d.error ? null : d.text === null ? "讀取中…" : `${d.text.length.toLocaleString()} 字`),
      // preventDefault keeps the click from also opening the file picker of the surrounding label.
      h("button", { type: "button", class: "btn btn-sm btn-danger file-remove", "aria-label": `移除 ${d.file.name}`,
        onclick: (e) => { e.preventDefault(); e.stopPropagation(); remove(d); } }, "移除"),
      d.error ? h("span", { class: "error-text" }, d.error) : null)));
    const total = totalChars();
    const over = total > MAX_TEXT_CHARS;
    const pending = docs.some((d) => d.text === null && !d.error);
    totalLine.className = `small file-total${over ? " error-text" : ""}`;
    totalLine.textContent = !docs.length ? "尚未選擇檔案"
      : `${ready().length} 份可分析，合計 ${total.toLocaleString()}／${MAX_TEXT_CHARS.toLocaleString()} 字` +
        (over ? "，超過單次上限，請移除部分文件或分次分析。" : "") +
        (docs.some((d) => d.error) ? "；無法讀取的檔案不會送出。" : "");
    analyzeBtn.disabled = running || pending || over || !ready().length;
  }

  function clearResult() {
    lastResult = null;
    results.replaceChildren();
  }

  const drop = h("label", {
    class: "dropzone", for: "ai-file",
    ondragover: (e) => { e.preventDefault(); drop.classList.add("drag"); },
    ondragleave: () => drop.classList.remove("drag"),
    ondrop: (e) => { e.preventDefault(); drop.classList.remove("drag"); add(e.dataTransfer.files); },
  },
    h("strong", {}, h("span", { class: "hover-only" }, "選擇或拖曳文件到這裡"), h("span", { class: "touch-only" }, "點這裡選擇文件")),
    h("div", { class: "small" }, `可一次選多份，合併為同一個申請案分析。含文字的 PDF、Word .docx、Excel .xlsx、純文字，每份 20 MB 以內，最多 ${MAX_FILES} 份（掃描檔請先做 OCR）`),
  );

  async function run() {
    const files = ready().map((d) => ({ filename: d.file.name, text: d.text }));
    if (!files.length) return;
    results.replaceChildren();
    running = true;
    try {
      await busy(analyzeBtn, async () => {
        lastResult = await api("POST", "/api/ai/analyze", { schema_type: schemaSelect.value, files });
      }, "分析中，約需 30 秒到 2 分鐘");
      mount(results, report(lastResult, clearResult));
      results.querySelector("h2")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    } catch (err) {
      mount(results, h("div", { class: "notice error", role: "alert" }, `無法完成分析：${err.message}`));
    } finally {
      running = false;
      render(); // busy() re-enables the button; put back the real state
    }
  }

  mount(main, header,
    h("section", { class: "sheet" },
      h("div", { class: "intake" },
        h("div", {}, drop, input, fileList, totalLine),
        h("div", {},
          field("申請類型", schemaSelect, "AI 會用這個類型的文件清單逐項比對"),
          analyzeBtn,
          h("p", { class: "help", style: "margin-top:12px" },
            `使用模型 ${state.config.ai_model}。文件會先在你的瀏覽器轉成文字，再傳送到 Ollama 雲端分析，請勿上傳未經授權的機密資料。`),
          h("p", { class: "help" }, "整份申請資料超過上限時，可在案件頁用「批次上傳」放入各檢查項目，再執行「AI 全案審查」逐項審查。"),
        ),
      ),
    ),
    results,
  );
  render();
  if (lastResult) mount(results, report(lastResult, clearResult));
}

function report(r, onClear) {
  const gaps = [...r.gaps].sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));
  const high = gaps.filter((g) => g.severity === "high").length;
  const base = (r.files?.length > 1 ? `${r.files[0].replace(/\.[^.]+$/, "")}-${r.files.length}files` : r.filename.replace(/\.[^.]+$/, ""));

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
      r.files?.length > 1 ? h("p", { class: "small" }, h("b", {}, `分析文件（${r.files.length} 份）：`), r.files.join("、")) : null,
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
        h("button", { class: "btn btn-danger", style: "margin-left:auto", onclick: onClear }, "清除分析結果"),
      ),
      h("p", { class: "help", style: "margin-top:10px" }, "上傳的文件與分析結果都不會存到伺服器；清除後就無法再找回，需要的話請先下載。"),
    ),
  );
}

function toMarkdown(r) {
  const lines = [
    "# TFDA 文件缺口分析報告",
    "",
    r.files?.length > 1 ? `- **文件（${r.files.length} 份）：** ${r.files.join("、")}` : `- **文件：** ${r.filename}`,
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
