// Builds an eCTD sequence from documents already placed on CTD sections: folder and file
// names (TW 附件一 / ICH Appendix 4), tw-regional.xml with the envelope, index.xml, the MD5
// file and the util files, written into a ZIP64 archive as one stream.
//
// Documents go in as "new", or as "replace" with a modified-file pointing at a document of an
// earlier sequence; documents can also be deleted. Leaf IDs are derived from the sequence and
// the attachment, so building the same sequence again gives the same IDs (later sequences may
// already point at them).

import { NODE, TW_M1, ICH_NODES, UTIL_FILES, TW_REGIONAL_PATH, MAX_NAME, MAX_PATH, parentNode, slug } from "./ectd-spec.js";
import { esc, parseXml } from "./xml.js";
import { extractLeaves, modifiedFileFor } from "./ectd-lifecycle.js";
import { Md5, md5 } from "./md5.js";
import { Crc32, ZipWriter } from "./zip.js";

/**
 * @typedef {{
 *   identifier: string, objective: string, unitType: string,
 *   tier1?: string, tier2?: string, tier3?: string, tier4?: string, tier5?: string,
 *   applicant: string, cca: string, phones: string[], emails: string[],
 *   inventedNames: {name: string, licenses: string[], appNo: string, codes: string[]}[],
 *   inns: string[], sequence: string, relatedSequences: string[], description: string,
 * }} Envelope
 * @typedef {{substance?: string, manufacturer?: string, product?: string, dosageForm?: string, productManufacturer?: string, indication?: string}} Product
 * @typedef {{key: string, node: string, title: string, filename: string, size: number,
 *   target?: {sequence: string, xml: "index"|"tw", id: string}}} Doc  target: the earlier leaf it replaces
 * @typedef {{key: string, node: string, title: string, target: {sequence: string, xml: "index"|"tw", id: string}}} Deletion
 */

export const UNIT_TYPES = { initial: "首次送件", "validation-response": "驗證回復", response: "回復", "additional-info": "附加訊息", corrigendum: "更正", reformat: "格式轉換" };
export const OBJECTIVES = { new: "新申請案", change: "變更", extension: "展延", expiration: "註銷" };
export const TIERS = {
  tier1: { domestic: "國產", import: "輸入", "export-only": "外銷" },
  tier2: { "new-drugs-application": "新藥查驗登記", "biological-drugs-application": "生物藥品查驗登記", "generic-drug-application": "學名藥查驗登記", "active-pharmaceutical-ingredient": "原料藥" },
  tier3: { prescription: "處方", "over-the-counter": "非處方", "controlled-drugs": "管制藥品", "nuclear-medicine": "核子醫學", "biological-drugs": "生物藥品", "biosimilar-drugs": "生物相似性藥品", "regenerative-medicine": "再生醫療製劑", others: "其他" },
  tier4: { "new-chemical-entity": "新成分", "new-indication": "新療效", "new-combination": "新複方", "new-dosage-form": "新劑型", "new-administration": "新使用途徑", "new-dosage": "新使用劑量", "new-strength": "新單位含量", "genetic-engineering": "基因工程藥品", vaccine: "疫苗藥品", "plasma-derivative": "人用血漿藥品", "cell-therapy": "細胞治療製劑", "gene-therapy": "基因治療製劑", "tissue-engineering": "組織工程製劑", allergen: "過敏原藥品", "safety-monitoring": "監視", "non-safety-monitoring": "非監視", others: "其他" },
  tier5: { "new-chemical-entity": "新成分", "new-indication": "新療效", "new-combination": "新複方", "new-dosage-form": "新劑型", "new-administration": "新使用途徑", "new-dosage": "新使用劑量", "new-strength": "新單位含量", "comply-with-otc-criteria": "符合基準", "not-comply-with-otc-criteria": "不符合基準", others: "其他" },
};

export function newUuid() {
  return crypto.randomUUID();
}

