// eCTD lifecycle across sequences: which documents are current, and the rules for replacing
// or deleting a document submitted earlier (TFDA eCTD-V-R2.1 rules I.8, K.9, K.10, K.12,
// M.2, M.4; ICH eCTD Specification V3.2.2 "modified-file").
//
// A sequence is summarised as a manifest: {sequence, uuid, leaves}. Each leaf records where
// it lives (index.xml or tw-regional.xml), its ID, CTD section and operation, and — for
// replace/delete — the earlier leaf it modifies.

import { walk } from "./xml.js";
import { TW_M1, ICH_NODES } from "./ectd-spec.js";

const NODE_BY_ELEMENT = new Map([...TW_M1, ...ICH_NODES].map((n) => [n.element, n.node]));
// Attributes that make a section distinct (one 3.2.S per substance and manufacturer, …).
const SECTION_ATTRS = ["substance", "manufacturer", "product-name", "dosageform", "excipient", "indication"];
export const XML_PATH = { index: "index.xml", tw: "m1/tw/tw-regional.xml" };

/**
 * Leaves of one sequence's backbone files.
 * @returns {{id: string, xml: "index"|"tw", node: string|null, section: string, title: string,
 *   path: string|null, md5: string, op: string, modifiedFile: string|null, extension: boolean}[]}
 */
export function extractLeaves(indexDoc, twDoc) {
  const out = [];
  const add = (doc, xml, base) => {
    if (!doc) return;
    for (const node of walk(doc.root)) {
      if (node.name !== "leaf") continue;
      const chain = [];
      let extension = false;
      let heading = null;
      for (let p = node.parent; p; p = p.parent) {
        if (p.name === "node-extension") {
          extension = true;
          chain.unshift(`node-extension[${(p.children.find((c) => c.name === "title")?.text ?? "").trim()}]`);
          continue;
        }
        const attrs = SECTION_ATTRS.filter((a) => p.attrs[a]).map((a) => `${a}=${p.attrs[a].trim()}`);
        chain.unshift(attrs.length ? `${p.name}[${attrs.join(",")}]` : p.name);
        if (!heading && NODE_BY_ELEMENT.has(p.name)) heading = p.name;
      }
      const href = node.attrs["xlink:href"];
      out.push({
        id: node.attrs.ID ?? "",
        xml,
        node: heading ? NODE_BY_ELEMENT.get(heading) : null,
        section: chain.join("/"),
        title: (node.children.find((c) => c.name === "title")?.text ?? "").trim(),
        path: href ? normalize(base + href) : null,
        md5: (node.attrs.checksum ?? "").trim().toLowerCase(),
        op: node.attrs.operation ?? "",
        modifiedFile: node.attrs["modified-file"] || null,
        extension,
      });
    }
  };
  add(indexDoc, "index", "");
  add(twDoc, "tw", "m1/tw/");
  // The index.xml leaf that points at tw-regional.xml is plumbing, not a document.
  return out.filter((l) => !(l.xml === "index" && l.path === XML_PATH.tw));
}

function normalize(path) {
  const out = [];
  for (const seg of decodeURI(path.split("#")[0]).split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === ".." && out.length && out[out.length - 1] !== "..") out.pop();
    else out.push(seg);
  }
  return out.join("/");
}

/**
 * The modified-file value for a leaf in `xml` of the current sequence pointing at `target`
 * in an earlier sequence. index.xml leaves: "../0000/index.xml#ID" (ICH). tw-regional.xml
 * leaves: the same path written relative to m1/tw (TFDA publishes no example; this follows
 * the EU Module 1 convention of resolving relative to the regional XML).
 */
export function modifiedFileFor(xml, target) {
  const up = xml === "tw" ? "../../../" : "../";
  return `${up}${target.sequence}/${XML_PATH[target.xml]}#${target.id}`;
}

/** Resolves a modified-file value to {sequence, xml, id}; null when it is not understood. */
export function parseModifiedFile(value, xml) {
  if (!value) return null;
  const [path, id] = value.split("#");
  if (!id) return null;
  // Relative to the XML that holds the leaf; some tools write tw-regional.xml leaves relative
  // to the sequence folder instead, so that is tried second.
  for (const base of xml === "tw" ? ["SEQ/m1/tw/", "SEQ/"] : ["SEQ/"]) {
    const full = normalize(base + path); // "../0000/index.xml" from SEQ/ → "0000/index.xml"
    const m = /^(?:\.\.\/)*(\d{4})\/(index\.xml|m1\/tw\/tw-regional\.xml)$/.exec(full);
    if (m) return { sequence: m[1], xml: m[2] === "index.xml" ? "index" : "tw", id };
  }
  return null;
}

