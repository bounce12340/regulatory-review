// eCTD structure for TFDA submissions: where each CTD section lives in the backbone XML
// and in the folder tree, and the fixed util files. Sources:
// - TW Module 1: TFDA「藥品查驗登記電子通用技術文件指引」eCTD-R2.1 (114.06.30), 附件一 and
//   tw-regional.dtd (TW DTD 2.0).
// - Modules 2–3: ICH eCTD Specification V3.2.2, Appendix 4 (folder and file names) and
//   ich-ectd-3-2.dtd (element names and order).
// - Validation rules: TFDA「藥品查驗登記電子通用技術文件驗證指引」eCTD-V-R2.1 (114.06.30).

/** util files every sequence must carry, with the MD5 that TFDA publishes for each (rules A–F). */
export const UTIL_FILES = [
  { rule: "A", path: "util/dtd/ich-ectd-3-2.dtd", md5: "1d6f631cc6b6357f0f4fe378e5f79a27", label: "ICH DTD" },
  { rule: "B", path: "util/style/ectd-2-0.xsl", md5: "3a07a202455e954a2eb203c5bb443f77", label: "ICH stylesheet" },
  { rule: "C", path: "util/dtd/tw-regional.dtd", md5: "7fda419340e75d211f225e848147c146", label: "TW M1 DTD" },
  { rule: "D", path: "util/dtd/tw-leaf.mod", md5: "95b144b95741e35d1156a555fb0fb0d3", label: "TW M1 leaf MOD" },
  { rule: "E", path: "util/dtd/tw-envelope.mod", md5: "a6ad252d90be4e9dd7e4f260b8a714e7", label: "TW M1 envelope MOD" },
  { rule: "F", path: "util/style/tw-regional.xsl", md5: "3db8d033c596c49c83d1e2287b002b73", label: "TW M1 stylesheet" },
];

export const TW_REGIONAL_PATH = "m1/tw/tw-regional.xml";
export const MAX_NAME = 64; // O.4, O.5
export const MAX_PATH = 180; // O.3
export const MAX_FILE_BYTES = 500 * 1024 * 1024; // O.13
export const NAME_RE = /^[a-z0-9-]+$/; // O.6, O.7 (file names: plus one extension)
export const M1_FORMATS = ["pdf", "xml", "jpg", "jpeg", "png", "svg", "gif"]; // O.1
// ICH M2–M5 formats (O.2). XML only appears as backbone/regional files.
export const ICH_FORMATS = ["pdf", "xml", "jpg", "jpeg", "png", "svg", "gif", "xpt", "txt", "sas"];

/**
 * TW Module 1 (附件一). files: false marks headings that may not hold documents
 * ("files are not allowed"). prefix is the file name stem: 111-form/form-VAR.pdf.
 */
