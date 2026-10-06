// In-browser text extraction. The AI service (Ollama) only takes text, so every file is
// turned into text here before upload:
// - Office files are ZIP archives of XML: unzipped with the native DecompressionStream
//   and read with DOMParser.
// - PDFs go through pdf.js (served from /vendor/pdfjs), loaded only when a PDF is picked.
//   Scanned PDFs have no text layer and are rejected with an explanation.

const MAX_FILE_BYTES = 20 * 1024 * 1024;
// Keep in step with MAX_TEXT_CHARS in src/ai.ts.
export const MAX_TEXT_CHARS = 100_000;
// Fewer readable characters per page than this means the PDF is (mostly) scanned images.
const MIN_CHARS_PER_PAGE = 20;

export const ACCEPT = ".pdf,.docx,.xlsx,.txt,.md,.csv";

export async function prepareDocument(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error("檔案超過 20 MB 上限。");
  const ext = file.name.toLowerCase().split(".").pop();
  const buf = new Uint8Array(await file.arrayBuffer());

  if (ext === "pdf") {
    if (!(buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)) {
      throw new Error("這不是有效的 PDF 檔案。");
    }
    return textResult(await pdfText(buf));
  }
  if (ext === "docx") return textResult(await docxText(buf));
  if (ext === "xlsx") return textResult(await xlsxText(buf));
  if (ext === "doc" || ext === "xls") {
    throw new Error("舊版 .doc / .xls 格式不支援，請另存為 .docx / .xlsx 或 PDF 後再上傳。");
  }
  if (["txt", "md", "csv"].includes(ext)) return textResult(new TextDecoder("utf-8").decode(buf));
  throw new Error("不支援的檔案格式。支援：PDF、Word (.docx)、Excel (.xlsx)、純文字。");
}

function textResult(text) {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) throw new Error("無法從檔案擷取到文字內容。");
  if (clean.length > MAX_TEXT_CHARS) {
    throw new Error(`文件文字有 ${clean.length.toLocaleString()} 字元，超過單次分析上限 ${MAX_TEXT_CHARS.toLocaleString()} 字元，請拆分後分次分析。`);
  }
  return { text: clean, chars: clean.length };
}

// ── PDF ─────────────────────────────────────────────────────────────────────

async function pdfText(buf) {
  const { pages, numPages } = await pdfPages(buf);
  const readable = pages.join("").replace(/\s/g, "").length;
  if (readable < numPages * MIN_CHARS_PER_PAGE) {
    throw new Error("這份 PDF 幾乎沒有可擷取的文字，可能是掃描檔。AI 服務無法讀取圖片，請改上傳含文字的 PDF 或 Word 檔，或先做 OCR。");
  }
  return pages.map((t, i) => `【第 ${i + 1} 頁】\n${t.trim()}`).join("\n\n");
}

/** Text of each page, stopping once maxChars have been read (large dossiers can run to thousands of pages). */
async function pdfPages(buf, maxChars = Infinity) {
  const base = new URL("../vendor/pdfjs/", import.meta.url);
  const pdfjs = await import(new URL("pdf.min.mjs", base).href);
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.mjs", base).href;
  const task = pdfjs.getDocument({
    data: buf,
    // CJK fonts in Taiwanese PDFs often need these maps to come out as real characters.
    cMapUrl: new URL("cmaps/", base).href,
    cMapPacked: true,
    isEvalSupported: false,
  });
  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    await task.destroy();
    if (err?.name === "PasswordException") throw new Error("這份 PDF 有密碼保護，請先解除密碼再上傳。");
    throw new Error("無法讀取這份 PDF，檔案可能已損毀。");
  }
  const pages = [];
  const numPages = doc.numPages;
  try {
    let read = 0;
    for (let n = 1; n <= numPages && read < maxChars; n++) {
      const page = await doc.getPage(n);
      const { items } = await page.getTextContent();
      const text = items.map((i) => (i.str ?? "") + (i.hasEOL ? "\n" : "")).join("");
      pages.push(text);
      read += text.length;
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return { pages, numPages };
}

// ── Text for whole-case AI review ───────────────────────────────────────────

/** Keep in step with MAX_STORED_TEXT_CHARS in src/attachments.ts. */
export const REVIEW_TEXT_CHARS = 300_000;

/**
 * Text of an uploaded file for AI review. Never throws: the status says what happened
 * (ok | scanned | unsupported | failed) so the review can tell "no text" from "no file".
 */
export async function extractForReview(file) {
  const ext = file.name.toLowerCase().split(".").pop();
  try {
    let text;
    if (ext === "pdf") {
      const buf = new Uint8Array(await file.arrayBuffer());
      if (!(buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)) return { status: "failed", text: "" };
      const { pages, numPages } = await pdfPages(buf, REVIEW_TEXT_CHARS);
      const readable = pages.join("").replace(/\s/g, "").length;
      if (readable < pages.length * MIN_CHARS_PER_PAGE) return { status: "scanned", text: "" };
      text = pages.map((t, i) => `【第 ${i + 1} 頁】\n${t.trim()}`).join("\n\n");
      if (pages.length < numPages) text += `\n\n（全文共 ${numPages} 頁，只擷取前 ${pages.length} 頁）`;
    } else if (ext === "docx") {
      text = await docxText(new Uint8Array(await file.arrayBuffer()));
    } else if (ext === "xlsx") {
      text = await xlsxText(new Uint8Array(await file.arrayBuffer()));
    } else if (["txt", "md", "csv", "xml"].includes(ext)) {
      text = new TextDecoder("utf-8").decode(await file.slice(0, REVIEW_TEXT_CHARS * 4).arrayBuffer());
    } else {
      return { status: "unsupported", text: "" };
    }
    const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, REVIEW_TEXT_CHARS);
    return clean ? { status: "ok", text: clean } : { status: "failed", text: "" };
  } catch {
    return { status: "failed", text: "" };
  }
}

