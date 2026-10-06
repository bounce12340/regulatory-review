// CTD nodes in file names and checklist items, used to place uploaded files on checklist
// items. The section tables themselves are in ectd-spec.js.
import { TW_M1 } from "./ectd-spec.js";

/**
 * Where each checklist item's documents sit in eCTD. Items whose label already names a
 * CTD section (e.g.「3.2.S.4.1 原料藥規格」) do not need an entry; it is read from the label.
 */
export const ITEM_NODES = {
  // 新藥查驗登記：Module 1
  m1_rtf: ["1.1.4"],
  m1_gcp_table: ["1.10"],
  m1_exclusivity_table: ["1.1.5"],
  m1_patent_declaration: ["1.1.7", "1.1.6"],
  m1_product_gmp: ["1.8"],
  m1_api_gmp: ["1.8", "1.14"],
  m1_gdp: ["1.4.5"],
  m1_cpp: ["1.6.1"],
  m1_adoption_certificate: ["1.6.2"],
  m1_bse: ["1.9"],
  m1_affidavit: ["1.2.1", "1.2.2", "1.2.3"],
  label_draft: ["1.3.1.1", "1.3.1", "1.13"],
  // 新藥查驗登記：Module 3
  s41_specification: ["3.2.s.4.1", "3.2.s.4.2", "3.2.s.4.4", "3.2.s.4.5"],
  p51_specification: ["3.2.p.5.1", "3.2.p.5.2", "3.2.p.5.4", "3.2.p.5.6"],
  s7_stability: ["3.2.s.7", "3.2.s.7.1", "3.2.s.7.2", "3.2.s.7.3"],
  p_container_closure: ["3.2.p.7"],
  p8_stability: ["3.2.p.8", "3.2.p.8.1", "3.2.p.8.2", "3.2.p.8.3"],
  r1_master_record: ["3.2.r"],
  // 原料藥／DMF
  dmf1_rtf_form: ["1.1.4"], dmf2_rtf_form: ["1.1.4"], dmf3_rtf_form: ["1.1.4"], dmf4_rtf_form: ["1.1.4"],
  dmf1_ctd_32s: ["3.2.s"], dmf2_ctd_open: ["3.2.s"],
  dmf2_authorization: ["1.14", "1.5"],
  dmf1_stability: ["3.2.s.7"], dmf2_stability: ["3.2.s.7"], dmf3_stability: ["3.2.s.7"],
  dmf4_coa: ["3.2.s.4.4"],
  dmf4_route: ["3.2.s.2.2"],
  // 展延
  item1: ["1.1.1"], item2: ["1.8"], item4: ["1.8"],
  // 銜接性試驗評估
  bse_form_e: ["1.9"], bse_self_report: ["1.9"],
};

const TW_DIR_NODE = new Map(TW_M1.map((n) => [n.dir.split("/").pop(), n.node]));

/**
 * CTD node numbers named in a path or file name, lower-case with dots: "3.2.S.4.1",
 * "32s41-spec", "3-2-s-4-1", "m1.1.4" and TW Module 1 folders such as "114-rtfcheck".
 */
export function nodesIn(text) {
  const found = new Set();
  const s = String(text ?? "").toLowerCase();
  // Dotted numbering, with an optional range: "3.2.s.4.1-4.4" names 3.2.s.4.1 and 3.2.s.4.4.
  // Not preceded by a digit or dot, so dates and versions like 2025.03.04 or v1.2 do not count.
  for (const m of s.matchAll(/(?:^|[^\d.a-z])m?([1-5](?:\.(?:\d{1,2}|[spar])(?![a-z]))+)(?:-(\d{1,2}(?:\.\d{1,2})*))?(?![\d.])/g)) {
    const parts = m[1].split(".");
    found.add(parts.join("."));
    if (m[2]) {
      const tail = m[2].split(".");
      if (tail.length < parts.length) found.add([...parts.slice(0, parts.length - tail.length), ...tail].join("."));
    }
  }
  // Hyphenated numbering without dots: "3-2-s-4-1".
  for (const m of s.matchAll(/(?:^|[^\d.a-z-])([1-5](?:-(?:\d|[spar])(?![a-z\d])){2,})/g)) {
    found.add(m[1].replace(/-/g, "."));
  }
  // ICH folder codes: 32s41-spec → 3.2.s.4.1, 32p8 → 3.2.p.8, 32r → 3.2.r
  for (const m of s.matchAll(/(?:^|[^\da-z])32([spar])(\d{0,3})(?=[^\da-z]|$)/g)) {
    found.add(["3.2", m[1], ...m[2].split("")].join("."));
  }
  for (const seg of s.split(/[\\/]/)) {
    const node = TW_DIR_NODE.get(seg);
    if (node) found.add(node);
  }
  return [...found];
}

/** CTD modules a text refers to: "M5", "m3", or the first digit of a CTD node. */
export function modulesIn(text) {
  const s = String(text ?? "").toLowerCase();
  const found = new Set((s.match(/(?:^|[^a-z0-9])m([1-5])(?![0-9])/g) ?? []).map((t) => t.slice(-1)));
  for (const n of nodesIn(s)) found.add(n[0]);
  return [...found];
}

/** Nodes for a checklist item: the mapped ones plus any CTD section its label names. */
export function itemNodes(item) {
  return [...new Set([...(ITEM_NODES[item.item_key] ?? []), ...nodesIn(item.item_name)])];
}