/** Problems with the envelope that would fail validation (rules I.7, M.*, N.*, O.12). */
export function envelopeProblems(env) {
  const out = [];
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.identifier ?? "")) out.push("UUID 格式不正確。");
  if (!/^\d{4}$/.test(env.sequence ?? "")) out.push("序列須為 4 位數字（首次送件為 0000）。");
  if (!OBJECTIVES[env.objective]) out.push("請選擇送件目的。");
  if (!UNIT_TYPES[env.unitType]) out.push("請選擇送件種類。");
  const related = (env.relatedSequences ?? []).filter(Boolean);
  if (!related.length || related.some((s) => !/^\d{4}$/.test(s))) out.push("相關序列須為 4 位數字。");
  else if (["initial", "reformat"].includes(env.unitType) && !related.includes(env.sequence)) out.push("首次送件或格式轉換時，相關序列須等於本序列。");
  else if (!["initial", "reformat"].includes(env.unitType) && related.includes(env.sequence)) out.push("回復、補件等送件的相關序列不可等於本序列。");
  if (!env.applicant?.trim()) out.push("請填申請者公司名稱。");
  if (!env.cca?.trim()) out.push("請填工商憑證 IC 卡號。");
  if (!(env.phones ?? []).some((p) => p.trim())) out.push("請填公司電話。");
  if (!(env.emails ?? []).some((p) => p.trim())) out.push("請填公司電子郵件。");
  const names = env.inventedNames ?? [];
  if (!names.length) out.push("請填藥品名稱。");
  for (const n of names) {
    if (!n.name?.trim()) out.push("藥品名稱不可空白。");
    if (!/^\d{10}$/.test(n.appNo ?? "")) out.push("取號號碼須為 10 位數字（西元年月日＋流水號，例：2020101002）。");
    if (!(n.codes ?? []).some((c) => c.trim())) out.push("請填 code（取號號碼＋劑量，例：202010100210mg）。");
    if (["change", "extension", "expiration"].includes(env.objective) && !(n.licenses ?? []).some((l) => l.trim())) out.push("變更、展延、註銷須填藥品許可證字號。");
  }
  if (env.unitType === "initial" && !(env.inns ?? []).some((x) => x.trim())) out.push("首次送件須填主成分（INN）。");
  if (!env.description?.trim()) out.push("請填序列描述。");
  return [...new Set(out)];
}

/**
 * Assigns each document a path inside the sequence folder.
 * @param {Doc[]} docs
 * @param {Product} product
 * @returns {{placed: (Doc & {path: string})[], problems: {key?: string, message: string}[]}}
 */
export function planPaths(docs, product, appNo = "0000000000", sequence = "0000") {
  const problems = [];
  const placed = [];
  const used = new Set();
  const byNode = new Map();
  for (const d of docs) byNode.set(d.node, [...(byNode.get(d.node) ?? []), d]);
  const sFolder = slug(`${product.substance ?? ""}-${product.manufacturer ?? ""}`) || "substance-1-manufacturer-1";
  const pFolder = slug(product.product ?? "") || "product-1";

  for (const d of docs) {
    const spec = NODE.get(d.node);
    if (!spec || !spec.files) { problems.push({ key: d.key, message: `「${d.title}」放在 ${d.node}，該節點不可放檔案或不支援。` }); continue; }
    const ext = (d.filename.includes(".") ? d.filename.split(".").pop() : "").toLowerCase();
    const allowed = spec.module === 1 ? ["pdf", "xml", "jpg", "jpeg", "png", "svg", "gif"] : ["pdf", "jpg", "jpeg", "png", "svg", "gif"];
    if (!allowed.includes(ext)) { problems.push({ key: d.key, message: `「${d.filename}」是 .${ext || "?"}，eCTD 不接受此格式。請先轉成 PDF。` }); continue; }
    const folder = spec.module === 1 ? spec.dir : ichFolder(d.node, sFolder, pFolder);
    const siblings = byNode.get(d.node);
    const n = siblings.indexOf(d) + 1;
    let stem;
    if (spec.module === 1) {
      // 附件一: {prefix}-VAR.EXT; VAR from the original file name, else a number.
      const room = MAX_NAME - spec.prefix.length - ext.length - 2;
      const v = slug(d.filename.replace(/\.[^.]+$/, ""), Math.min(room, 30)) || String(n);
      stem = `${spec.prefix}-${v}`;
    } else {
      stem = siblings.length > 1 ? `${spec.base}-${n}` : spec.base;
    }
    let name = `${stem}.${ext}`;
    for (let k = 2; used.has(`${folder}/${name}`); k++) name = `${stem}-${k}.${ext}`;
    const path = `${folder}/${name}`;
    used.add(path);
    const full = `${appNo}/${sequence}/${path}`;
    if (full.length > MAX_PATH) problems.push({ key: d.key, message: `路徑超過 180 字元：${full}。請縮短原料藥或藥品名稱。` });
    if (d.size > 500 * 1024 * 1024) problems.push({ key: d.key, message: `「${d.filename}」超過 500 MB，須拆分。` });
    placed.push({ ...d, path });
  }
  return { placed, problems };
}

