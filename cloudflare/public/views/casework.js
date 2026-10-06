// Whole-case work on a checklist: batch upload with suggested placement, and AI review of
// every item's files against its review thresholds.
import { h, toast, confirmDialog } from "../lib/dom.js";
import { api, state, canEdit, fileSize } from "../lib/api.js";
import { suggestItems } from "../lib/match.js";
import { uploadToItem, storeText } from "../lib/uploader.js";

export const VERDICT_LABEL = { pass: "符合", revise: "需修改", insufficient: "不足", missing: "缺件", unreadable: "無法讀取" };
const NEEDS_ACTION = new Set(["revise", "insufficient", "missing", "unreadable"]);
const TEXT_NOTE = { scanned: "掃描檔，無文字", unsupported: "AI 無法讀取此格式", failed: "文字擷取失敗", none: "尚未擷取文字" };

// eCTD structure files and system clutter that are not checklist documents.
const SKIP_RE = /(^|\/)(\.[^/]*|thumbs\.db|desktop\.ini|index\.xml|index-md5\.txt|tw-regional\.xml|[^/]+\.(dtd|mod|xsl))$/i;

export const isStale = (item) => item.review && item.review.fingerprint !== item.files_fingerprint;
export const needsAction = (item) => item.review && NEEDS_ACTION.has(item.review.verdict);
const reviewable = (item) => item.ai_scope && item.status !== "not_applicable";

// ── Per-item result ─────────────────────────────────────────────────────────

function rerunButton(item, label, onReviewed) {
  return h("button", {
    type: "button", class: "link-btn no-print",
    onclick: async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "審查中…";
      try {
        const res = await api("POST", `/api/items/${item.id}/review`);
        onReviewed(item.id, res.review);
      } catch (err) {
        toast(err.message, "error");
        btn.disabled = false;
        btn.textContent = label;
      }
    },
  }, label);
}

/**
 * Verdict line under an item's name. The reasons are long, so they go in a row of their own
 * under the item (reviewDetails); the verdict badge opens and closes it.
 */
export function reviewBlock(item, onReviewed, { open, detailsId, onToggle }) {
  const r = item.review;
  const editable = canEdit() && state.config.ai_enabled;
  if (!r) {
    if (!reviewable(item) || !(item.attachments ?? []).length) return null;
    return h("div", { class: "review" },
      h("span", { class: "ai-verdict v-none" }, "尚未 AI 審查"), editable ? rerunButton(item, "審查此項", onReviewed) : null);
  }
  return h("div", { class: "review" },
    h("button", {
      type: "button", class: `ai-verdict v-${r.verdict}`, "aria-expanded": String(open), "aria-controls": detailsId,
      onclick: (e) => {
        const next = e.currentTarget.getAttribute("aria-expanded") !== "true";
        e.currentTarget.setAttribute("aria-expanded", String(next));
        onToggle(next);
      },
    }, `AI：${VERDICT_LABEL[r.verdict] ?? r.verdict}`),
    isStale(item) ? h("span", { class: "stale" }, "檔案已變更，需重新審查") : null);
}

/** The AI's reasons and fixes for one item. */
export function reviewDetails(item, onReviewed) {
  const r = item.review;
  const criteria = item.criteria ?? [];
  const icon = { met: "✓", not_met: "✗", unclear: "？" };
  const editable = canEdit() && state.config.ai_enabled;
  return h("div", { class: "review-body" },
    h("p", { class: "review-summary" }, r.summary),
    r.findings.length ? h("ul", { class: "findings" }, r.findings.map((f) => h("li", { class: `f-${f.status}` },
      h("b", { "aria-label": f.status === "met" ? "符合" : f.status === "not_met" ? "未符合" : "無法判斷" }, icon[f.status] ?? "？"),
      h("span", {},
        f.criterion > 0 && criteria[f.criterion - 1] ? h("span", { class: "muted", title: criteria[f.criterion - 1] }, `門檻 ${f.criterion}：`) : null,
        f.note)))) : null,
    r.fixes.length ? h("div", { class: "fixes" }, h("b", {}, "需補件／修正"), h("ol", {}, r.fixes.map((x) => h("li", {}, x)))) : null,
    h("p", { class: "muted small" }, `AI 審查於 ${r.reviewed_at.slice(0, 16).replace("T", " ")}${r.model ? `・${r.model}` : ""}。結果供參考，送件前請人工確認。 `,
      editable ? rerunButton(item, "重新審查此項", onReviewed) : null));
}

/** Note next to a file whose text the AI cannot read. */
export function textNote(attachment) {
  const note = attachment.text_status && attachment.text_status !== "ok" ? TEXT_NOTE[attachment.text_status] : null;
  return note ? h("span", { class: "muted", title: "AI 審查需要文字；掃描檔請先做 OCR" }, note) : null;
}

