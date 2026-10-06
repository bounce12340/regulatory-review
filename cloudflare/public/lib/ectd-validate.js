// Checks an eCTD sequence against TFDA's validation rules A–P (「藥品查驗登記電子通用技術
// 文件驗證指引」eCTD-V-R2.1, 114.06.30). Everything runs in the browser: the package is read
// from a ZIP (ZIP64 included) or a picked folder, and every document is hashed once.
//
// Rules that need earlier sequences (lifecycle: I.8, K.6, K.9, K.10, K.12, M.2, M.4) are
// checked only against sequences present in the same package; otherwise they are listed as
// not checked. PDF rules that need a full PDF renderer (links, bookmarks, fonts) are listed
// as not checked too.

import { readZip, streamIter, streamBytes } from "./zip.js";
import { Md5 } from "./md5.js";
import { parseXml, walk } from "./xml.js";
import { parseDtd, validate as validateDtd } from "./dtd.js";
import {
  UTIL_FILES, TW_REGIONAL_PATH, MAX_NAME, MAX_PATH, MAX_FILE_BYTES, NAME_RE, M1_FORMATS, ICH_FORMATS, TW_M1,
} from "./ectd-spec.js";

/** Rule catalogue: id, severity (P/F = refused, BP = reminder), and what it checks. */
export const RULES = [
  ["A.1", "P/F", "ICH DTD 檔名為 ich-ectd-3-2.dtd"], ["A.2", "P/F", "ICH DTD 位於 util/dtd"], ["A.3", "P/F", "ICH DTD checksum 與 ICH 公告一致"],
  ["B.1", "P/F", "ICH stylesheet 檔名為 ectd-2-0.xsl"], ["B.2", "P/F", "ICH stylesheet 位於 util/style"], ["B.3", "P/F", "ICH stylesheet checksum 與 ICH 公告一致"],
  ["C.1", "P/F", "TW M1 DTD 檔名為 tw-regional.dtd"], ["C.2", "P/F", "TW M1 DTD 位於 util/dtd"], ["C.3", "P/F", "TW M1 DTD checksum 與食藥署公告一致"],
  ["D.1", "P/F", "tw-leaf.mod 檔名正確"], ["D.2", "P/F", "tw-leaf.mod 位於 util/dtd"], ["D.3", "P/F", "tw-leaf.mod checksum 與食藥署公告一致"],
  ["E.1", "P/F", "tw-envelope.mod 檔名正確"], ["E.2", "P/F", "tw-envelope.mod 位於 util/dtd"], ["E.3", "P/F", "tw-envelope.mod checksum 與食藥署公告一致"],
  ["F.1", "P/F", "tw-regional.xsl 檔名正確"], ["F.2", "P/F", "tw-regional.xsl 位於 util/style"], ["F.3", "P/F", "tw-regional.xsl checksum 與食藥署公告一致"],
  ["G.1", "P/F", "index.xml 位於序列資料夾"], ["G.2", "P/F", "檔名為 index.xml"], ["G.3", "P/F", "index.xml 為正確的 XML"],
  ["G.4", "P/F", "index.xml 符合 ICH DTD"], ["G.5", "P/F", "index.xml 引用 util/dtd 的 DTD"], ["G.6", "P/F", "index.xml 引用 util/style 的 stylesheet"],
  ["H.1", "P/F", "index-md5.txt 位於序列資料夾"], ["H.2", "P/F", "檔名為 index-md5.txt"], ["H.3", "P/F", "index-md5.txt 與 index.xml 的 checksum 一致"],
  ["I.1", "P/F", "tw-regional.xml 位於 m1/tw"], ["I.2", "P/F", "檔名為 tw-regional.xml"], ["I.3", "P/F", "tw-regional.xml 為正確的 XML"],
  ["I.4", "P/F", "tw-regional.xml 符合 TW M1 DTD"], ["I.5", "P/F", "tw-regional.xml 引用 util/dtd 的 DTD"], ["I.6", "P/F", "tw-regional.xml 引用 util/style 的 stylesheet"],
  ["I.7", "P/F", "UUID 格式正確"], ["I.8", "P/F", "UUID 與前一序列相同（生命週期）"],
  ["J.1", "P/F", "最低層節點至少有一個檔案"],
  ["K.1", "P/F", "checksum-type 為 md5"], ["K.2", "P/F", "檔案 checksum 與 leaf 記載一致"], ["K.3", "P/F", "每個 leaf 都有標題"],
  ["K.4", "P/F", "new／replace／append 有 xlink:href"], ["K.5", "P/F", "delete 不可有 xlink:href"], ["K.6", "P/F", "xlink:href 指向的檔案存在"],
  ["K.7", "P/F", "replace／delete／append 有 modified-file"], ["K.8", "P/F", "new 不可有 modified-file"], ["K.9", "P/F", "modified-file 指向先前序列的 leaf（生命週期）"],
  ["K.10", "P/F", "修改的檔案位於相同 CTD 段落（生命週期）"], ["K.11", "P/F", "leaf ID 不重複"], ["K.12", "P/F", "同一檔案只被替換或刪除一次（生命週期）"],
  ["K.BP1", "BP", "延伸節點／3.2.A 的修改位於相同段落（生命週期）"], ["K.BP2", "BP", "屬性值前後不可有空白或連字號"],
  ["L.1", "P/F", "延伸節點有標題"],
  ["M.1", "P/F", "序列資料夾為 4 位數字"], ["M.2", "P/F", "序列號碼未重複（生命週期）"], ["M.3", "P/F", "序列資料夾與 envelope 序列一致"], ["M.4", "P/F", "序列號碼未跳號（生命週期）"],
  ["N.1", "P/F", "initial／reformat 的相關序列等於本序列"], ["N.2", "P/F", "其他送件種類的相關序列不等於本序列"], ["N.3", "P/F", "initial 須填 INN"],
  ["N.4", "P/F", "變更／展延／註銷須填藥品許可證字號"], ["N.5", "P/F", "invented name code 已填寫"],
  ["O.1", "P/F", "M1 檔案格式為 XML、PDF、JPG、PNG、SVG、GIF"], ["O.2", "P/F", "M2–M5 檔案格式符合 ICH"], ["O.3", "P/F", "路徑不超過 180 字元"],
  ["O.4", "P/F", "檔名不超過 64 字元"], ["O.5", "P/F", "資料夾名稱不超過 64 字元"], ["O.6", "P/F", "檔名只用小寫英文、數字、連字號"],
  ["O.7", "P/F", "資料夾名稱只用小寫英文、數字、連字號"], ["O.8", "P/F", "M1–M5 沒有未被引用的檔案"], ["O.9", "P/F", "序列資料夾只有 index.xml 和 index-md5.txt 兩個檔案"],
  ["O.10", "P/F", "沒有空資料夾"], ["O.11", "P/F", "m1.1.1 有有效檔案"], ["O.12", "P/F", "最上層資料夾名稱為取號號碼"], ["O.13", "P/F", "單一檔案不超過 500 MB"],
  ["O.BP1", "BP", "使用 ICH 及 TW 建議的資料夾名稱"], ["O.BP2", "BP", "使用 ICH 及 TW 建議的檔名"],
  ["P.1", "P/F", "PDF 不是 1.3 或更早版本"], ["P.2", "P/F", "PDF 沒有損毀"],
  ["P.BP1", "BP", "PDF 版本為 1.4–1.7"], ["P.BP2", "BP", "超連結及書籤有有效目標"], ["P.BP3", "BP", "超連結及書籤設為承襲縮放"],
  ["P.BP4", "BP", "PDF 設為快速 Web 檢視"], ["P.BP5", "BP", "初始檢視為預設版面與縮放"], ["P.BP6", "BP", "超連結及書籤使用相對路徑"],
  ["P.BP7", "BP", "有書籤時開啟即顯示書籤"], ["P.BP8", "BP", "沒有書籤時不顯示書籤窗格"], ["P.BP9", "BP", "PDF 間連結依 ISO 32000-1"],
  ["P.BP10", "BP", "非標準字型已內嵌"], ["P.BP11", "BP", "PDF 無開啟密碼或安全設定"], ["P.BP12", "BP", "PDF 無列印、複製等限制"],
].map(([id, severity, text]) => ({ id, severity, text }));
const RULE = new Map(RULES.map((r) => [r.id, r]));