function ichFolder(node, sFolder, pFolder) {
  const chain = [];
  for (let n = node; n; n = parentNode(n)) chain.unshift(NODE.get(n));
  return chain.filter((s) => s?.dir).map((s) => s.dir.replace("@s", sFolder).replace("@p", pFolder)).join("/");
}

/** Leaf ID: unique within the application because it carries the sequence number. */
export function leafIdFor(sequence, key) {
  return `s${sequence}-${String(key).replace(/[^A-Za-z0-9_.-]/g, "_")}`;
}

const xmlOf = (node) => (node.startsWith("1.") ? "tw" : "index");

function leafXml(indent, { id, href, md5: sum, title, op = "new", modifiedFile = null }) {
  const mod = modifiedFile ? ` modified-file="${esc(modifiedFile)}"` : "";
  // A deleted document has no file: no href and an empty checksum (ICH eCTD V3.2.2).
  const link = op === "delete" ? "" : ` xlink:href="${esc(href)}"`;
  return `${indent}<leaf ID="${id}" operation="${op}"${mod} checksum-type="md5" checksum="${op === "delete" ? "" : sum}" xlink:type="simple"${link}>\n` +
    `${indent}  <title>${esc(title)}</title>\n${indent}</leaf>\n`;
}

/** Leaf attributes for a placed document or a deletion in this sequence. */
function leafOf(d, sequence, hrefOf) {
  const op = d.op ?? (d.target ? "replace" : "new");
  return {
    id: leafIdFor(sequence, d.op === "delete" ? `d${d.key}` : `a${d.key}`),
    href: d.path ? hrefOf(d) : null, md5: d.md5 ?? "", title: d.title, op,
    modifiedFile: d.target ? modifiedFileFor(xmlOf(d.node), d.target) : null,
  };
}