export const TW_M1 = [
  ["1.1", "m1-1-offdoc", "m1/tw/11-offdoc", "公文及相關表單", "Official Letter and Document"],
  ["1.1.1", "m1-1-1-form", "m1/tw/11-offdoc/111-form", "申請書／公文／回覆函／原廠說明函", "Application Form / Official Letter / Response Letter"],
  ["1.1.2", "m1-1-2-applform", "m1/tw/11-offdoc/112-applform", "案件類別表", "Type of Application Form"],
  ["1.1.3", "m1-1-3-reginf", "m1/tw/11-offdoc/113-reginf", "案件基本資料表", "Regulatory Information Form"],
  ["1.1.4", "m1-1-4-rtfcheck", "m1/tw/11-offdoc/114-rtfcheck", "RTF 查檢表", "Refuse to File Checklist"],
  ["1.1.5", "m1-1-5-dataexc", "m1/tw/11-offdoc/115-dataexc", "資料專屬期及國內外臨床試驗資料表", "Data Exclusivity and Domestic/Foreign Clinical Study Information Form"],
  ["1.1.6", "m1-1-6-patinf", "m1/tw/11-offdoc/116-patinf", "專利資訊", "Patent Information"],
  ["1.1.7", "m1-1-7-decfor", "m1/tw/11-offdoc/117-decfor", "藥品專利狀態聲明表", "Declaration Form of the Status of Pharmaceutical Patents"],
  ["1.1.8", "m1-1-8-receip", "m1/tw/11-offdoc/118-receip", "繳費收據", "Receipt"],
  ["1.2", "m1-2-affi", "m1/tw/12-affi", "切結書", "Affidavit", false],
  ["1.2.1", "m1-2-1-affia", "m1/tw/12-affi/121-affia", "切結書（甲）", "Affidavit A"],
  ["1.2.2", "m1-2-2-affib", "m1/tw/12-affi/122-affib", "切結書（乙）", "Affidavit B"],
  ["1.2.3", "m1-2-3-affic", "m1/tw/12-affi/123-affic", "切結書（丙）", "Affidavit C"],
  ["1.3", "m1-3-labart", "m1/tw/13-labart", "標籤仿單", "Labeling and Artwork", false],
  ["1.3.1", "m1-3-1-lab", "m1/tw/13-labart/131-lab", "仿單", "Labeling"],
  ["1.3.1.1", "m1-3-1-1-chilab", "m1/tw/13-labart/131-lab/1311-chilab", "中文仿單", "Chinese Labeling"],
  ["1.3.1.2", "m1-3-1-2-englab", "m1/tw/13-labart/131-lab/1312-englab", "英文仿單", "English Labeling"],
  ["1.3.1.3", "m1-3-1-3-orilab", "m1/tw/13-labart/131-lab/1313-orilab", "原文仿單", "Original Labeling"],
  ["1.3.2", "m1-3-2-mpimg", "m1/tw/13-labart/132-mpimg", "醫護／病人信息、藥物指南", "Medical/Patient Information, Medication Guides"],
  ["1.3.3", "m1-3-3-labcc", "m1/tw/13-labart/133-labcc", "仿單變更對照", "Labeling Change Comparison", false],
  ["1.3.3.1", "m1-3-3-1-chco", "m1/tw/13-labart/133-labcc/1331-chco", "變更對照", "Change Comparison"],
  ["1.3.3.2", "m1-3-3-2-labhis", "m1/tw/13-labart/133-labcc/1332-labhis", "變更歷史紀錄", "Labeling History"],
  ["1.3.4", "m1-3-4-art", "m1/tw/13-labart/134-art", "標籤、外盒、鋁箔", "Artwork (Mock-up)", false],
  ["1.3.4.1", "m1-3-4-1-conlab", "m1/tw/13-labart/134-art/1341-conlab", "標籤", "Container Labels"],
  ["1.3.4.2", "m1-3-4-2-outpac", "m1/tw/13-labart/134-art/1342-outpac", "外盒", "Outer Package"],
  ["1.3.4.3", "m1-3-4-3-afp", "m1/tw/13-labart/134-art/1343-afp", "鋁箔", "Aluminium Foil Package"],
  ["1.3.4.4", "m1-3-4-4-amd", "m1/tw/13-labart/134-art/1344-amd", "輔助／醫材設備", "Auxiliary/Medical Devices"],
  ["1.3.5", "m1-3-5-reflab", "m1/tw/13-labart/135-reflab", "仿單依據", "Reference Labeling"],
  ["1.3.6", "m1-3-6-proapp", "m1/tw/13-labart/136-proapp", "產品外觀", "Product Appearance"],
  ["1.4", "m1-4-lic", "m1/tw/14-lic", "證照", "Certificate/License"],
  ["1.4.1", "m1-4-1-pharmalic", "m1/tw/14-lic/141-pharmalic", "藥商許可執照", "Pharmaceutical Company Certificate"],
  ["1.4.2", "m1-4-2-busilic", "m1/tw/14-lic/142-busilic", "公司登記或商業登記之證明文件", "Business Registration or Certificate"],
  ["1.4.3", "m1-4-3-prodlic", "m1/tw/14-lic/143-prodlic", "藥品許可證", "Product License"],
  ["1.4.4", "m1-4-4-locmanuflic", "m1/tw/14-lic/144-locmanuflic", "國產工廠登記核准證明", "Local Manufacturing Certificate"],
  ["1.4.5", "m1-4-5-gdpappro", "m1/tw/14-lic/145-gdpappro", "GDP 證明文件／核備函", "GDP Approval Letter"],
  ["1.5", "m1-5-letauthor", "m1/tw/15-letauthor", "委託書", "Letter of Authorization"],
  ["1.6", "m1-6-refcountryappro", "m1/tw/16-refcountryappro", "參考國家核准證明", "Reference Country Approval"],
  ["1.6.1", "m1-6-1-pharmaprodcerti", "m1/tw/16-refcountryappro/161-pharmaprodcerti", "製售證明（CPP）", "Certificate of Pharmaceutical Product"],
  ["1.6.2", "m1-6-2-salecerti", "m1/tw/16-refcountryappro/162-salecerti", "採用證明／公定書", "Free Sale Certificate / Official Formulary"],
  ["1.7", "m1-7-formulbase", "m1/tw/17-formulbase", "處方依據", "Formulation Basis"],
  ["1.8", "m1-8-gmpcerti", "m1/tw/18-gmpcerti", "GMP 證明文件／核備函", "GMP Certificate / Approval Letter"],
  ["1.9", "m1-9-bridgevalu", "m1/tw/19-bridgevalu", "銜接性試驗評估", "Bridging Study Evaluation"],
  ["1.10", "m1-10-locclinicalstudy", "m1/tw/110-locclinicalstudy", "國內臨床試驗現況", "Local Clinical Study Status"],
  ["1.11", "m1-11-locbabestudy", "m1/tw/111-locbabestudy", "國內 BA/BE 試驗現況", "Local Bioavailability / Bioequivalence Study Status"],
  ["1.12", "m1-12-contractmanuf", "m1/tw/112-contractmanuf", "委託製造", "Contract Manufacturing", false],
  ["1.12.1", "m1-12-1-contractmanufform", "m1/tw/112-contractmanuf/1121-contractmanufform", "委託製造申請函", "Application Form for Contract Manufacture"],
  ["1.12.2", "m1-12-2-contractmanufagreementcopy", "m1/tw/112-contractmanuf/1122-contractmanufagreementcopy", "委託製造契約書影本", "Copy of Contract Manufacturing Agreement"],
  ["1.12.3", "m1-12-3-contractmanufprodecrip", "m1/tw/112-contractmanuf/1123-contractmanufprodecrip", "分段委託製造說明", "Description of Contract Manufacturing Process"],
  ["1.13", "m1-13-riskmanagplan", "m1/tw/113-riskmanagplan", "風險管理計畫書", "Risk Management Plan"],
  ["1.14", "m1-14-dmfletter", "m1/tw/114-dmfletter", "DMF 核備函", "DMF Approval Letter"],
  ["1.15", "m1-15-desigapproletter", "m1/tw/115-desigapproletter", "認定核備函", "Designation Approval Letter"],
  ["1.16", "m1-16-refagenassessreport", "m1/tw/116-refagenassessreport", "其他國家審查報告", "Assessment Report from Reference Agency"],
  ["1.17", "m1-17-others", "m1/tw/117-others", "其他", "Others"],
].map(([node, element, dir, title, titleEn, files = true]) => ({
  node, element, dir, title, titleEn, files, module: 1, prefix: dir.split("/").pop().replace(/^\d+-/, ""),
}));

