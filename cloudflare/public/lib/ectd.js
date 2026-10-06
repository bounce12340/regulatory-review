// eCTD structure used to place uploaded files on checklist items (and, later, to build
// an eCTD sequence). Sources:
// - TW Module 1: TFDA「藥品查驗登記電子通用技術文件指引」eCTD-R2.1 (114.06.30), 附件一
//   Directory / File Structure for TW Module 1.
// - Module 3: the same guideline, 表十 (nodes per ICH eCTD Specification V3.2.2).

/** TW Module 1 nodes: node number, backbone element, directory (under the sequence folder). */
export const TW_M1 = [
  ["1.1", "m1-1-offdoc", "m1/tw/11-offdoc", "公文及相關表單"],
  ["1.1.1", "m1-1-1-form", "m1/tw/11-offdoc/111-form", "申請書／公文／回覆函／原廠說明函"],
  ["1.1.2", "m1-1-2-applform", "m1/tw/11-offdoc/112-applform", "案件類別表"],
  ["1.1.3", "m1-1-3-reginf", "m1/tw/11-offdoc/113-reginf", "案件基本資料表"],
  ["1.1.4", "m1-1-4-rtfcheck", "m1/tw/11-offdoc/114-rtfcheck", "RTF 查檢表"],
  ["1.1.5", "m1-1-5-dataexc", "m1/tw/11-offdoc/115-dataexc", "資料專屬期及國內外臨床試驗資料表"],
  ["1.1.6", "m1-1-6-patinf", "m1/tw/11-offdoc/116-patinf", "專利資訊"],
  ["1.1.7", "m1-1-7-decfor", "m1/tw/11-offdoc/117-decfor", "藥品專利狀態聲明表"],
  ["1.1.8", "m1-1-8-receip", "m1/tw/11-offdoc/118-receip", "繳費收據"],
  ["1.2.1", "m1-2-1-affia", "m1/tw/12-affi/121-affia", "切結書（甲）"],
  ["1.2.2", "m1-2-2-affib", "m1/tw/12-affi/122-affib", "切結書（乙）"],
  ["1.2.3", "m1-2-3-affic", "m1/tw/12-affi/123-affic", "切結書（丙）"],
  ["1.3.1", "m1-3-1-lab", "m1/tw/13-labart/131-lab", "仿單"],
  ["1.3.1.1", "m1-3-1-1-chilab", "m1/tw/13-labart/131-lab/1311-chilab", "中文仿單"],
  ["1.3.1.2", "m1-3-1-2-englab", "m1/tw/13-labart/131-lab/1312-englab", "英文仿單"],
  ["1.3.1.3", "m1-3-1-3-orilab", "m1/tw/13-labart/131-lab/1313-orilab", "原文仿單"],
  ["1.3.2", "m1-3-2-mpimg", "m1/tw/13-labart/132-mpimg", "醫護／病人信息、藥物指南"],
  ["1.3.3.1", "m1-3-3-1-chco", "m1/tw/13-labart/133-labcc/1331-chco", "仿單變更對照"],
  ["1.3.3.2", "m1-3-3-2-labhis", "m1/tw/13-labart/133-labcc/1332-labhis", "仿單變更歷史紀錄"],
  ["1.3.4.1", "m1-3-4-1-conlab", "m1/tw/13-labart/134-art/1341-conlab", "標籤"],
  ["1.3.4.2", "m1-3-4-2-outpac", "m1/tw/13-labart/134-art/1342-outpac", "外盒"],
  ["1.3.4.3", "m1-3-4-3-afp", "m1/tw/13-labart/134-art/1343-afp", "鋁箔"],
  ["1.3.4.4", "m1-3-4-4-amd", "m1/tw/13-labart/134-art/1344-amd", "輔助／醫材設備"],
  ["1.3.5", "m1-3-5-reflab", "m1/tw/13-labart/135-reflab", "仿單依據"],
  ["1.3.6", "m1-3-6-proapp", "m1/tw/13-labart/136-proapp", "產品外觀"],
  ["1.4", "m1-4-lic", "m1/tw/14-lic", "證照"],
  ["1.4.1", "m1-4-1-pharmalic", "m1/tw/14-lic/141-pharmalic", "藥商許可執照"],
  ["1.4.2", "m1-4-2-busilic", "m1/tw/14-lic/142-busilic", "公司登記或商業登記證明"],
  ["1.4.3", "m1-4-3-prodlic", "m1/tw/14-lic/143-prodlic", "藥品許可證"],
  ["1.4.4", "m1-4-4-locmanuflic", "m1/tw/14-lic/144-locmanuflic", "國產工廠登記核准證明"],
  ["1.4.5", "m1-4-5-gdpappro", "m1/tw/14-lic/145-gdpappro", "GDP 證明文件／核備函"],
  ["1.5", "m1-5-letauthor", "m1/tw/15-letauthor", "委託書"],
  ["1.6", "m1-6-refcountryappro", "m1/tw/16-refcountryappro", "參考國家核准證明"],
  ["1.6.1", "m1-6-1-pharmaprodcerti", "m1/tw/16-refcountryappro/161-pharmaprodcerti", "製售證明（CPP）"],
  ["1.6.2", "m1-6-2-salecerti", "m1/tw/16-refcountryappro/162-salecerti", "採用證明／公定書"],
  ["1.7", "m1-7-formulbase", "m1/tw/17-formulbase", "處方依據"],
  ["1.8", "m1-8-gmpcerti", "m1/tw/18-gmpcerti", "GMP 證明文件／核備函"],
  ["1.9", "m1-9-bridgevalu", "m1/tw/19-bridgevalu", "銜接性試驗評估"],
  ["1.10", "m1-10-locclinicalstudy", "m1/tw/110-locclinicalstudy", "國內臨床試驗現況"],
  ["1.11", "m1-11-locbabestudy", "m1/tw/111-locbabestudy", "國內 BA/BE 試驗現況"],
  ["1.12.1", "m1-12-1-contractmanufform", "m1/tw/112-contractmanuf/1121-contractmanufform", "委託製造申請函"],
  ["1.12.2", "m1-12-2-contractmanufagreementcopy", "m1/tw/112-contractmanuf/1122-contractmanufagreementcopy", "委託製造契約書影本"],
  ["1.12.3", "m1-12-3-contractmanufprodecrip", "m1/tw/112-contractmanuf/1123-contractmanufprodecrip", "分段委託製造說明"],
  ["1.13", "m1-13-riskmanagplan", "m1/tw/113-riskmanagplan", "風險管理計畫書"],
  ["1.14", "m1-14-dmfletter", "m1/tw/114-dmfletter", "DMF 核備函"],
  ["1.15", "m1-15-desigapproletter", "m1/tw/115-desigapproletter", "認定核備函"],
  ["1.16", "m1-16-refagenassessreport", "m1/tw/116-refagenassessreport", "其他國家審查報告"],
  ["1.17", "m1-17-others", "m1/tw/117-others", "其他"],
].map(([node, element, dir, title]) => ({ node, element, dir, title }));