// Checked only when the package holds the earlier sequences, or by a PDF renderer.
const LIFECYCLE = ["I.8", "K.9", "K.10", "K.12", "K.BP1", "M.2", "M.4"];
const NOT_AUTOMATED = ["P.BP2", "P.BP3", "P.BP5", "P.BP6", "P.BP7", "P.BP8", "P.BP9", "P.BP10"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SKIP_RE = /(^|\/)(__macosx|\.ds_store|thumbs\.db|desktop\.ini)(\/|$)/i;

/**
 * @typedef {{path: string, size: number, stream: () => ReadableStream<Uint8Array>, encrypted?: boolean}} Entry
 * @typedef {{rule: string, severity: string, message: string, path?: string}} Finding
 */

/** Entries of a ZIP file. Folder entries are kept (as path ending in "/") for the empty-folder rule. */
export async function zipEntries(blob) {
  return (await readZip(blob)).map((e) => ({ path: e.name, size: e.size, stream: e.stream, encrypted: e.encrypted, dir: e.dir }));
}

/** Entries of a picked or dropped folder: [{file, path}] with "/"-separated relative paths. */
export function folderEntries(files) {
  return files.map(({ file, path }) => ({ path, size: file.size, stream: () => file.stream() }));
}

/**
 * @param {Entry[]} entries
 * @param {{onProgress?: (done: number, total: number, path: string) => void, signal?: AbortSignal}} opts
 */
export async function validateEntries(entries, { onProgress, signal } = {}) {
  entries = entries.filter((e) => !SKIP_RE.test(e.path)).map((e) => ({ ...e, path: e.path.replace(/^\/+/, "") }));
  const files = entries.filter((e) => !e.dir && !e.path.endsWith("/"));
  const roots = [...new Set(files.map((e) => /^(?:(.*?)\/)?(\d{4})\/index\.xml$/i.exec(e.path)).filter(Boolean).map((m) => (m[1] ? `${m[1]}/` : "") + m[2]))];
  if (!roots.length) {
    // Maybe index.xml is somewhere unexpected: say where.
    const stray = files.find((e) => /(^|\/)index\.xml$/i.test(e.path));
    return {
      sequences: [],
      findings: [{
        rule: "G.1", severity: "P/F",
        message: stray ? `index.xml 不在 4 位數序列資料夾內（位於 ${stray.path}）。` : "找不到 index.xml。請上傳整個序列資料夾（例如 2020101002/0000）或其 ZIP。",
      }],
    };
  }
  roots.sort();
  const total = files.filter((e) => roots.some((r) => e.path.startsWith(`${r}/`))).reduce((n, e) => n + e.size, 0);
  const progress = { done: 0, total, onProgress, signal };
  const sequences = [];
  for (const root of roots) sequences.push(await validateSequence(root, entries, files, progress));
  // Lifecycle across the sequences in this package.
  const byApp = new Map();
  for (const s of sequences) byApp.set(s.appFolder, [...(byApp.get(s.appFolder) ?? []), s]);
  for (const list of byApp.values()) {
    list.sort((a, b) => a.seq.localeCompare(b.seq));
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      cur.checked.add("M.4");
      cur.checked.add("I.8");
      if (Number(cur.seq) !== Number(prev.seq) + 1) cur.findings.push(f("M.4", `序列 ${cur.seq} 與前一序列 ${prev.seq} 之間跳號。`));
      if (cur.uuid && prev.uuid && cur.uuid !== prev.uuid) cur.findings.push(f("I.8", `UUID ${cur.uuid} 與序列 ${prev.seq} 的 ${prev.uuid} 不同。`));
    }
  }
  // Lifecycle rules count as checked only when the earlier sequences were in this package.
  for (const s of sequences) s.notChecked = [...LIFECYCLE.filter((r) => !s.checked.has(r)), ...NOT_AUTOMATED];
  return { sequences, findings: [] };
}