/**
 * ICH Modules 2 and 3. dir is relative to the parent's folder (null: documents sit in the
 * parent's folder); "@s" / "@p" stand for the substance / product folder; base is the
 * recommended file name stem.
 */
const ICH = [
  ["2", "m2-common-technical-document-summaries", "m2", null, "通用技術文件摘要", false],
  ["2.2", "m2-2-introduction", "22-intro", "introduction", "前言"],
  ["2.3", "m2-3-quality-overall-summary", "23-qos", null, "品質概要", false],
  ["2.3.i", "m2-3-introduction", null, "introduction", "品質概要簡介"],
  ["2.3.s", "m2-3-s-drug-substance", null, "drug-substance", "品質概要：原料藥"],
  ["2.3.p", "m2-3-p-drug-product", null, "drug-product", "品質概要：藥品"],
  ["2.3.a", "m2-3-a-appendices", null, "appendices", "品質概要：附錄"],
  ["2.3.r", "m2-3-r-regional-information", null, "regional-information", "品質概要：區域性資料"],
  ["2.4", "m2-4-nonclinical-overview", "24-nonclin-over", "nonclinical-overview", "非臨床總論"],
  ["2.5", "m2-5-clinical-overview", "25-clin-over", "clinical-overview", "臨床總論"],
  ["2.6", "m2-6-nonclinical-written-and-tabulated-summaries", "26-nonclin-sum", null, "非臨床列表概要表", false],
  ["2.6.1", "m2-6-1-introduction", null, "introduction", "非臨床概要簡介"],
  ["2.6.2", "m2-6-2-pharmacology-written-summary", null, "pharmacol-written-summary", "藥理學概要"],
  ["2.6.3", "m2-6-3-pharmacology-tabulated-summary", null, "pharmacol-tabulated-summary", "藥理學列表概要"],
  ["2.6.4", "m2-6-4-pharmacokinetics-written-summary", null, "pharmkin-written-summary", "藥動學概要"],
  ["2.6.5", "m2-6-5-pharmacokinetics-tabulated-summary", null, "pharmkin-tabulated-summary", "藥動學列表概要"],
  ["2.6.6", "m2-6-6-toxicology-written-summary", null, "toxicology-written-summary", "毒理學概要"],
  ["2.6.7", "m2-6-7-toxicology-tabulated-summary", null, "toxicology-tabulated-summary", "毒理學列表概要"],
  ["2.7", "m2-7-clinical-summary", "27-clin-sum", null, "臨床概要", false],
  ["2.7.1", "m2-7-1-summary-of-biopharmaceutic-studies-and-associated-analytical-methods", null, "summary-biopharm", "生物藥劑試驗與其相關分析方法概要"],
  ["2.7.2", "m2-7-2-summary-of-clinical-pharmacology-studies", null, "summary-clin-pharm", "臨床藥理試驗概要"],
  ["2.7.3", "m2-7-3-summary-of-clinical-efficacy", null, "summary-clin-efficacy", "臨床療效概要"],
  ["2.7.4", "m2-7-4-summary-of-clinical-safety", null, "summary-clin-safety", "臨床安全性概要"],
  ["2.7.5", "m2-7-5-literature-references", null, "literature-references", "參考文獻"],
  ["2.7.6", "m2-7-6-synopses-of-individual-studies", null, "synopses-indiv-studies", "個別研究摘要"],

  ["3", "m3-quality", "m3", null, "品質", false],
  ["3.2", "m3-2-body-of-data", "32-body-data", null, "數據資料內容", false],
  ["3.2.s", "m3-2-s-drug-substance", "32s-drug-sub/@s", null, "原料藥", false],
  ["3.2.s.1", "m3-2-s-1-general-information", "32s1-gen-info", null, "一般資料", false],
  ["3.2.s.1.1", "m3-2-s-1-1-nomenclature", null, "nomenclature", "命名"],
  ["3.2.s.1.2", "m3-2-s-1-2-structure", null, "structure", "結構"],
  ["3.2.s.1.3", "m3-2-s-1-3-general-properties", null, "general-properties", "一般性質"],
  ["3.2.s.2", "m3-2-s-2-manufacture", "32s2-manuf", null, "製造", false],
  ["3.2.s.2.1", "m3-2-s-2-1-manufacturer", null, "manufacturer", "製造廠"],
  ["3.2.s.2.2", "m3-2-s-2-2-description-of-manufacturing-process-and-process-controls", null, "manuf-process-and-controls", "製程及製程管制之描述"],
  ["3.2.s.2.3", "m3-2-s-2-3-control-of-materials", null, "control-of-materials", "物料管制"],
  ["3.2.s.2.4", "m3-2-s-2-4-controls-of-critical-steps-and-intermediates", null, "control-critical-steps", "關鍵步驟及中間體管制"],
  ["3.2.s.2.5", "m3-2-s-2-5-process-validation-and-or-evaluation", null, "process-validation", "製程確效及／或評估"],
  ["3.2.s.2.6", "m3-2-s-2-6-manufacturing-process-development", null, "manuf-process-development", "製程開發"],
  ["3.2.s.3", "m3-2-s-3-characterisation", "32s3-charac", null, "特徵及結構鑑定", false],
  ["3.2.s.3.1", "m3-2-s-3-1-elucidation-of-structure-and-other-characteristics", null, "elucidation-of-structure", "結構解析及其他特徵"],
  ["3.2.s.3.2", "m3-2-s-3-2-impurities", null, "impurities", "不純物"],
  ["3.2.s.4", "m3-2-s-4-control-of-drug-substance", "32s4-contr-drug-sub", null, "原料藥管制", false],
  ["3.2.s.4.1", "m3-2-s-4-1-specification", "32s41-spec", "specification", "規格"],
  ["3.2.s.4.2", "m3-2-s-4-2-analytical-procedures", "32s42-analyt-proc", "analytical-procedure", "分析方法"],
  ["3.2.s.4.3", "m3-2-s-4-3-validation-of-analytical-procedures", "32s43-val-analyt-proc", "validation-analytical-procedure", "分析方法確效"],
  ["3.2.s.4.4", "m3-2-s-4-4-batch-analyses", "32s44-batch-analys", "batch-analyses", "批次分析"],
  ["3.2.s.4.5", "m3-2-s-4-5-justification-of-specification", "32s45-justif-spec", "justification-of-specification", "規格合理性之依據"],
  ["3.2.s.5", "m3-2-s-5-reference-standards-or-materials", "32s5-ref-stand", "reference-standards", "對照標準品或對照物質"],
  ["3.2.s.6", "m3-2-s-6-container-closure-system", "32s6-cont-closure-sys", "container-closure-system", "容器封裝系統"],
  ["3.2.s.7", "m3-2-s-7-stability", "32s7-stab", null, "安定性", false],
  ["3.2.s.7.1", "m3-2-s-7-1-stability-summary-and-conclusions", null, "stability-summary", "安定性概要及結論"],
  ["3.2.s.7.2", "m3-2-s-7-2-post-approval-stability-protocol-and-stability-commitment", null, "postapproval-stability", "核准後安定性試驗計畫書及承諾"],
  ["3.2.s.7.3", "m3-2-s-7-3-stability-data", null, "stability-data", "安定性數據"],
  ["3.2.p", "m3-2-p-drug-product", "32p-drug-prod/@p", null, "藥品", false],
  ["3.2.p.1", "m3-2-p-1-description-and-composition-of-the-drug-product", "32p1-desc-comp", "description-and-composition", "藥品性狀及配方組成"],
  ["3.2.p.2", "m3-2-p-2-pharmaceutical-development", "32p2-pharm-dev", "pharmaceutical-development", "藥劑開發"],
  ["3.2.p.3", "m3-2-p-3-manufacture", "32p3-manuf", null, "製造", false],
  ["3.2.p.3.1", "m3-2-p-3-1-manufacturers", null, "manufacturers", "製造廠"],
  ["3.2.p.3.2", "m3-2-p-3-2-batch-formula", null, "batch-formula", "批次配方"],
  ["3.2.p.3.3", "m3-2-p-3-3-description-of-manufacturing-process-and-process-controls", null, "manuf-process-and-controls", "製程及製程管制之描述"],
  ["3.2.p.3.4", "m3-2-p-3-4-controls-of-critical-steps-and-intermediates", null, "control-critical-steps", "關鍵步驟及中間體管制"],
  ["3.2.p.3.5", "m3-2-p-3-5-process-validation-and-or-evaluation", null, "process-validation", "製程確效及／或評估"],
  ["3.2.p.4", "m3-2-p-4-control-of-excipients", "32p4-contr-excip", null, "賦形劑管制", false],
  ["3.2.p.4.1", "m3-2-p-4-1-specifications", null, "specifications", "賦形劑規格"],
  ["3.2.p.4.2", "m3-2-p-4-2-analytical-procedures", null, "analytical-procedures", "賦形劑分析方法"],
  ["3.2.p.4.3", "m3-2-p-4-3-validation-of-analytical-procedures", null, "validation-analyt-procedures", "賦形劑分析方法確效"],
  ["3.2.p.4.4", "m3-2-p-4-4-justification-of-specifications", null, "justification-of-specifications", "賦形劑規格合理性之依據"],
  ["3.2.p.4.5", "m3-2-p-4-5-excipients-of-human-or-animal-origin", null, "excipients-human-animal", "人或動物來源的賦形劑"],
  ["3.2.p.4.6", "m3-2-p-4-6-novel-excipients", null, "novel-excipients", "新賦形劑"],
  ["3.2.p.5", "m3-2-p-5-control-of-drug-product", "32p5-contr-drug-prod", null, "藥品管制", false],
  ["3.2.p.5.1", "m3-2-p-5-1-specifications", "32p51-spec", "specifications", "規格"],
  ["3.2.p.5.2", "m3-2-p-5-2-analytical-procedures", "32p52-analyt-proc", "analytical-procedure", "分析方法"],
  ["3.2.p.5.3", "m3-2-p-5-3-validation-of-analytical-procedures", "32p53-val-analyt-proc", "validation-analytical-procedure", "分析方法確效"],
  ["3.2.p.5.4", "m3-2-p-5-4-batch-analyses", "32p54-batch-analys", "batch-analyses", "批次分析"],
  ["3.2.p.5.5", "m3-2-p-5-5-characterisation-of-impurities", "32p55-charac-imp", "characterisation-impurities", "不純物特徵及結構鑑定"],
  ["3.2.p.5.6", "m3-2-p-5-6-justification-of-specifications", "32p56-justif-spec", "justification-of-specifications", "規格合理性之依據"],
  ["3.2.p.6", "m3-2-p-6-reference-standards-or-materials", "32p6-ref-stand", "reference-standards", "對照標準品或對照物質"],
  ["3.2.p.7", "m3-2-p-7-container-closure-system", "32p7-cont-closure-sys", "container-closure-system", "容器封裝系統"],
  ["3.2.p.8", "m3-2-p-8-stability", "32p8-stab", null, "安定性", false],
  ["3.2.p.8.1", "m3-2-p-8-1-stability-summary-and-conclusion", null, "stability-summary", "安定性概要及結論"],
  ["3.2.p.8.2", "m3-2-p-8-2-post-approval-stability-protocol-and-stability-commitment", null, "postapproval-stability", "核准後安定性試驗計畫書及承諾"],
  ["3.2.p.8.3", "m3-2-p-8-3-stability-data", null, "stability-data", "安定性數據"],
  ["3.2.a", "m3-2-a-appendices", "32a-app", null, "附錄", false],
  ["3.2.a.1", "m3-2-a-1-facilities-and-equipment", "32a1-fac-equip", "facilities-and-equipment", "設備及儀器"],
  ["3.2.a.2", "m3-2-a-2-adventitious-agents-safety-evaluation", "32a2-advent-agent", "adventitious-agents", "外源因子之安全評估"],
  ["3.2.a.3", "m3-2-a-3-excipients", "32a3-excip", "excipients", "賦形劑"],
  ["3.2.r", "m3-2-r-regional-information", "32r-reg-info", "regional-information", "區域性資料"],
  ["3.3", "m3-3-literature-references", "33-lit-ref", "reference", "參考文獻"],
].map(([node, element, dir, base, title, files = true]) => ({ node, element, dir, base, title, files, module: Number(node[0]) }));

/** Parent node: "3.2.s.4.1" → "3.2.s.4"; the M2.3 sub-parts sit under "2.3". */
export function parentNode(node) {
  const i = node.lastIndexOf(".");
  return i < 0 ? null : node.slice(0, i);
}

export const ICH_NODES = ICH;
export const NODE = new Map([...TW_M1, ...ICH].map((n) => [n.node, n]));

/** Sections a document can be placed in (headings with no documents of their own excluded). */
export const PLACEABLE = [...TW_M1, ...ICH].filter((n) => n.files);

/** Lower-case a-z, 0-9 and hyphens, collapsed; "" when nothing usable is left. */
export function slug(text, max = 40) {
  return String(text ?? "").normalize("NFKD").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/g, "");
}
