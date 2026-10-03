/**
 * TFDA checklist templates — a direct port of config/regulatory_schemas.yaml.
 *
 * test/schemas.test.ts parses the YAML and fails if this file drifts from it,
 * so the YAML stays the single source of truth for labels, categories and risk rules.
 */

export type ItemStatus = "completed" | "in_progress" | "under_review" | "blocked" | "pending";
export type RiskLevel = "low" | "medium" | "high";

export const ITEM_STATUSES: readonly ItemStatus[] = [
  "pending",
  "in_progress",
  "under_review",
  "blocked",
  "completed",
];
export const RISK_LEVELS: readonly RiskLevel[] = ["low", "medium", "high"];

export interface RiskRules {
  default: RiskLevel;
  completed?: RiskLevel;
  in_progress?: RiskLevel;
  under_review?: RiskLevel;
  blocked?: RiskLevel;
  pending?: RiskLevel;
}

export interface TemplateItem {
  key: string;
  label: string;
  category: string;
  required: boolean;
  risk_rules: RiskRules;
  action: string;
  action_zh: string;
  /** Review threshold (審查門檻): what the item must satisfy before it can be marked completed. */
  criteria?: string[];
}

export interface Schema {
  display_name: string;
  display_name_zh: string;
  deadline_default_days: number;
  items: TemplateItem[];
}