// ── ZIP ─────────────────────────────────────────────────────────────────────

async function unzip(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("檔案格式損毀（不是有效的 Office 檔案）。");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { method, compSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return {
    has: (name) => entries.has(name),
    async text(name) {
      const e = entries.get(name);
      if (!e) return null;
      const lh = e.localOffset;
      const start = lh + 30 + view.getUint16(lh + 26, true) + view.getUint16(lh + 28, true);
      const data = buf.subarray(start, start + e.compSize);
      if (e.method === 0) return new TextDecoder().decode(data);
      if (e.method !== 8) throw new Error("不支援的壓縮格式。");
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return await new Response(stream).text();
    },
  };
}

function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("文件 XML 解析失敗。");
  return doc;
}

const byLocal = (el, name) => [...el.getElementsByTagName("*")].filter((n) => n.localName === name);

// ── DOCX ────────────────────────────────────────────────────────────────────

async function docxText(buf) {
  const zip = await unzip(buf);
  const xml = await zip.text("word/document.xml");
  if (!xml) throw new Error("找不到 Word 文件內容（word/document.xml）。");
  const body = byLocal(parseXml(xml), "body")[0];
  if (!body) return "";
  const out = [];
  const paraText = (p) => {
    let s = "";
    for (const n of p.getElementsByTagName("*")) {
      if (n.localName === "t") s += n.textContent;
      else if (n.localName === "tab") s += "\t";
      else if (n.localName === "br" || n.localName === "cr") s += "\n";
    }
    return s;
  };
  for (const child of body.children) {
    if (child.localName === "p") {
      const t = paraText(child);
      if (t.trim()) out.push(t);
    } else if (child.localName === "tbl") {
      for (const row of byLocal(child, "tr")) {
        const cells = byLocal(row, "tc").map((tc) => byLocal(tc, "p").map(paraText).join(" ").trim()).filter(Boolean);
        if (cells.length) out.push(cells.join(" | "));
      }
    }
  }
  return out.join("\n");
}

// ── XLSX ────────────────────────────────────────────────────────────────────

async function xlsxText(buf) {
  const zip = await unzip(buf);
  const wbXml = await zip.text("xl/workbook.xml");
  if (!wbXml) throw new Error("找不到 Excel 活頁簿內容（xl/workbook.xml）。");

  const shared = [];
  const ssXml = await zip.text("xl/sharedStrings.xml");
  if (ssXml) {
    for (const si of byLocal(parseXml(ssXml), "si")) shared.push(byLocal(si, "t").map((t) => t.textContent).join(""));
  }

  const rels = new Map();
  const relXml = await zip.text("xl/_rels/workbook.xml.rels");
  if (relXml) {
    for (const r of byLocal(parseXml(relXml), "Relationship")) rels.set(r.getAttribute("Id"), r.getAttribute("Target"));
  }

  const out = [];
  const sheets = byLocal(parseXml(wbXml), "sheet");
  for (const [idx, sheet] of sheets.entries()) {
    const rid = [...sheet.attributes].find((a) => a.localName === "id")?.value;
    let target = rels.get(rid) ?? `worksheets/sheet${idx + 1}.xml`;
    target = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    const sheetXml = await zip.text(target);
    if (!sheetXml) continue;
    out.push(`=== 工作表：${sheet.getAttribute("name")} ===`);
    for (const row of byLocal(parseXml(sheetXml), "row")) {
      // Sparse rows omit empty cells, so place each value by its column letter (r="C3").
      const cells = [];
      for (const c of byLocal(row, "c")) {
        const type = c.getAttribute("t");
        let value;
        if (type === "inlineStr") value = byLocal(c, "t").map((t) => t.textContent).join("");
        else {
          const v = byLocal(c, "v")[0]?.textContent ?? "";
          value = type === "s" ? shared[Number(v)] ?? "" : v;
        }
        const col = columnIndex(c.getAttribute("r")) ?? cells.length;
        while (cells.length < col) cells.push("");
        cells[col] = value;
      }
      if (cells.some((v) => v.trim())) out.push(cells.join(" | "));
    }
  }
  return out.join("\n");
}

function columnIndex(ref) {
  const letters = /^([A-Z]+)\d+$/.exec(ref ?? "")?.[1];
  if (!letters) return null;
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