/** tw-regional.xml for the envelope and the Module 1 documents (paths relative to m1/tw). */
export function twRegionalXml(env, m1Docs) {
  const seq = env.sequence;
  const t = (s) => esc(String(s ?? "").trim());
  const typeAttrs = ["tier1", "tier2", "tier3", "tier4", "tier5"].filter((k) => env[k]).map((k) => ` ${k}="${t(env[k])}"`).join("");
  let x = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE tw:tw-backbone SYSTEM "../../util/dtd/tw-regional.dtd">\n` +
    `<?xml-stylesheet type="text/xsl" href="../../util/style/tw-regional.xsl"?>\n` +
    `<tw:tw-backbone xmlns:tw="http://www.fda.gov.tw" xmlns:xlink="http://www.w3c.org/1999/xlink" dtd-version="2.0">\n` +
    `  <tw-envelope>\n    <envelope>\n` +
    `      <identifier>${t(env.identifier)}</identifier>\n` +
    `      <submission objective="${t(env.objective)}">\n        <type${typeAttrs}/>\n      </submission>\n` +
    `      <submission-unit type="${t(env.unitType)}"/>\n` +
    `      <applicant>\n        <name>${t(env.applicant)}</name>\n        <corporate-certification-authority>${t(env.cca)}</corporate-certification-authority>\n` +
    env.phones.filter((p) => p.trim()).map((p) => `        <phone-number>${t(p)}</phone-number>\n`).join("") +
    env.emails.filter((p) => p.trim()).map((p) => `        <email-address>${t(p)}</email-address>\n`).join("") +
    `      </applicant>\n      <procedure type="national"/>\n` +
    env.inventedNames.map((n) => `      <invented-name>\n        <name>${t(n.name)}</name>\n` +
      (n.licenses ?? []).filter((l) => l.trim()).map((l) => `        <drug-permit-license>${t(l)}</drug-permit-license>\n`).join("") +
      `        <pre-assigned-application-number>${t(n.appNo)}</pre-assigned-application-number>\n` +
      n.codes.filter((c) => c.trim()).map((c) => `        <code>${t(c)}</code>\n`).join("") +
      `      </invented-name>\n`).join("") +
    env.inns.filter((x) => x.trim()).map((x) => `      <inn>${t(x)}</inn>\n`).join("") +
    `      <sequence>${t(env.sequence)}</sequence>\n` +
    env.relatedSequences.filter((s) => s.trim()).map((s) => `      <related-sequence>${t(s)}</related-sequence>\n`).join("") +
    `      <submission-description>${t(env.description)}</submission-description>\n` +
    `    </envelope>\n  </tw-envelope>\n`;
  x += sectionXml(TW_M1, "m1-tw", m1Docs, "  ", (d) => leafOf(d, seq, (doc) => doc.path.slice("m1/tw/".length)));
  return `${x}</tw:tw-backbone>\n`;
}

/**
 * Writes the headings that have documents, nested and in DTD order.
 * @param {object[]} specs  section table (DTD order)
 */
function sectionXml(specs, rootElement, docs, indent, leafFor, attrsOf = () => "") {
  const has = new Set();
  for (const d of docs) for (let n = d.node; n; n = parentNode(n)) has.add(n);
  const children = (parent) => specs.filter((s) => has.has(s.node) && parentNode(s.node) === parent);
  const render = (spec, pad) => {
    let out = `${pad}<${spec.element}${attrsOf(spec)}>\n`;
    for (const d of docs.filter((x) => x.node === spec.node)) out += leafXml(`${pad}  `, leafFor(d));
    for (const c of children(spec.node)) out += render(c, `${pad}  `);
    return `${out}${pad}</${spec.element}>\n`;
  };
  // Top-level sections are the ones whose parent is not in the table (1.x under m1-tw; "2"/"3" for ICH).
  const inTable = new Set(specs.map((s) => s.node));
  const tops = specs.filter((s) => has.has(s.node) && !inTable.has(parentNode(s.node)));
  if (rootElement) return `${indent}<${rootElement}>\n${tops.map((s) => render(s, `${indent}  `)).join("")}${indent}</${rootElement}>\n`;
  return tops.map((s) => render(s, indent)).join("");
}

/** index.xml: a leaf for tw-regional.xml in m1, then Modules 2 and 3. */
export function indexXml(twRegionalMd5, ichDocs, product, sequence = "0000") {
  const a = (k, v) => (v && String(v).trim() ? ` ${k}="${esc(String(v).trim())}"` : "");
  const attrsOf = (spec) => {
    if (spec.node === "3.2.s" || spec.node === "2.3.s") return a("substance", product.substance || "substance-1") + a("manufacturer", product.manufacturer || "manufacturer-1");
    if (spec.node === "3.2.p" || spec.node === "2.3.p") return a("product-name", product.product) + a("dosageform", product.dosageForm) + a("manufacturer", product.productManufacturer);
    if (spec.node === "2.7.3") return a("indication", product.indication || "indication-1");
    return "";
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE ectd:ectd SYSTEM "util/dtd/ich-ectd-3-2.dtd">\n` +
    `<?xml-stylesheet type="text/xsl" href="util/style/ectd-2-0.xsl"?>\n` +
    `<ectd:ectd xmlns:ectd="http://www.ich.org/ectd" xmlns:xlink="http://www.w3c.org/1999/xlink" dtd-version="3.2">\n` +
    `  <m1-administrative-information-and-prescribing-information>\n` +
    leafXml("    ", { id: leafIdFor(sequence, "tw-regional"), href: TW_REGIONAL_PATH, md5: twRegionalMd5, title: "TW Regional" }) +
    `  </m1-administrative-information-and-prescribing-information>\n` +
    sectionXml(ICH_NODES, null, ichDocs, "  ", (d) => leafOf(d, sequence, (doc) => doc.path), attrsOf) +
    `</ectd:ectd>\n`;
}