/** Uploads files picked on a single item, with progress, then stores their text. */
export async function uploadFilesToItem(item, files, onDetail) {
  const limits = state.config.attachments;
  for (const f of files) {
    const ext = f.name.includes(".") ? f.name.split(".").pop().toLowerCase() : "";
    if (!limits.extensions.includes(ext)) { toast(`「${f.name}」的檔案類型不支援。`, "error"); continue; }
    if (f.size > limits.max_bytes) { toast(`「${f.name}」超過 ${fileSize(limits.max_bytes)} 上限。`, "error"); continue; }
    try {
      toast(`上傳中：${f.name}`);
      let last = 0;
      const { attachmentId, detail } = await uploadToItem(item.id, f, {
        onProgress: (p) => { if (p - last >= 0.25 && p < 1) { last = p; toast(`上傳中：${f.name}（${Math.round(p * 100)}%）`); } },
      });
      onDetail(detail);
      await storeText(attachmentId, f).catch(() => {});
      toast(`已附加「${f.name}」`);
    } catch (err) { toast(err.message, "error"); }
  }
  onDetail(await api("GET", `/api/projects/${state.currentProjectId}`));
}

// ── Whole-case AI review ────────────────────────────────────────────────────

// Survives re-renders of the case page while a run is in progress.
const runs = new Map();

/** Sheet summarising AI review results, with buttons to run them. */
export function reviewPanel(detail, onDetail) {
  const pid = detail.project.id;
  const scope = detail.items.filter(reviewable);
  const changed = scope.filter((i) => !i.review || isStale(i));
  const count = (v) => scope.filter((i) => i.review?.verdict === v && !isStale(i)).length;
  const noText = detail.items.flatMap((i) => (i.attachments ?? []).filter((a) => a.text_status === "none"));
  const run = runs.get(pid);
  const storage = detail.project.storage;

  const start = (list) => runReview(pid, list, detail, onDetail);
  const tally = [
    ["pass", count("pass")], ["revise", count("revise")], ["insufficient", count("insufficient")],
    ["missing", count("missing")], ["unreadable", count("unreadable")],
  ].filter(([, n]) => n);

  return h("section", { class: "sheet ai-review no-print" },
    h("h2", { class: "sheet-title" }, "AI 全案審查", h("span", { class: "aside" }, `${scope.length} 項`)),
    detail.project.schema_type === "new_drug_registration"
      ? h("p", { class: "help", style: "margin-top:0" }, "範圍：Module 1、Module 3 及全案一致性；不含 Module 4／5 與新藥類別項目。")
      : null,
    tally.length ? h("ul", { class: "tally" }, tally.map(([v, n]) => h("li", { class: `v-${v}` }, h("b", {}, n), VERDICT_LABEL[v]))) : null,
    h("p", { class: "small" }, changed.length ? `${changed.length} 項尚未審查或檔案已變更。` : "所有項目都已依目前的檔案審查過。"),
    run ? h("div", { class: "run" },
      h("progress", { max: run.total, value: run.done }),
      h("p", { class: "small" }, `審查中 ${run.done}／${run.total}${run.current ? `：${run.current}` : ""}`),
      h("button", { type: "button", class: "btn btn-sm", onclick: () => { run.stop = true; } }, "停止"))
      : canEdit() && state.config.ai_enabled ? h("div", { class: "btn-row" },
        h("button", { type: "button", class: "btn btn-primary", disabled: !changed.length, onclick: () => start(changed) }, `審查有變更的項目（${changed.length}）`),
        h("button", { type: "button", class: "btn", disabled: !scope.length, onclick: async () => {
          if (await confirmDialog(`重新審查全部 ${scope.length} 項？每項約需 10–60 秒。`, { okLabel: "全部重新審查" })) start(scope);
        } }, "全部重新審查"))
      : !state.config.ai_enabled ? h("p", { class: "help" }, "AI 分析尚未啟用（管理員需設定 OLLAMA_API_KEY）。") : null,
    noText.length && canEdit() && !run ? h("p", { class: "small" }, `${noText.length} 個舊檔案尚未擷取文字，AI 讀不到內容。`,
      h("button", { type: "button", class: "link-btn", onclick: (e) => extractOldFiles(noText, e.currentTarget, onDetail) }, "立即擷取")) : null,
    storage ? h("p", { class: "help" }, `儲存空間：已用 ${fileSize(storage.used_bytes)}／${fileSize(storage.quota_bytes)}`) : null,
  );
}