export const SCHEMAS: Record<string, Schema> = {
  drug_registration_extension: {
    display_name: "Drug Registration Extension",
    display_name_zh: "藥品查驗登記展延",
    deadline_default_days: 90,
    items: [
      {
        key: "item1", label: "換發新證申請書", category: "license_renewal", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete and submit license renewal application form",
        action_zh: "完成並送出換發新證申請書",
      },
      {
        key: "item2", label: "成品製造廠 GMP 核備函", category: "gmp", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Obtain updated GMP verification letter",
        action_zh: "取得最新 GMP 核備函",
      },
      {
        key: "item3", label: "藥典/廠規檢驗規格變更備查", category: "specification", required: true,
        risk_rules: { completed: "low", under_review: "medium", default: "high" },
        action: "Follow up with TFDA on specification change review",
        action_zh: "追蹤 TFDA 檢驗規格變更備查進度",
      },
      {
        key: "item4", label: "原料藥製造廠 GMP 證明文件", category: "api_gmp", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Verify API GMP certificate authenticity",
        action_zh: "確認原料藥 GMP 證明文件真實性",
      },
      {
        key: "item5", label: "非登不可上傳原料藥 GMP 文件", category: "upload", required: true,
        risk_rules: { completed: "low", blocked: "high", default: "medium" },
        action: "Resolve QR code verification issue and upload documents",
        action_zh: "排除 QR code 驗證問題並上傳文件",
      },
      {
        key: "item6", label: "成品元素不純物風險評估報告", category: "risk_assessment", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Submit risk assessment report for approval",
        action_zh: "送出元素不純物風險評估報告",
      },
      {
        key: "item7", label: "ExPress 平臺上傳補正內容", category: "submission", required: true,
        risk_rules: { completed: "low", pending: "medium", default: "high" },
        action: "Prepare all documents for ExPress platform upload",
        action_zh: "備齊文件並上傳 ExPress 平臺",
      },
    ],
  },

  food_registration: {
    display_name: "Food Registration",
    display_name_zh: "食品查驗登記",
    deadline_default_days: 120,
    items: [
      {
        key: "item1", label: "食品業者登錄證明", category: "business_registration", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Submit food business registration certificate",
        action_zh: "提交食品業者登錄證明",
      },
      {
        key: "item2", label: "產品配方及製造流程說明書", category: "formulation", required: true,
        risk_rules: { completed: "low", under_review: "medium", default: "high" },
        action: "Prepare complete product formulation and manufacturing process",
        action_zh: "備妥完整產品配方及製造流程說明",
      },
      {
        key: "item3", label: "原料規格及來源證明", category: "raw_materials", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Provide raw material specifications and source certificates",
        action_zh: "提供原料規格及來源證明",
      },
      {
        key: "item4", label: "成品檢驗規格及方法", category: "testing_spec", required: true,
        risk_rules: { completed: "low", under_review: "medium", default: "high" },
        action: "Define finished product testing specifications and methods",
        action_zh: "訂定成品檢驗規格及方法",
      },
      {
        key: "item5", label: "衛生安全性試驗報告", category: "safety_testing", required: true,
        risk_rules: { completed: "low", blocked: "high", default: "high" },
        action: "Complete hygienic safety testing and obtain report",
        action_zh: "完成衛生安全性試驗並取得報告",
      },
      {
        key: "item6", label: "營養成分分析報告", category: "nutrition_analysis", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Submit nutritional composition analysis report",
        action_zh: "提交營養成分分析報告",
      },
      {
        key: "item7", label: "標籤及說明書審查", category: "labeling", required: true,
        risk_rules: { completed: "low", under_review: "medium", default: "medium" },
        action: "Complete label and leaflet review per TFDA guidelines",
        action_zh: "依 TFDA 規定完成標籤及說明書審查",
      },
      {
        key: "item8", label: "製造廠 GMP 符合性聲明", category: "manufacturer_gmp", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Obtain GMP compliance declaration from manufacturer",
        action_zh: "取得製造廠 GMP 符合性聲明",
      },
      {
        key: "item9", label: "進口食品衛生查驗申請", category: "import_inspection", required: false,
        risk_rules: { completed: "low", blocked: "high", default: "medium" },
        action: "Submit import food hygiene inspection application",
        action_zh: "提出進口食品衛生查驗申請",
      },
      {
        key: "item10", label: "查驗登記費用繳納證明", category: "payment", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Provide proof of registration fee payment",
        action_zh: "提供查驗登記費用繳納證明",
      },
    ],
  },

  medical_device_registration: {
    display_name: "Medical Device Registration",
    display_name_zh: "醫療器材查驗登記",
    deadline_default_days: 180,
    items: [
      {
        key: "item1", label: "醫療器材許可證申請書", category: "device_application", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete and submit medical device permit application",
        action_zh: "完成並送出醫療器材許可證申請書",
      },
      {
        key: "item2", label: "技術文件 (Technical File)", category: "technical_file", required: true,
        risk_rules: { completed: "low", under_review: "medium", default: "high" },
        action: "Compile comprehensive technical documentation",
        action_zh: "彙整完整技術文件",
      },
      {
        key: "item3", label: "臨床試驗資料或豁免聲明", category: "clinical_data", required: true,
        risk_rules: { completed: "low", under_review: "medium", blocked: "high", default: "high" },
        action: "Provide clinical trial data or clinical evaluation exemption",
        action_zh: "提供臨床試驗資料或臨床評估豁免聲明",
      },
      {
        key: "item4", label: "生物相容性試驗報告", category: "biocompatibility", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Submit biocompatibility testing report (ISO 10993)",
        action_zh: "提交生物相容性試驗報告（ISO 10993）",
      },
      {
        key: "item5", label: "電氣安全及電磁相容性報告", category: "electrical_safety", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Provide electrical safety and EMC test reports",
        action_zh: "提供電氣安全及電磁相容性測試報告",
      },
      {
        key: "item6", label: "製造廠 ISO 13485 / QMS 證書", category: "qms_certificate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Obtain valid ISO 13485 or QMS certificate from manufacturer",
        action_zh: "取得製造廠有效之 ISO 13485 或 QMS 證書",
      },
      {
        key: "item7", label: "符合性聲明 (Declaration of Conformity)", category: "conformity_declaration", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare Declaration of Conformity per TFDA requirements",
        action_zh: "依 TFDA 要求備妥符合性聲明",
      },
      {
        key: "item8", label: "標籤及說明書 (中文)", category: "device_labeling", required: true,
        risk_rules: { completed: "low", under_review: "medium", default: "medium" },
        action: "Translate and approve Chinese labeling and IFU",
        action_zh: "完成中文標籤及使用說明書翻譯與核定",
      },
      {
        key: "item9", label: "原產地證明", category: "origin_certificate", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Provide certificate of origin from manufacturer",
        action_zh: "提供製造廠原產地證明",
      },
      {
        key: "item10", label: "授權書及代理商資格文件", category: "authorization", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Submit authorization letter and distributor qualification documents",
        action_zh: "提交授權書及代理商資格文件",
      },
      {
        key: "item11", label: "查驗登記費用繳納證明", category: "payment", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Provide proof of registration fee payment",
        action_zh: "提供查驗登記費用繳納證明",
      },
    ],
  },

  // Source: 115年度新藥查驗登記說明會 (CDE, 2026-09-02). See docs/NDA_REVIEW_THRESHOLDS.md.
  new_drug_registration: {
    display_name: "New Drug Registration (Chemical)",
    display_name_zh: "新藥查驗登記（化學藥）",
    deadline_default_days: 180,
    items: [
      {
        key: "m1_rtf", label: "M1 RTF 查檢表（新藥不含學名藥及原料藥）", category: "module1_admin", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete the current RTF checklist and cross-index every attachment",
        action_zh: "以最新版 RTF 查檢表逐項確認並建立附件索引",
        criteria: [
          "使用現行版本（113年6月公告、113.07.01 起適用；含 NCE-2 欄位），每一欄均已判定適用性。",
          "每項附件可追溯到檔名、版本／日期與 CTD 位置；「不適用」須有依據。",
          "RTF 檢核若有重大缺失，廠商僅有 4 個月內一次補齊重新送件的機會，故送件前即應完備。",
        ],
      },
      {
        key: "m1_gcp_table", label: "M1 GCP 查核及藥品查驗登記申請案之臨床試驗資料表", category: "module1_admin", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the GCP inspection clinical-trial data table",
        action_zh: "填附 GCP 查核臨床試驗資料表",
        criteria: [
          "113.07.01 起所有新藥查驗登記申請案均須檢附（原僅新成分新藥）。",
          "列出與本案相關之全部臨床試驗，內容與 Module 5 一致。",
        ],
      },
      {
        key: "m1_exclusivity_table", label: "M1 資料專屬期及國內外臨床試驗資料表", category: "module1_admin", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Attach the data-exclusivity and clinical-trial table where applicable",
        action_zh: "依申請類型填附資料專屬期及國內外臨床試驗資料表",
        criteria: [
          "【適用】新成分、新療效、新複方、新使用途徑新藥必附。",
          "勾選欲申請項目（專利權期間延長、健保價格加算、資料專屬期等）；皆不申請時於「不適用」勾選，下方試驗清單留空。",
          "臨床試驗清單與 Module 5 一致、無漏列。",
        ],
      },
      {
        key: "m1_patent_declaration", label: "M1 藥品專利狀態之宣告表", category: "module1_admin", required: false,
        risk_rules: { completed: "low", default: "high" },
        action: "Generate and attach the patent status declaration from the patent linkage system",
        action_zh: "於專利連結登載系統產出並用印宣告表後檢附",
        criteria: [
          "【適用】依專利連結規定判定（課程提及新療效、新使用途徑等類型；適用範圍以現行規定為準，待查證）。",
          "須先於 TFDA 醫藥專利連結登載系統登載，產出含流水號之表單並用印。",
          "必須於送件時檢附；不接受送件後自行補件。",
        ],
      },
      {
        key: "m1_product_gmp", label: "M1 製劑製造廠 GMP 核備函", category: "module1_quality_docs", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the TFDA GMP approval letter covering the dosage form",
        action_zh: "檢附涵蓋本案劑型之監管組 GMP 核備函",
        criteria: [
          "核備函所載劑型（無菌／非無菌、液體／固體、特定劑型）涵蓋本案製劑，廠名廠址一致。",
          "高致敏性（頭孢子菌素、青黴素）、高活性荷爾蒙、細胞毒等產品須有對應專案核定。",
          "核備函非申請商持有時，附持有者授權函並載明核備案號。",
        ],
      },
      {
        key: "m1_api_gmp", label: "M1 原料藥 GMP 證明文件", category: "module1_quality_docs", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach an API GMP certificate that names the API, site, dates and PIC/S GMP compliance",
        action_zh: "檢附載明品項、廠址、日期並符合 PIC/S GMP 之原料藥 GMP 證明",
        criteria: [
          "由 TFDA 採認之國外衛生主管機關出具；載明製造廠名、廠址及本案原料藥品項名稱。",
          "載明查廠日期、核發日期或效期、符合 PIC/S GMP 說明，並有核發單位人員簽署。",
          "經我國駐外館處文書驗證；十大醫藥先進國出具之正本或可於官網查詢者免驗證。",
          "生物藥品之原料藥須為監管組核備函，不得僅附國外 API GMP 證明。",
        ],
      },
      {
        key: "m1_gdp", label: "M1 申請商 GDP 核備函", category: "module1_quality_docs", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Attach the applicant's GDP approval matching actual operations",
        action_zh: "檢附與實際作業內容相符之 GDP 核備函",
        criteria: [
          "核定作業內容（製劑／原料、冷鏈等）與申請商實際作業相符，可於 TFDA 公告名單核對。",
        ],
      },
      {
        key: "m1_cpp", label: "M1 出產國製售證明（CPP）", category: "module1_quality_docs", required: false,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach a valid, legalised CPP consistent with the application",
        action_zh: "檢附有效且經驗證、與申請內容一致之 CPP",
        criteria: [
          "【適用】輸入藥品必附。",
          "由出產國最高衛生主管機關出具，證明核准製造及自由販賣；品名、製造廠名稱地址、處方、劑型、含量與申請案一致。",
          "效期 2 年；須經駐外館處文書驗證（十大醫藥先進國出具者依規定免驗證）。",
        ],
      },
      {
        key: "m1_adoption_certificate", label: "M1 採用證明與國內臨床試驗要求", category: "module1_admin", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach adoption certificates and confirm the matching local clinical-trial requirement",
        action_zh: "檢附採用證明並確認對應之國內臨床試驗要求",
        criteria: [
          "新成分化學藥必附；由十大醫藥先進國最高衛生主管機關或 EMA 出具（藥品集＋仿單，或核准函＋官網核准資訊）。",
          "0 張：須國內 Phase I 加同步執行之 Phase III 樞紐試驗（或同步 Phase II 與 III），並強制檢附上市後風險管理計畫（RMP）。",
          "1 張：國內 Phase I、II、III 擇一，RMP 不強制。",
          "2 張以上：不強制國內臨床試驗，但須另申請銜接性試驗評估（BSE）。（審查準則第 38-1～38-4 條）",
        ],
      },
      {
        key: "m1_bse", label: "M1 銜接性試驗評估（BSE）", category: "module1_admin", required: true,
        risk_rules: { completed: "low", under_review: "medium", default: "high" },
        action: "File the bridging study evaluation or document the exemption basis",
        action_zh: "另案申請 BSE 或備妥免除依據",
        criteria: [
          "新成分新藥須依審查準則第 22-1 條另案申請；可於查驗登記前或同時申請。",
          "檢附 BSE 查檢表與完整臨床資料包（complete clinical data package），最好含東亞人種資料。",
          "免另案申請情形：小兒或少數嚴重疾病藥品認定、細胞／基因治療製劑，或已在國內執行具代表性且提供東亞人種 PK 之臨床試驗。",
          "BSE 免除函不等於療效與安全性已被認可，仍以查驗登記完整審查為準。",
        ],
      },
      {
        key: "s21_manufacturer", label: "3.2.S.2.1 原料藥製造廠", category: "module3_drug_substance", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "List every API site with its responsibilities",
        action_zh: "列出各廠廠名廠址及職責分工",
        criteria: [
          "列出製造、放行檢驗、安定性試驗、包裝各作業之廠名與廠址，並明確說明各廠職責。",
        ],
      },
      {
        key: "s23_materials", label: "3.2.S.2.3 原料藥物料管制（起始物與其他物料）", category: "module3_drug_substance", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Document starting-material sources, specifications, CoAs and controls for reagents and solvents",
        action_zh: "補齊起始物來源、規格、CoA 及試劑溶劑之管制",
        criteria: [
          "載明起始物製造廠廠名與廠址，並附起始物檢驗成績書／檢驗結果。",
          "起始物多來源時，提供各來源所製中間體或原料藥之批次分析並標示來源，證明品質一致。",
          "起始物規格納入殘餘溶劑／元素不純物，或提出免除管制之合理性；不純物允收標準有依據、不過度寬鬆。",
          "提供合成路徑所用溶劑與試劑資訊，以及製程中試劑、溶劑、輔助劑之檢驗規格與方法描述。",
        ],
      },
      {
        key: "s25_validation", label: "3.2.S.2.5 原料藥製程確效", category: "module3_drug_substance", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide the complete API process validation protocol and report",
        action_zh: "提供完整原料藥製程確效計畫書及報告書",
        criteria: [
          "檢附完整製程確效計畫書及報告書；僅附摘要不符（常見於輸入藥品）。",
        ],
      },
      {
        key: "s32_impurities", label: "3.2.S.3.2 原料藥不純物（有機雜質、殘餘溶劑、亞硝胺）", category: "module3_drug_substance", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide impurity structure elucidation, solvent controls and a nitrosamine risk assessment",
        action_zh: "補齊不純物結構鑑定、殘餘溶劑管控與亞硝胺風險評估",
        criteria: [
          "提供與原料藥結構相關不純物之結構鑑定圖譜及解析。",
          "非最終步驟使用之 ICH Q3C Class 2 溶劑：3 批量產或 6 批先導規模中間體／原料藥結果低於 Q3C 限量 10% 者得減免，否則納入規格。",
          "最終步驟使用之 Class 2 溶劑：一律不得減免，須於原料藥規格訂允收標準。",
          "苯等 Class 1 污染物：3 批量產或 6 批先導規模結果低於 Q3C 限量 30% 者得減免；否則提出未受污染之科學依據或納管。",
          "提供亞硝胺類不純物風險評估，涵蓋原物料、溶劑及製程來源。",
        ],
      },
      {
        key: "s41_specification", label: "3.2.S.4.1 原料藥規格", category: "module3_drug_substance", required: true,
        risk_rules: { completed: "low", under_review: "medium", default: "high" },
        action: "Align API specification with CoA, DMF and pharmacopoeia/ICH requirements",
        action_zh: "使原料藥規格與 CoA、DMF 及藥典／ICH 要求一致",
        criteria: [
          "製劑廠所列原料藥規格與原料藥廠 CoA、原核准案／DMF 之檢驗項目與允收標準一致，差異須說明。",
          "符合藥典個論、通則、ICH 及 TFDA 公告；含水分、熾灼殘渣等項目，未列者須有免除依據。",
          "含量允收標準須同時訂上下限；不純物限度不得高於藥典規範，除非有合理性依據。",
          "不純物閾值依 ICH Q3A(R2)：每日最大劑量 ≤2 g 時，報告 0.05%、鑑定 0.10% 或 1.0 mg/日（取低者）、驗證 0.15% 或 1.0 mg/日（取低者）；超過驗證閾值須有安全性資料；具異常毒性者閾值應更低。",
        ],
      },
      {
        key: "s43_method_validation", label: "3.2.S.4.3 原料藥分析方法確效", category: "module3_drug_substance", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide full method validation protocols and reports meeting the validation guidance",
        action_zh: "提供符合分析確效作業指導手冊之完整確效計畫書及報告書",
        criteria: [
          "檢附完整確效計畫書及報告書，不可僅附摘要。",
          "Range 涵蓋規格值適用範圍；不純物方法須評估 LOD／LOQ，且 LOQ 不高於規格值或線性最低值。",
          "準確度涵蓋適用範圍之 3 個以上濃度、至少 9 個測定值（如 3 濃度 × 3 重複）。",
        ],
      },
      {
        key: "s5_reference_standards", label: "3.2.S.5 原料藥對照標準品", category: "module3_drug_substance", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Document the source and qualification of primary and working standards",
        action_zh: "補齊一級及工作標準品之來源與資格化資料",
        criteria: [
          "藥典級一級標準品：附購買證明或實物照片。",
          "非藥典級一級標準品：附來源、批號、結構鑑定、標定程序及 CoA。",
          "工作標準品：註明來源，附 CoA 與標定程序。",
        ],
      },
      {
        key: "s7_stability", label: "3.2.S.7 原料藥安定性", category: "module3_drug_substance", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide stability data supporting the API retest period and storage conditions",
        action_zh: "提供足以支持再測試期與儲存條件之安定性資料",
        criteria: [
          "試驗設計、批次、條件、數據及統計分析足以支持宣稱之再測試期與儲存條件。",
        ],
      },
      {
        key: "p2_development", label: "3.2.P.2 藥劑開發（含溶離方法區辨力）", category: "module3_drug_product", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Provide a complete, challenging dissolution discrimination study and compatibility data",
        action_zh: "提供具挑戰性之溶離區辨力完整報告及相容性資料",
        criteria: [
          "溶離方法區辨力試驗條件具挑戰性，附完整報告與完整數據分析。",
          "新複方或新處方：評估原料藥間及原料藥與賦形劑間之相容性。",
          "新使用途徑／新劑型：說明賦形劑選擇、配方及製程開發、微生物學屬性；與途徑相關之原料藥 CQA（晶型、粒徑分布）須管控。",
        ],
      },
      {
        key: "p_container_closure", label: "3.2.P.2／3.2.P.7 容器封蓋系統與可滲出物／可萃出物", category: "module3_drug_product", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide a risk-based extractables/leachables assessment with AET and full reports",
        action_zh: "依風險完成可萃出物／可滲出物評估，附 AET 與完整報告",
        criteria: [
          "依給藥途徑風險與包材交互作用可能性分級；吸入氣化噴霧劑及吸入溶液、注射劑及注射懸液、眼用製劑、經皮軟膏與貼片為較高風險。",
          "提供可滲出物評估資料與完整報告，含分析評估閾值（AET）及計算公式。",
          "安全性結論以已確認鑑別並定量之化合物為基礎，並與 Module 4 毒理評估一致。",
        ],
      },
      {
        key: "p31_manufacturer", label: "3.2.P.3.1 成品製造廠", category: "module3_drug_product", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "List every finished-product site with its responsibilities",
        action_zh: "列出成品各廠廠名廠址及職責分工",
        criteria: [
          "說明各廠是否負責成品放行檢驗、安定性試驗與包裝，並提供執行安定性試驗之廠名及廠址。",
        ],
      },
      {
        key: "p32_batch_formula", label: "3.2.P.3.2 批次配方", category: "module3_drug_product", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Provide the commercial-scale batch formula with process water, overages and assay calculations",
        action_zh: "提供量產批量配方，含製程用水、增量及含量換算公式",
        criteria: [
          "提供量產批量（非試製批）之批次配方。",
          "列出製程中移除之溶劑（如 purified water）於量產批次之用量。",
          "註明增量（overage）資訊；下料量依原料藥含量（assay）計算者附計算公式。",
        ],
      },
      {
        key: "p35_validation", label: "3.2.P.3.5 成品製程確效（含無菌確效）", category: "module3_drug_product", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide the complete process validation protocol/report covering the maximum batch size",
        action_zh: "提供涵蓋最大批量之完整製程確效計畫書及報告書",
        criteria: [
          "檢附完整計畫書及報告書，涵蓋成品最大批量並含抽樣計畫或抽樣示意圖。",
          "確效之製程參數／管制與 3.2.P.3.3 現行生產一致，不一致須附支持資料。",
          "無菌產品之確效資料符合無菌操作作業指導手冊或最終滅菌作業指導手冊。",
        ],
      },
      {
        key: "p51_specification", label: "3.2.P.5.1 成品規格", category: "module3_drug_product", required: true,
        risk_rules: { completed: "low", under_review: "medium", default: "high" },
        action: "Set finished-product specifications per pharmacopoeia, ICH Q6A and dosage-form requirements",
        action_zh: "依藥典、ICH Q6A 及劑型要求訂定成品規格",
        criteria: [
          "檢驗項目符合藥典個論與通則（含劑型、使用途徑通則）、ICH Q6A 及 TFDA 公告。",
          "劑型特定項目：口服錠劑／膠囊（溶離、劑量單位均一度、微生物限量）；眼用（微粒物質、抗微生物防腐劑含量、可滲出物）；注射液（細菌內毒素、微粒物質）。",
          "口服製劑溶離允收標準有足夠開發資料支持；未列水分、微生物限量須有免除依據。",
          "降解產物管制符合 ICH Q3B(R2)；超過鑑定閾值須鑑定結構，超過驗證閾值須有安全性資料（閾值依每日最大劑量查表，數值以指引原文為準）。",
        ],
      },
      {
        key: "p53_method_validation", label: "3.2.P.5.3 成品分析方法確效", category: "module3_drug_product", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Validate methods over the minimum ranges in the validation guidance, incl. pharmacopoeial method verification",
        action_zh: "依分析確效作業指導手冊之最小範圍完成確效，藥典方法亦須確認",
        criteria: [
          "最小適用範圍：含量 80–120%；含量均一度 70–130%；溶離度為規定範圍 ±20%；雜質為報告量至規格值 120%。",
          "溶離採三階段允收（S1 Q+5%、S2 Q−15%、S3 Q−25%）且 Q=80% 時，確效範圍應涵蓋 35%–105%。",
          "不純物方法評估 LOD／LOQ，LOQ 不高於規格值或線性最低值。",
          "微生物限量等藥典方法須提供方法確認（verification）資料。",
        ],
      },
      {
        key: "p55_impurities", label: "3.2.P.5.5 成品不純物（亞硝胺、元素不純物）", category: "module3_drug_product", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide nitrosamine and ICH Q3D elemental impurity risk assessments with the stated option",
        action_zh: "提供亞硝胺及 ICH Q3D 元素不純物風險評估並敘明採用之 Option",
        criteria: [
          "亞硝胺風險評估涵蓋原料藥（二級／三級胺原物料或溶劑）、賦形劑（如微晶纖維素、HPMC、Povidone、硬脂酸鎂、乳糖）、製程、設備與容器封蓋系統。",
          "113.07.01 起不再適用中華藥典 <2231> 重金屬檢測，改依 <2233>／<2235> 或 ICH Q3D 評估；明確敘明採用 Option 1／2a／2b／3。",
          "完整風險評估須涵蓋原料藥、賦形劑、水、製程設備、容器封蓋系統，並評估刻意添加之元素（附供應商資料）。",
          "Option 2b：原料藥與賦形劑均有實測值且成品評估 <30% PDE → 原則免附成品檢驗；Option 1／2a：實測值 <30% MPC → 原則免附；實測值不完整（取自文獻／網站）→ 至少 1 批成品實測；Option 3 → 風險評估（至少含成品與容器封蓋系統）＋ 3 批成品實測。",
        ],
      },
      {
        key: "p6_reference_standards", label: "3.2.P.6 成品對照標準品", category: "module3_drug_product", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Document the source and qualification of reference standards",
        action_zh: "補齊對照標準品之來源與資格化資料",
        criteria: [
          "一級標準品：藥典級附購買證明或實物照片；非藥典級附結構鑑定資料。",
          "工作標準品：註明來源，附 CoA 與標定程序。",
        ],
      },
      {
        key: "p8_stability", label: "3.2.P.8 成品安定性", category: "module3_drug_product", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide updated long-term data and in-use, hold-time and reconstitution stability as applicable",
        action_zh: "更新長期安定性至最新結果，並補齊暫存、調製後及使用中安定性",
        criteria: [
          "長期安定性資料更新至最新結果，足以支持宣稱之架儲期。",
          "製程有半製品暫存者，提供支持暫存時間之安定性資料。",
          "仿單載明使用前須調製者，提供調製後安定性；可多次開封取用（如眼藥水）者，提供使用中安定性。",
        ],
      },
      {
        key: "r1_master_record", label: "3.2.R.1 製造管制標準書（含下料量）或批次製造紀錄", category: "module3_drug_product", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Provide the master production record or executed batch record",
        action_zh: "檢附製造管制標準書或批次製造紀錄",
        criteria: [
          "內容（下料量、製程參數、批量）與 3.2.P.3.2、3.2.P.3.3 及製程確效一致。",
        ],
      },
      {
        key: "m4_risk_coverage", label: "M4 非臨床風險涵蓋（基因毒性、致癌性、生殖發育、幼年毒性）", category: "module4_nonclinical", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Show nonclinical coverage of risks clinical data cannot detect, with exposure and metabolite bridging",
        action_zh: "整合臨床資料看不到之風險證據，並完成暴露量與代謝物橋接",
        criteria: [
          "基因毒性依 ICH S2(R1)、不純物依 ICH M7；致癌性依 ICH S1；生殖發育依 ICH S5（豁免須充分科學理由與替代證據）；幼年動物依 ICH S11。",
          "人體主要代謝物已於動物毒理試驗中涵蓋（ICH M3(R2)）。",
          "整理動物與人體暴露量（AUC／Cmax）倍數；改劑型或改途徑使全身暴露上升時，評估既有毒理資料是否足夠。",
          "每項發現整理為 finding、NOAEL 與相對人體暴露倍數，可供審查直接引用。",
        ],
      },
      {
        key: "m4_qualification", label: "M4 不純物、新賦形劑與可滲出物之安全性驗證", category: "module4_nonclinical", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Qualify impurities, novel excipients and leachables above thresholds, or tighten specifications",
        action_zh: "超過閾值之不純物、新賦形劑與可滲出物須完成安全性驗證或收緊規格",
        criteria: [
          "降解產物或不純物規格超過 ICH Q3A/Q3B 驗證閾值者，收緊規格或提供安全性驗證（如體外基因毒性篩檢與重複劑量毒性）。",
          "賦形劑含量超過已核准用量者（如 FDA IID 上限），提供包含生殖發育毒性之安全性評估。",
          "可滲出物以已確認並定量之化合物完成毒理評估（PDE／安全性閾值）。",
          "參考：US FDA CRL 非臨床缺失以可滲出物／可萃出物（40.6%）、雜質驗證（28.1%）、基因毒性（15.6%）、新賦形劑（12.5%）最多，集中於 505(b)(2) 類申請。",
        ],
      },
      {
        key: "m4_label_translation", label: "M4 非臨床發現轉譯至仿單", category: "module4_nonclinical", required: true,
        risk_rules: { completed: "low", under_review: "medium", default: "medium" },
        action: "Translate nonclinical findings into the label sections",
        action_zh: "將非臨床發現轉譯至仿單相關章節",
        criteria: [
          "動物毒理發現已反映於仿單 6.1 懷孕、6.4 小兒、9 過量、10.3 臨床前安全性資料等章節。",
          "以臨床使用者可讀之語言陳述風險、暴露倍數及其人體相關性。",
        ],
      },
      {
        key: "m5_clinical_pharmacology", label: "M2.7／M5 臨床藥理（產品連結性、特殊族群、DDI）", category: "module5_clinical", required: true,
        risk_rules: { completed: "low", under_review: "medium", default: "high" },
        action: "Establish product linkage and support dosing in special populations and DDIs",
        action_zh: "建立產品連結性並支持特殊族群與交互作用之用法用量",
        criteria: [
          "上市製劑與臨床試驗用藥之產品連結性可追溯（近五年常見缺失）。",
          "藥物特性、特殊族群（肝／腎功能）與藥物交互作用資料足以支持用法用量與警語。",
          "國外資料對國人／東亞族群之外推性有清楚論證。",
        ],
      },
      {
        key: "m5_clinical", label: "M5 臨床療效與安全性", category: "module5_clinical", required: true,
        risk_rules: { completed: "low", under_review: "medium", default: "high" },
        action: "Show that the clinical package supports efficacy and safety for the proposed indication",
        action_zh: "確認臨床資料足以支持擬申請適應症之療效與安全性",
        criteria: [
          "臨床資料量與研究設計足以支持療效與安全性結論（近五年不准案以「臨床資料不足」與「試驗結果無法證實療效」最多）。",
          "主要／次要療效指標、統計方法與結果直接支持擬申請適應症文字。",
          "安全性資料、風險族群與風險管理／仿單一致。",
        ],
      },
      {
        key: "ctd_consistency", label: "全案一致性（申請書、CTD、仿單、CPP、GMP、CoA）", category: "cross_module", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Cross-check names, dosage form, strength, formula, sites and dates across all documents",
        action_zh: "逐一比對全案文件之品名、劑型、含量、配方、廠址與日期",
        criteria: [
          "申請表、CTD、仿單、CPP、GMP、CoA、採用證明之品名、劑型、含量、配方、製造廠名稱地址與日期一致。",
          "Module 2 摘要之結論均可回溯至 Module 3–5 之完整原始資料。",
          "依 CTD（M1–M5）格式經 ExPress 線上送件（115.01.01 起不收紙本）；新成分新藥及生物藥品預計 116.07.01 起全面採 eCTD。",
        ],
      },
    ],
  },
};

export function isSchemaType(value: unknown): value is keyof typeof SCHEMAS {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SCHEMAS, value);
}

export function findTemplateItem(schemaType: string, itemKey: string | null): TemplateItem | undefined {
  if (!itemKey || !isSchemaType(schemaType)) return undefined;
  return SCHEMAS[schemaType].items.find((i) => i.key === itemKey);
}

/** Risk for a template item in a given status, per its YAML risk_rules. */
export function riskFor(rules: RiskRules, status: ItemStatus): RiskLevel {
  return rules[status] ?? rules.default;
}