/** Module 3 nodes (表十), lower-case as eCTD writes them. */
export const M3 = [
  ["3.2.s.1.1", "命名"], ["3.2.s.1.2", "結構"], ["3.2.s.1.3", "一般性質"],
  ["3.2.s.2.1", "製造廠"], ["3.2.s.2.2", "製程及製程管制之描述"], ["3.2.s.2.3", "物料管制"],
  ["3.2.s.2.4", "關鍵步驟及中間體管制"], ["3.2.s.2.5", "製程確效及／或評估"], ["3.2.s.2.6", "製程開發"],
  ["3.2.s.3.1", "結構解析及其他特徵"], ["3.2.s.3.2", "不純物"],
  ["3.2.s.4.1", "規格"], ["3.2.s.4.2", "分析方法"], ["3.2.s.4.3", "分析方法確效"], ["3.2.s.4.4", "批次分析"], ["3.2.s.4.5", "規格合理性之依據"],
  ["3.2.s.5", "對照標準品或對照物質"], ["3.2.s.6", "容器封裝系統"],
  ["3.2.s.7.1", "安定性概要及結論"], ["3.2.s.7.2", "核准後安定性試驗計畫書及承諾"], ["3.2.s.7.3", "安定性數據"],
  ["3.2.p.1", "藥品性狀及配方組成"], ["3.2.p.2", "藥劑開發"],
  ["3.2.p.3.1", "製造廠"], ["3.2.p.3.2", "批次配方"], ["3.2.p.3.3", "製程及製程管制之描述"], ["3.2.p.3.4", "關鍵步驟及中間體管制"], ["3.2.p.3.5", "製程確效及／或評估"],
  ["3.2.p.4.1", "賦形劑規格"], ["3.2.p.4.2", "賦形劑分析方法"], ["3.2.p.4.3", "賦形劑分析方法確效"], ["3.2.p.4.4", "賦形劑規格合理性之依據"],
  ["3.2.p.4.5", "人或動物來源的賦形劑"], ["3.2.p.4.6", "新賦形劑"],
  ["3.2.p.5.1", "規格"], ["3.2.p.5.2", "分析方法"], ["3.2.p.5.3", "分析方法確效"], ["3.2.p.5.4", "批次分析"], ["3.2.p.5.5", "不純物特徵及結構鑑定"], ["3.2.p.5.6", "規格合理性之依據"],
  ["3.2.p.6", "對照標準品或對照物質"], ["3.2.p.7", "容器封裝系統"],
  ["3.2.p.8.1", "安定性概要及結論"], ["3.2.p.8.2", "核准後安定性試驗計畫書及承諾"], ["3.2.p.8.3", "安定性數據"],
  ["3.2.a.1", "設備及儀器"], ["3.2.a.2", "外源因子之安全評估"], ["3.2.a.3", "賦形劑"], ["3.2.r", "區域性資料"], ["3.3", "參考文獻"],
].map(([node, title]) => ({ node, title }));

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