export const leafKey = (sequence, xml, id) => `${sequence}:${xml}:${id}`;

/**
 * Current documents after applying every manifest in sequence order.
 * @param {{sequence: string, leaves: object[]}[]} history
 * @returns {Map<string, object>} key → leaf (with .sequence), only leaves still in force
 */
export function currentLeaves(history) {
  const current = new Map();
  for (const m of [...history].sort((a, b) => a.sequence.localeCompare(b.sequence))) {
    for (const l of m.leaves) {
      const target = ["replace", "delete", "append"].includes(l.op) ? parseModifiedFile(l.modifiedFile, l.xml) : null;
      if (target && l.op !== "append") current.delete(leafKey(target.sequence, target.xml, target.id));
      if (l.op !== "delete") current.set(leafKey(m.sequence, l.xml, l.id), { ...l, sequence: m.sequence });
    }
  }
  return current;
}

/**
 * Lifecycle checks for one sequence against the sequences before it.
 * @param {{sequence: string, uuid: string|null, leaves: object[]}} cur
 * @param {{sequence: string, uuid: string|null, leaves: object[]}[]} history  earlier sequences
 * @returns {{rule: string, message: string}[]}
 */
export function lifecycleFindings(cur, history) {
  const out = [];
  const earlier = history.filter((m) => m.sequence < cur.sequence).sort((a, b) => a.sequence.localeCompare(b.sequence));
  if (history.some((m) => m.sequence === cur.sequence)) out.push({ rule: "M.2", message: `序列 ${cur.sequence} 先前已送出過，序列號碼不可重複使用。` });
  const prev = earlier[earlier.length - 1];
  if (prev && Number(cur.sequence) !== Number(prev.sequence) + 1) {
    out.push({ rule: "M.4", message: `前一序列為 ${prev.sequence}，本序列應為 ${String(Number(prev.sequence) + 1).padStart(4, "0")}（目前為 ${cur.sequence}）。` });
  } else if (!prev && cur.sequence !== "0000" && history.length) {
    out.push({ rule: "M.4", message: `沒有比 ${cur.sequence} 更早的序列紀錄。` });
  }
  if (prev?.uuid && cur.uuid && prev.uuid !== cur.uuid) out.push({ rule: "I.8", message: `UUID ${cur.uuid} 與序列 ${prev.sequence} 的 ${prev.uuid} 不同；同一申請案各序列須使用相同 UUID。` });

  const all = new Map();
  for (const m of earlier) for (const l of m.leaves) all.set(leafKey(m.sequence, l.xml, l.id), { ...l, sequence: m.sequence });
  const live = currentLeaves(earlier);
  const knownSeqs = new Set(earlier.map((m) => m.sequence));
  const usedHere = new Set();
  for (const l of cur.leaves) {
    if (!["replace", "delete", "append"].includes(l.op) || !l.modifiedFile) continue;
    const where = `「${l.title || l.id}」`;
    const t = parseModifiedFile(l.modifiedFile, l.xml);
    if (!t) { out.push({ rule: "K.9", message: `${where} 的 modified-file「${l.modifiedFile}」格式無法解析。` }); continue; }
    if (!knownSeqs.has(t.sequence)) continue; // that sequence was not provided: not checkable
    const key = leafKey(t.sequence, t.xml, t.id);
    const target = all.get(key);
    if (!target) { out.push({ rule: "K.9", message: `${where} 要修改的 leaf（序列 ${t.sequence}，ID ${t.id}）不存在。` }); continue; }
    if (!live.has(key) || usedHere.has(key)) out.push({ rule: "K.12", message: `${where} 要修改的「${target.title}」（序列 ${t.sequence}）已被替換或刪除過，不可再次修改。` });
    usedHere.add(key);
    if (target.section !== l.section) {
      const lenient = l.extension || target.extension || /m3-2-a-appendices/.test(l.section);
      out.push({
        rule: lenient ? "K.BP1" : "K.10",
        message: `${where} 與被修改的「${target.title}」不在同一個 CTD 段落（${target.node ?? "?"} → ${l.node ?? "?"}）。`,
      });
    }
  }
  return out;
}