async function runReview(pid, list, detail, onDetail) {
  if (runs.has(pid)) return;
  const run = { total: list.length, done: 0, current: "", stop: false };
  runs.set(pid, run);
  onDetail(detail);
  let failed = 0;
  const queue = [...list];
  const worker = async () => {
    while (queue.length && !run.stop) {
      const item = queue.shift();
      run.current = item.item_name;
      try {
        const res = await api("POST", `/api/items/${item.id}/review`);
        const target = detail.items.find((i) => i.id === item.id);
        if (target) target.review = res.review;
      } catch (err) {
        failed++;
        // Configuration and quota problems will not go away for the next item.
        if ([401, 403, 429, 503].includes(err.status)) { run.stop = true; toast(err.message, "error"); }
      }
      run.done++;
      if (state.currentProjectId === pid) onDetail(detail);
    }
  };
  await Promise.all([worker(), worker()]);
  runs.delete(pid);
  toast(run.stop ? `已停止，完成 ${run.done - failed} 項。` : failed ? `審查完成，${failed} 項失敗，可再按一次重試。` : `已審查 ${run.done} 項。`, failed ? "error" : undefined);
  if (state.currentProjectId === pid) onDetail(await api("GET", `/api/projects/${pid}`));
}

/** Files uploaded before text extraction existed: download each once and extract in the browser. */
async function extractOldFiles(attachments, btn, onDetail) {
  btn.disabled = true;
  let done = 0;
  for (const a of attachments) {
    btn.textContent = `擷取中 ${++done}／${attachments.length}`;
    try {
      const blob = await (await fetch(`/api/attachments/${a.id}`, { credentials: "same-origin" })).blob();
      await storeText(a.id, new File([blob], a.filename));
    } catch { /* leave it; the note stays */ }
  }
  onDetail(await api("GET", `/api/projects/${state.currentProjectId}`));
}

// ── Batch upload ────────────────────────────────────────────────────────────

/** Files from a drop, walking into dropped folders; each keeps its folder-relative path. */
async function droppedFiles(dataTransfer) {
  const entries = [...dataTransfer.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return [...dataTransfer.files].map((file) => ({ file, path: file.name }));
  const out = [];
  const walk = async (entry, prefix) => {
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ file, path: prefix + file.name });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      for (;;) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const e of batch) await walk(e, `${prefix}${entry.name}/`);
      }
    }
  };
  for (const e of entries) await walk(e, "");
  return out;
}

