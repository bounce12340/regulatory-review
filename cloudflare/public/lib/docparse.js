// In-browser text extraction for .docx / .xlsx / text files, with no third-party
// libraries: Office files are ZIP archives of XML, so we unzip with the native
// DecompressionStream and read the XML with DOMParser. PDFs are not parsed here —
// they go to Claude as-is so scanned pages work too.

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const ACCEPT = ".pdf,.docx,.xlsx,.txt,.md,.csv";

export async function prepareDocument(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error("檔案超過 20 MB 上限。");
  const ext = file.name.toLowerCase().split(".").pop();
  const buf = new Uint8Array(await file.arrayBuffer());

  if (ext === "pdf") {
    if (!(buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)) {
      throw new Error("這不是有效的 PDF 檔案。");
    }
    return { kind: "pdf", pdf_base64: toBase64(buf), chars: null };
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
  return { kind: "text", text: clean, chars: clean.length };
}

function toBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
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