function f(rule, message, path) {
  return { rule, severity: RULE.get(rule)?.severity ?? "P/F", message, path };
}

async function readText(entry) {
  return new TextDecoder("utf-8").decode(await streamBytes(entry.stream(), 32 * 1024 * 1024));
}

async function validateSequence(root, allEntries, files, progress) {
  const seq = root.split("/").pop();
  const appFolder = root.includes("/") ? root.split("/").slice(-2, -1)[0] : null;
  const findings = [];
  const checked = new Set();
  const add = (rule, message, path) => findings.push(f(rule, message, path));
  const mark = (...rules) => rules.forEach((r) => checked.add(r));
  const prefix = `${root}/`;
  const mine = files.filter((e) => e.path.startsWith(prefix));
  const rel = new Map(mine.map((e) => [e.path.slice(prefix.length), e]));
  const result = { root, seq, appFolder, findings, checked, uuid: null, envelope: null, stats: { files: mine.length, bytes: mine.reduce((n, e) => n + e.size, 0), leaves: 0 } };

  // ── M.1 sequence folder ──
  mark("M.1");
  if (!/^\d{4}$/.test(seq)) add("M.1", `序列資料夾「${seq}」不是 4 位數字。`);

  // ── A–F util files ──
  const utilText = new Map();
  for (const u of UTIL_FILES) {
    const [r1, r2, r3] = [`${u.rule}.1`, `${u.rule}.2`, `${u.rule}.3`];
    mark(r1, r2, r3);
    const name = u.path.split("/").pop();
    const entry = rel.get(u.path);
    if (!entry) {
      const elsewhere = [...rel.keys()].find((p) => p.split("/").pop() === name);
      const wrongCase = [...rel.keys()].find((p) => p.toLowerCase() === u.path);
      if (wrongCase) add(r1, `${u.label} 檔名應為 ${name}（目前為 ${wrongCase.split("/").pop()}）。`, wrongCase);
      else if (elsewhere) add(r2, `${name} 應放在 ${u.path.replace(/\/[^/]+$/, "")}（目前在 ${elsewhere}）。`, elsewhere);
      else add(r1, `缺少 ${u.path}。`);
      continue;
    }
    const bytes = await streamBytes(entry.stream());
    const sum = new Md5().update(bytes).hex();
    if (sum !== u.md5) add(r3, `${name} 的 checksum 為 ${sum}，與公告值 ${u.md5} 不同（檔案內容被改過或版本不對）。`, u.path);
    utilText.set(u.path, new TextDecoder("utf-8").decode(bytes));
  }

  // ── G index.xml ──
  mark("G.1", "G.2", "G.3", "G.4", "G.5", "G.6");
  let index = null;
  const indexEntry = rel.get("index.xml");
  let indexBytes = null;
  if (indexEntry) {
    indexBytes = await streamBytes(indexEntry.stream());
    try {
      index = parseXml(new TextDecoder("utf-8").decode(indexBytes));
    } catch (err) {
      add("G.3", `index.xml 不是正確的 XML：${err.message}`, "index.xml");
    }
  }
  if (index) {
    if (index.doctype?.system !== "util/dtd/ich-ectd-3-2.dtd") add("G.5", `index.xml 的 DOCTYPE 應引用 util/dtd/ich-ectd-3-2.dtd（目前為「${index.doctype?.system ?? "無"}」）。`, "index.xml");
    const xsl = stylesheetOf(index);
    if (xsl !== "util/style/ectd-2-0.xsl") add("G.6", `index.xml 應引用 util/style/ectd-2-0.xsl（目前為「${xsl ?? "無"}」）。`, "index.xml");
    const dtd = dtdFor("ich", utilText);
    for (const e of validateDtd(index, dtd, "ectd:ectd").slice(0, 50)) add("G.4", `index.xml ${e.line ? `第 ${e.line} 行` : ""}：${e.message}`, "index.xml");
  }

  // ── H index-md5.txt ──
  mark("H.1", "H.2", "H.3");
  const md5Entry = rel.get("index-md5.txt");
  if (!md5Entry) {
    const other = [...rel.keys()].find((p) => /index[-_]?md5/i.test(p));
    add(other ? (other.includes("/") ? "H.1" : "H.2") : "H.1", other ? `index-md5.txt 位置或檔名不對（目前為 ${other}）。` : "缺少 index-md5.txt。");
  } else if (indexBytes) {
    const written = (await readText(md5Entry)).trim().toLowerCase().slice(0, 32);
    const actual = new Md5().update(indexBytes).hex();
    if (written !== actual) add("H.3", `index-md5.txt 記載 ${written || "（空白）"}，但 index.xml 的 MD5 為 ${actual}。index.xml 產生後被修改過。`, "index-md5.txt");
  }

  // ── I tw-regional.xml ──
  mark("I.1", "I.2", "I.3", "I.4", "I.5", "I.6", "I.7");
  let regional = null;
  const twEntry = rel.get(TW_REGIONAL_PATH);
  if (!twEntry) {
    const other = [...rel.keys()].find((p) => p.endsWith("tw-regional.xml"));
    const near = [...rel.keys()].find((p) => p.startsWith("m1/tw/") && p.endsWith(".xml") && !p.slice(6).includes("/"));
    if (other) add("I.1", `tw-regional.xml 應放在 m1/tw（目前在 ${other}）。`, other);
    else if (near) add("I.2", `m1/tw 的區域性 XML 應命名為 tw-regional.xml（目前為 ${near.split("/").pop()}）。`, near);
    else add("I.1", "缺少 m1/tw/tw-regional.xml。");
  } else {
    try {
      regional = parseXml(await readText(twEntry));
    } catch (err) {
      add("I.3", `tw-regional.xml 不是正確的 XML：${err.message}`, TW_REGIONAL_PATH);
    }
  }
  if (regional) {
    if (regional.doctype?.system !== "../../util/dtd/tw-regional.dtd") add("I.5", `tw-regional.xml 的 DOCTYPE 應引用 ../../util/dtd/tw-regional.dtd（目前為「${regional.doctype?.system ?? "無"}」）。`, TW_REGIONAL_PATH);
    const xsl = stylesheetOf(regional);
    if (xsl !== "../../util/style/tw-regional.xsl") add("I.6", `tw-regional.xml 應引用 ../../util/style/tw-regional.xsl（目前為「${xsl ?? "無"}」）。`, TW_REGIONAL_PATH);
    const dtd = dtdFor("tw", utilText);
    for (const e of validateDtd(regional, dtd, "tw:tw-backbone").slice(0, 50)) add("I.4", `tw-regional.xml 第 ${e.line} 行：${e.message}`, TW_REGIONAL_PATH);
    result.envelope = readEnvelope(regional);
  }

  // ── Envelope: I.7, M.3, N.*, O.12 ──
  const env = result.envelope;
  mark("M.3", "N.1", "N.2", "N.3", "N.4", "N.5", "O.12");
  if (env) {
    result.uuid = env.identifier;
    if (!UUID_RE.test(env.identifier)) add("I.7", `UUID「${env.identifier}」格式不正確，應為 8-4-4-4-12 共 32 個十六進位字元。`, TW_REGIONAL_PATH);
    if (env.sequence !== seq) add("M.3", `序列資料夾為 ${seq}，但 envelope 的 sequence 為 ${env.sequence || "（空白）"}。`, TW_REGIONAL_PATH);
    const related = env.relatedSequences;
    if (["initial", "reformat"].includes(env.unitType)) {
      if (!related.includes(seq)) add("N.1", `送件種類為 ${env.unitType} 時，related-sequence 必須等於本序列 ${seq}（目前為 ${related.join("、") || "空白"}）。`, TW_REGIONAL_PATH);
    } else if (env.unitType && related.includes(seq)) {
      add("N.2", `送件種類為 ${env.unitType} 時，related-sequence 不可等於本序列 ${seq}。`, TW_REGIONAL_PATH);
    }
    if (env.unitType === "initial" && !env.inns.some((x) => x.trim())) add("N.3", "首次送件（initial）必須填寫 INN（主成分）。", TW_REGIONAL_PATH);
    if (["change", "extension", "expiration"].includes(env.objective) && !env.inventedNames.some((n) => n.licenses.some((l) => l.trim()))) {
      add("N.4", `送件目的為 ${env.objective} 時，必須填寫藥品許可證字號（drug-permit-license）。`, TW_REGIONAL_PATH);
    }
    if (!env.inventedNames.length || env.inventedNames.some((n) => !n.codes.some((c) => c.trim()))) add("N.5", "每個 invented-name 都必須填寫 code（取號號碼＋劑量，例：202010100210mg）。", TW_REGIONAL_PATH);
    const appNos = env.inventedNames.map((n) => n.appNo.trim()).filter(Boolean);
    if (!appFolder) add("O.12", `序列資料夾外層應有一個以取號號碼命名的資料夾（例：${appNos[0] ?? "2020101002"}/${seq}）。`);
    else if (appNos.length && !appNos.includes(appFolder)) add("O.12", `最上層資料夾「${appFolder}」與取號號碼 ${appNos.join("、")} 不同。`);
  } else if (!appFolder) {
    add("O.12", `序列資料夾外層應有一個以取號號碼命名的資料夾（例：2020101002/${seq}）。`);
  }

  // ── Leaves: J, K, L, O.8, O.11 ──
  mark("J.1", "K.1", "K.2", "K.3", "K.4", "K.5", "K.6", "K.7", "K.8", "K.11", "K.BP2", "L.1", "O.8", "O.11");
  const referenced = new Set();
  const leaves = [];
  const ids = new Map();
  const collect = (doc, base, file) => {
    if (!doc) return;
    for (const node of walk(doc.root)) {
      if (node.name === "leaf") {
        const href = node.attrs["xlink:href"];
        const target = href ? resolve(base, href) : null;
        leaves.push({ node, file, target, href });
        if (target) referenced.add(target);
        const id = node.attrs.ID;
        if (id) {
          if (ids.has(id) && ids.get(id) !== file) add("K.11", `leaf ID「${id}」在 index.xml 與 tw-regional.xml 中重複。`, file);
          ids.set(id, file);
        }
      }
      if (node.name === "node-extension" && !childText(node, "title").trim()) add("L.1", `第 ${node.line} 行的延伸節點沒有標題。`, file);
      for (const [k, v] of Object.entries(node.attrs)) {
        if (k.startsWith("xmlns") || k === "dtd-version") continue;
        if (v !== v.trim() || /^-|-$/.test(v)) add("K.BP2", `<${node.name}> 的屬性 ${k}="${v}" 前後有空白或連字號。`, file);
      }
    }
    // J.1: every lowest heading has a leaf.
    for (const node of walk(doc.root)) {
      if (!isHeading(node)) continue;
      const headings = node.children.filter(isHeading);
      if (!headings.length && !node.children.some((c) => c.name === "leaf")) add("J.1", `<${node.name}>（第 ${node.line} 行）沒有任何檔案。空的節點應從 XML 中移除。`, file);
    }
  };
  collect(index, "", "index.xml");
  collect(regional, "m1/tw/", TW_REGIONAL_PATH);
  result.stats.leaves = leaves.length;
  if (index && twEntry && !leaves.some((l) => l.target === TW_REGIONAL_PATH)) add("I.1", "index.xml 的 m1 沒有引用 m1/tw/tw-regional.xml。", "index.xml");

  const hashed = new Map(); // path → {md5, head, tail}
  for (const { node, file, target, href } of leaves) {
    const op = node.attrs.operation;
    const where = `${file} 第 ${node.line} 行`;
    if ((node.attrs["checksum-type"] ?? "").toLowerCase() !== "md5") add("K.1", `${where}：checksum-type 應為 md5（目前為「${node.attrs["checksum-type"] ?? ""}」）。`, file);
    if (!childText(node, "title").trim()) add("K.3", `${where}：leaf 沒有標題（title）。`, file);
    if (["new", "replace", "append"].includes(op) && !href) add("K.4", `${where}：operation 為 ${op} 的 leaf 必須有 xlink:href。`, file);
    if (op === "delete" && href) add("K.5", `${where}：operation 為 delete 的 leaf 不可有 xlink:href。`, file);
    if (["replace", "delete", "append"].includes(op) && !node.attrs["modified-file"]) add("K.7", `${where}：operation 為 ${op} 的 leaf 必須有 modified-file。`, file);
    if (op === "new" && node.attrs["modified-file"]) add("K.8", `${where}：operation 為 new 的 leaf 不可有 modified-file。`, file);
    if (!target) continue;
    if (target.startsWith("../")) {
      // Points into another sequence of the same application.
      const other = resolve(`${root}/`, target);
      if (!files.some((e) => e.path === other)) add("K.6", `${where}：xlink:href 指向 ${target}，本次上傳的資料中沒有該序列，無法確認。`, file);
      continue;
    }
    const entry = rel.get(target);
    if (!entry) { add("K.6", `${where}：xlink:href 指向的 ${target} 不存在。`, file); continue; }
  }

  // Hash every file under m1–m5 once: K.2 checksums and the PDF rules read from the same pass.
  mark("O.1", "O.2", "O.13", "P.1", "P.2", "P.BP1", "P.BP4", "P.BP11", "P.BP12");
  for (const [path, entry] of rel) {
    if (!/^m[1-5]\//.test(path)) continue;
    if (progress.signal?.aborted) throw new DOMException("已取消", "AbortError");
    const ext = path.includes(".") ? path.split(".").pop() : "";
    const formats = path.startsWith("m1/") ? M1_FORMATS : ICH_FORMATS;
    if (!formats.includes(ext)) add(path.startsWith("m1/") ? "O.1" : "O.2", `${path} 的格式（.${ext || "無副檔名"}）不被接受。`, path);
    if (entry.size > MAX_FILE_BYTES) add("O.13", `${path} 有 ${(entry.size / 1048576).toFixed(0)} MB，超過 500 MB。`, path);
    if (entry.encrypted) { add("P.2", `${path} 在 ZIP 中有密碼保護，無法讀取。`, path); continue; }
    hashed.set(path, await hashEntry(entry, ext === "pdf", progress, path));
    if (ext === "pdf") checkPdf(path, hashed.get(path), add);
  }
  for (const { node, file, target } of leaves) {
    const h = target && hashed.get(target);
    if (!h) continue;
    const want = (node.attrs.checksum ?? "").trim().toLowerCase();
    if (want !== h.md5) add("K.2", `${target} 的 MD5 為 ${h.md5}，與 ${file} 記載的 ${want || "（空白）"} 不同。檔案在產生 XML 後被更動過。`, target);
  }
  for (const path of rel.keys()) {
    if (/^m[1-5]\//.test(path) && !referenced.has(path)) add("O.8", `${path} 沒有被 index.xml 或 tw-regional.xml 引用。`, path);
  }
  // O.11: m1.1.1 holds a valid document.
  if (regional) {
    const form = [...walk(regional.root)].find((n) => n.name === "m1-1-1-form");
    const ok = form && form.children.some((c) => c.name === "leaf" && c.attrs.operation !== "delete" && rel.has(resolve("m1/tw/", c.attrs["xlink:href"] ?? "")));
    if (!ok) add("O.11", "m1.1.1（申請書／公文／回覆函）必須放有效檔案。");
  }

  // ── Folder and file names: O.3–O.7, O.9, O.10, O.BP1–2 ──
  mark("O.3", "O.4", "O.5", "O.6", "O.7", "O.9", "O.10", "O.BP1", "O.BP2");
  const top = appFolder ? `${appFolder}/` : "";
  const seenDirs = new Set();
  for (const path of rel.keys()) {
    const full = `${top}${seq}/${path}`;
    if (full.length > MAX_PATH) add("O.3", `路徑有 ${full.length} 個字元，超過 180：${full}`, path);
    const parts = path.split("/");
    const name = parts.pop();
    if (name.length > MAX_NAME) add("O.4", `檔名超過 64 個字元：${name}`, path);
    const dot = name.lastIndexOf(".");
    if (dot <= 0 || !NAME_RE.test(name.slice(0, dot)) || !/^[a-z0-9]+$/.test(name.slice(dot + 1))) {
      add("O.6", `檔名「${name}」只能用小寫英文、數字及連字號，且只有一個副檔名。`, path);
    }
    if (!parts.length && !["index.xml", "index-md5.txt"].includes(name)) add("O.9", `序列資料夾內不可直接放「${name}」，只能有 index.xml 和 index-md5.txt。`, path);
    let dir = "";
    for (const seg of parts) {
      dir = dir ? `${dir}/${seg}` : seg;
      if (seenDirs.has(dir)) continue;
      seenDirs.add(dir);
      if (seg.length > MAX_NAME) add("O.5", `資料夾名稱超過 64 個字元：${seg}`, dir);
      if (!NAME_RE.test(seg)) add("O.7", `資料夾名稱「${seg}」只能用小寫英文、數字及連字號。`, dir);
    }
  }
  for (const seg of [appFolder, seq].filter(Boolean)) if (!NAME_RE.test(seg)) add("O.7", `資料夾名稱「${seg}」只能用小寫英文、數字及連字號。`);
  // Empty folders show up as ZIP folder entries with nothing under them.
  for (const e of allEntries) {
    if (!(e.dir || e.path.endsWith("/")) || !e.path.startsWith(prefix)) continue;
    const d = e.path.replace(/\/$/, "");
    if (!files.some((x) => x.path.startsWith(`${d}/`))) add("O.10", `資料夾 ${d.slice(prefix.length)} 是空的。`, d.slice(prefix.length));
  }
  // TW Module 1 documents in the recommended folders with the recommended name stem.
  if (regional) {
    const byElement = new Map(TW_M1.map((n) => [n.element, n]));
    for (const { node, target } of leaves.filter((l) => l.file === TW_REGIONAL_PATH && l.target)) {
      const spec = byElement.get(node.parent?.name);
      if (!spec) continue;
      const folder = target.slice(0, target.lastIndexOf("/"));
      if (folder !== spec.dir) add("O.BP1", `${spec.node} 的檔案建議放在 ${spec.dir}（目前在 ${folder}）。`, target);
      else if (!target.split("/").pop().startsWith(`${spec.prefix}-`)) add("O.BP2", `${spec.node} 的檔名建議以「${spec.prefix}-」開頭：${target.split("/").pop()}`, target);
    }
  }

  return result;
}

/** The DTD to validate against: the package's own util copy when it is the published one. */
const dtdCache = new Map();
function dtdFor(kind, utilText) {
  const files = kind === "ich" ? ["util/dtd/ich-ectd-3-2.dtd"] : ["util/dtd/tw-regional.dtd", "util/dtd/tw-envelope.mod", "util/dtd/tw-leaf.mod"];
  const key = files.map((p) => utilText.get(p) ?? "").join("\u0000");
  if (!dtdCache.has(key)) {
    const text = (p) => utilText.get(p) ?? BUNDLED.get(p);
    dtdCache.set(key, parseDtd(text(files[0]), (system) => text(`util/dtd/${system}`)));
  }
  return dtdCache.get(key);
}

/** Bundled copies of the published util files, used when a package's own are missing. */
const BUNDLED = new Map();
export async function loadBundledUtil(fetchText) {
  for (const u of UTIL_FILES) {
    if (!BUNDLED.has(u.path)) BUNDLED.set(u.path, await fetchText(u.path.split("/").pop()));
  }
}

function stylesheetOf(doc) {
  const pi = doc.pis.find((p) => p.target === "xml-stylesheet");
  return pi ? /href\s*=\s*["']([^"']*)["']/.exec(pi.data)?.[1] ?? null : null;
}

function childText(node, name) {
  return node.children.find((c) => c.name === name)?.text ?? "";
}

const NOT_HEADING = new Set(["leaf", "title", "link-text", "xref"]);
function isHeading(node) {
  if (NOT_HEADING.has(node.name)) return false;
  if (node.name === "node-extension") return true;
  // Backbone sections: ICH m2–m5 and TW m1 headings (envelope elements are not headings).
  return /^m[1-5]-/.test(node.name) && node.name !== "m1-administrative-information-and-prescribing-information";
}

/** Resolves an href against a base folder ("m1/tw/"), normalising "." and "..". */
function resolve(base, href) {
  const out = [];
  for (const seg of (base + decodeURI(href.split("#")[0])).split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === ".." && out.length && out[out.length - 1] !== "..") out.pop();
    else out.push(seg);
  }
  return out.join("/");
}

function readEnvelope(doc) {
  const env = [...walk(doc.root)].find((n) => n.name === "envelope");
  if (!env) return null;
  const all = (name) => env.children.filter((c) => c.name === name);
  const one = (name) => all(name)[0];
  return {
    identifier: (one("identifier")?.text ?? "").trim(),
    objective: one("submission")?.attrs.objective ?? "",
    type: one("submission")?.children.find((c) => c.name === "type")?.attrs ?? {},
    unitType: one("submission-unit")?.attrs.type ?? "",
    applicant: (one("applicant")?.children.find((c) => c.name === "name")?.text ?? "").trim(),
    inventedNames: all("invented-name").map((n) => ({
      name: childText(n, "name").trim(),
      licenses: n.children.filter((c) => c.name === "drug-permit-license").map((c) => c.text),
      appNo: childText(n, "pre-assigned-application-number"),
      codes: n.children.filter((c) => c.name === "code").map((c) => c.text),
    })),
    inns: all("inn").map((n) => n.text),
    sequence: (one("sequence")?.text ?? "").trim(),
    relatedSequences: all("related-sequence").map((n) => n.text.trim()),
    description: (one("submission-description")?.text ?? "").trim(),
  };
}

async function hashEntry(entry, keepEnds, progress, path) {
  const h = new Md5();
  let head = null;
  const tailParts = [];
  let tailLen = 0;
  for await (const chunk of streamIter(entry.stream())) {
    if (progress.signal?.aborted) throw new DOMException("已取消", "AbortError");
    h.update(chunk);
    if (keepEnds) {
      if (!head) head = chunk.slice(0, 2048);
      tailParts.push(chunk);
      tailLen += chunk.length;
      while (tailParts.length > 1 && tailLen - tailParts[0].length >= 8192) tailLen -= tailParts.shift().length;
    }
    progress.done += chunk.length;
    progress.onProgress?.(progress.done, progress.total, path);
  }
  let tail = null;
  if (keepEnds) {
    const all = new Uint8Array(tailLen);
    let o = 0;
    for (const p of tailParts) { all.set(p, o); o += p.length; }
    tail = all.subarray(Math.max(0, all.length - 8192));
  }
  return { md5: h.hex(), head, tail };
}

const latin1 = new TextDecoder("latin1");
function checkPdf(path, { head, tail }, add) {
  const start = head ? latin1.decode(head) : "";
  const end = tail ? latin1.decode(tail) : "";
  const m = /^%PDF-(\d)\.(\d)/.exec(start);
  if (!m) { add("P.2", `${path} 不是有效的 PDF（缺少 %PDF 檔頭），可能已損毀。`, path); return; }
  if (!end.includes("%%EOF")) add("P.2", `${path} 結尾缺少 %%EOF，檔案可能不完整或損毀。`, path);
  const version = Number(`${m[1]}.${m[2]}`);
  if (version <= 1.3) add("P.1", `${path} 為 PDF ${m[1]}.${m[2]}，不接受 1.3 或更早版本；請另存為 PDF 1.4–1.7。`, path);
  else if (version > 1.7) add("P.BP1", `${path} 為 PDF ${m[1]}.${m[2]}，建議使用 1.4–1.7。`, path);
  if (!/\/Linearized\b/.test(start)) add("P.BP4", `${path} 未設為快速 Web 檢視（Linearized）。`, path);
  if (/\/Encrypt\b/.test(end) || /\/Encrypt\b/.test(start)) add("P.BP11", `${path} 有加密或安全設定（密碼、列印或複製限制），請移除。`, path);
}

/** Overall verdict for display. */
export function summarize(report) {
  const all = [...report.findings, ...report.sequences.flatMap((s) => s.findings)];
  const refuse = all.filter((x) => x.severity === "P/F");
  const remind = all.filter((x) => x.severity === "BP");
  return { refuse, remind, ok: refuse.length === 0 };
}