export function openBatchUpload(detail, onDetail) {
  const limits = state.config.attachments;
  const storage = detail.project.storage;
  const items = detail.items;
  let rows = [];
  let running = false;

  const tbody = h("tbody", {});
  const sumLine = h("p", { class: "batch-sum small" });
  const startBtn = h("button", { type: "button", class: "btn btn-primary", disabled: true, onclick: () => upload() }, "開始上傳");
  const closeBtn = h("button", { type: "button", class: "btn", onclick: () => dlg.close() }, "關閉");

  const add = (picked) => {
    const fresh = picked.filter(({ path }) => !rows.some((r) => r.path === path));
    const suggestions = suggestItems(fresh.map(({ file, path }) => ({ name: file.name, path })), items);
    for (const [i, { file, path }] of fresh.entries()) {
      const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
      let problem = null;
      if (SKIP_RE.test(path)) problem = "略過（eCTD 結構檔或系統檔）";
      else if (!limits.extensions.includes(ext)) problem = "不支援此檔案類型";
      else if (file.size > limits.max_bytes) problem = `超過 ${fileSize(limits.max_bytes)}`;
      else if (!file.size) problem = "空檔案";
      rows.push({ file, path, itemId: problem ? null : suggestions[i].itemId, reason: suggestions[i].reason, problem, state: "", progress: 0 });
    }
    draw();
  };

  const select = (row) => h("select", {
    class: "input", disabled: running || !!row.problem, "aria-label": `${row.file.name} 對應的檢查項目`,
    onchange: (e) => { row.itemId = e.target.value ? Number(e.target.value) : null; draw(); },
  },
  h("option", { value: "" }, row.problem ? "—" : "（不上傳）"),
  items.map((it, n) => h("option", { value: it.id, selected: row.itemId === it.id }, `${n + 1}. ${it.item_name}`)));

  function draw() {
    tbody.replaceChildren(...rows.map((row) => h("tr", { class: row.problem ? "skip" : null },
      h("td", { class: "b-file" }, h("div", { class: "item-name" }, row.file.name),
        row.path !== row.file.name ? h("div", { class: "item-sub" }, row.path) : null),
      h("td", { class: "b-size nowrap" }, fileSize(row.file.size)),
      h("td", { class: "b-item" }, select(row),
        !row.problem && row.itemId && !running ? h("div", { class: "item-sub" }, `建議依據：${row.reason}`) : null),
      h("td", { class: "b-state" }, row.problem ? h("span", { class: "muted" }, row.problem)
        : row.state === "uploading" ? h("progress", { max: 1, value: row.progress })
          : row.state ? h("span", { class: row.state === "error" ? "error-text" : "small" }, row.note ?? "") : null),
    )));
    const queued = rows.filter((r) => r.itemId && !r.problem);
    const bytes = queued.reduce((n, r) => n + r.file.size, 0);
    const unmapped = rows.filter((r) => !r.itemId && !r.problem).length;
    const over = storage && storage.used_bytes + bytes > storage.quota_bytes;
    sumLine.textContent = rows.length
      ? `上傳 ${queued.length} 個檔案（${fileSize(bytes)}），對應到 ${new Set(queued.map((r) => r.itemId)).size} 個項目` +
        (unmapped ? `；${unmapped} 個未指定項目，不會上傳` : "") +
        (over ? `。超過此案件剩餘空間（${fileSize(storage.quota_bytes - storage.used_bytes)}）` : "")
      : "";
    sumLine.classList.toggle("error-text", Boolean(over));
    startBtn.disabled = running || !queued.length || over;
  }

  async function upload() {
    running = true;
    closeBtn.textContent = "上傳中…";
    closeBtn.disabled = true;
    const queue = rows.filter((r) => r.itemId && !r.problem && r.state !== "done");
    draw();
    const worker = async () => {
      while (queue.length) {
        const row = queue.shift();
        row.state = "uploading";
        draw();
        try {
          const { attachmentId } = await uploadToItem(row.itemId, row.file, { onProgress: (p) => { row.progress = p; draw(); } });
          row.state = "text";
          row.note = "擷取文字中…";
          draw();
          const status = await storeText(attachmentId, row.file).catch(() => "failed");
          row.state = "done";
          row.note = status === "ok" ? "完成" : `完成（${TEXT_NOTE[status] ?? "無文字"}）`;
        } catch (err) {
          row.state = "error";
          row.note = err.message;
        }
        draw();
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    running = false;
    const failed = rows.filter((r) => r.state === "error").length;
    const done = rows.filter((r) => r.state === "done").length;
    closeBtn.disabled = false;
    closeBtn.textContent = "關閉";
    startBtn.textContent = failed ? "重試失敗的檔案" : "開始上傳";
    for (const r of rows) if (r.state === "error") r.state = "";
    draw();
    toast(failed ? `完成 ${done} 個，${failed} 個失敗。` : `已上傳 ${done} 個檔案。可在「AI 全案審查」審查有變更的項目。`, failed ? "error" : undefined);
    onDetail(await api("GET", `/api/projects/${detail.project.id}`));
  }

  const fileInput = h("input", { type: "file", multiple: true, class: "sr-only", onchange: (e) => {
    add([...e.target.files].map((file) => ({ file, path: file.name })));
    e.target.value = "";
  } });
  const folderInput = h("input", { type: "file", multiple: true, webkitdirectory: true, class: "sr-only", onchange: (e) => {
    add([...e.target.files].map((file) => ({ file, path: file.webkitRelativePath || file.name })));
    e.target.value = "";
  } });
  const drop = h("div", {
    class: "dropzone batch-drop",
    ondragover: (e) => { e.preventDefault(); drop.classList.add("drag"); },
    ondragleave: () => drop.classList.remove("drag"),
    ondrop: async (e) => { e.preventDefault(); drop.classList.remove("drag"); if (!running) add(await droppedFiles(e.dataTransfer)); },
  },
  h("strong", {}, h("span", { class: "hover-only" }, "拖曳檔案或資料夾到這裡"), h("span", { class: "touch-only" }, "選擇要上傳的檔案")),
  h("div", { class: "btn-row", style: "justify-content:center;margin-top:10px" },
    h("label", { class: "btn btn-sm" }, fileInput, "選擇檔案"),
    h("label", { class: "btn btn-sm hover-only" }, folderInput, "選擇資料夾")),
  h("div", { class: "small", style: "margin-top:8px" },
    `單檔上限 ${fileSize(limits.max_bytes)}，每個項目最多 ${limits.per_item} 個檔案。eCTD 資料夾可整個拖進來，系統依節點對應。`));

  const dlg = h("dialog", { class: "batch-dialog", "aria-labelledby": "batch-title" },
    h("h2", { id: "batch-title" }, "批次上傳"),
    h("p", { class: "help", style: "margin-top:-8px" }, "系統依 CTD 節點與檔名建議對應的檢查項目，請確認或修改後再上傳。PDF、Word、Excel 上傳後會轉成文字，供 AI 審查。"),
    drop,
    h("div", { class: "table-wrap" }, h("table", { class: "batch-table" },
      h("thead", {}, h("tr", {}, ["檔案", "大小", "對應項目", "狀態"].map((t) => h("th", {}, t)))), tbody)),
    sumLine,
    h("div", { class: "btn-row dialog-actions" }, closeBtn, startBtn),
  );
  dlg.addEventListener("cancel", (e) => { if (running) e.preventDefault(); });
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}