/** CRC-32 and MD5 of a Blob in one read. */
export async function hashBlob(blob, onBytes) {
  const crc = new Crc32();
  const h = new Md5();
  const step = 8 * 1024 * 1024;
  for (let off = 0; off < blob.size; off += step) {
    const chunk = new Uint8Array(await blob.slice(off, off + step).arrayBuffer());
    crc.update(chunk);
    h.update(chunk);
    onBytes?.(chunk.length);
  }
  return { crc: crc.value(), md5: h.hex() };
}

/**
 * Writes the whole sequence as a ZIP: {appNo}/{sequence}/...
 * @param {{env: Envelope, product: Product, placed: (Doc & {path: string})[],
 *   deletes?: Deletion[], fetchDoc: (doc) => Promise<Blob>, fetchUtil: (name: string) => Promise<Blob>,
 *   sink: {write: (chunk: Uint8Array|Blob) => Promise<void>},
 *   onProgress?: (done: number, total: number, label: string) => void, signal?: AbortSignal}} o
 */
export async function writePackage({ env, product, placed, deletes = [], fetchDoc, fetchUtil, sink, onProgress, signal }) {
  const appNo = env.inventedNames[0].appNo;
  const root = `${appNo}/${env.sequence}/`;
  const zip = new ZipWriter(sink);
  const total = placed.reduce((n, d) => n + d.size, 0);
  let done = 0;
  const hashed = [];
  for (const d of placed) {
    if (signal?.aborted) throw new DOMException("已取消", "AbortError");
    onProgress?.(done, total, d.title);
    const blob = await fetchDoc(d);
    const { crc, md5: sum } = await hashBlob(blob, (n) => { done += n / 2; onProgress?.(done, total, d.title); });
    await zip.add(root + d.path, blob, crc);
    done += blob.size / 2;
    hashed.push({ ...d, md5: sum });
  }
  for (const u of UTIL_FILES) {
    const bytes = new Uint8Array(await (await fetchUtil(u.path.split("/").pop())).arrayBuffer());
    if (md5(bytes) !== u.md5) throw new Error(`內建的 ${u.path} checksum 不符，請重新整理頁面後再試。`);
    await zip.add(root + u.path, bytes, new Crc32().update(bytes).value());
  }
  const removed = deletes.map((d) => ({ ...d, op: "delete", path: null, md5: "" }));
  const all = [...hashed, ...removed];
  const m1 = all.filter((d) => xmlOf(d.node) === "tw");
  const ich = all.filter((d) => xmlOf(d.node) === "index");
  const enc = new TextEncoder();
  const twText = twRegionalXml(env, m1);
  const tw = enc.encode(twText);
  await zip.add(root + TW_REGIONAL_PATH, tw, new Crc32().update(tw).value());
  const indexText = indexXml(md5(tw), ich, product, env.sequence);
  const index = enc.encode(indexText);
  await zip.add(`${root}index.xml`, index, new Crc32().update(index).value());
  const sum = enc.encode(md5(index));
  await zip.add(`${root}index-md5.txt`, sum, new Crc32().update(sum).value());
  await zip.finish();
  onProgress?.(total, total, "完成");
  // What this sequence contains, for replacing or deleting its documents later.
  const manifest = { sequence: env.sequence, uuid: env.identifier, leaves: extractLeaves(parseXml(indexText), parseXml(twText)) };
  return { files: hashed.length + UTIL_FILES.length + 3, manifest };
}
