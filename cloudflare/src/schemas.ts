/**
 * TFDA checklist templates — a direct port of config/regulatory_schemas.yaml.
 *
 * test/schemas.test.ts parses the YAML and fails if this file drifts from it,
 * so the YAML stays the single source of truth for labels, categories and risk rules.
 */

/**
 * not_applicable mirrors the「不適用（請列原因）」column of TFDA RTF checklists: the item
 * is resolved without a document, and the reason goes in the item's notes.
 */
export type ItemStatus = "completed" | "in_progress" | "under_review" | "blocked" | "pending" | "not_applicable";
export type RiskLevel = "low" | "medium" | "high";

export const ITEM_STATUSES: readonly ItemStatus[] = [
  "pending",
  "in_progress",
  "under_review",
  "blocked",
  "completed",
  "not_applicable",
];
export const RISK_LEVELS: readonly RiskLevel[] = ["low", "medium", "high"];

export interface RiskRules {
  default: RiskLevel;
  completed?: RiskLevel;
  in_progress?: RiskLevel;
  under_review?: RiskLevel;
  blocked?: RiskLevel;
  pending?: RiskLevel;
  not_applicable?: RiskLevel;
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

/**
 * A Refuse-to-File rule from a TFDA RTF checklist: the case is refused when more than
 * max_failures of these items are「否」(neither completed nor not applicable).
 */
export interface RtfRule {
  items: string[];
  max_failures: number;
  rule: string;
}

export interface Schema {
  display_name: string;
  display_name_zh: string;
  deadline_default_days: number;
  rtf_rules?: RtfRule[];
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
          "TFDA 於收件後 42 天內對資料不齊全者發文退件（Refuse to File）；未收到退件通知即續審；屬藥事法第48條之9第4款（P4）者於第42天核發資料齊備通知〔審查流程110.10〕。",
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
          "申請新成分新藥資料專屬期者，須為國外取得上市許可後三年內向我國申請（藥事法第40條之2第4項），並於切結書（甲）聲明；經舉證不實得取消資料專屬期。",
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
          "依112.12.13 衛授食字第1121413132號公告修正之「銜接性試驗基準」準備；BSE 申請請另建「銜接性試驗評估（BSE）」案件，逐項備齊附錄E 查檢表與自我評估報告。",
          "經評估不得免除者，須送銜接性試驗計畫書，審查同意後執行並將報告送備查（審查準則第22條之1）。",
        ],
      },
      {
        key: "m1_affidavit", label: "M1 切結書（甲）（乙）", category: "module1_admin", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Sign affidavits A and B with the proposed Chinese and English product names",
        action_zh: "填妥並用印切結書（甲）（乙）",
        criteria: [
          "切結書（甲）：品名、商標、仿單、圖形、包裝或專利製造方法如與他廠重複、類似或有糾紛，依商標、專利主管機關認定或法院裁判並負法律責任；所繳品質管制紀錄及檢驗書表正確；未領證前不得擅先出售。",
          "申請新成分新藥資料專屬期者，切結書（甲）載明符合藥事法第40條之2第4項（國外取得上市許可後三年內向我國申請）。",
          "切結書（乙）：樣品經檢驗判定不合格者，依「簡化藥品查驗登記程序」接受處分。",
          "填入擬定藥品中英文品名（並列）、具切結商號用印、負責人、地址及日期。",
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
          "非臨床安全性（安全性藥理、藥動、毒理）於合適動物物種執行，樞紐性安全性試驗符合 GLP；非臨床藥理試驗足以支持療效〔審查重點110.10.27〕。",
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
          "吸收、分布、代謝、排泄資料足以釐清藥品特性；提供藥效學資訊及藥動／藥效關係〔審查重點110.10.27〕。",
          "說明是否已免除銜接性試驗，以及宣稱適應症與用法用量之藥動藥效有無種族差異〔審查重點110.10.27〕。",
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
          "長期使用藥物有足夠資料支持長期療效與安全性；用法用量合理；該適應症已有其他核准療法者，提供比較資料〔審查重點110.10.27〕。",
        ],
      },
      {
        key: "m5_statistics", label: "M5 統計：樞紐性試驗與整體療效證據力", category: "module5_clinical", required: true,
        risk_rules: { completed: "low", under_review: "medium", default: "high" },
        action: "Show adequate pivotal trials whose design, statistics and results support the claims",
        action_zh: "確認樞紐性試驗之設計、統計方法與結果足以支持宣稱",
        criteria: [
          "針對宣稱之適應症與用法用量，有合宜的樞紐性試驗〔審查重點110.10.27〕。",
          "樞紐性試驗之設計與統計方法適當〔審查重點110.10.27〕。",
          "樞紐性試驗結果能支持宣稱適應症與用法用量之療效〔審查重點110.10.27〕。",
          "整體療效證據力（Overall Evidence of Efficacy）足以支持宣稱適應症與用法用量〔審查重點110.10.27〕。",
        ],
      },
      {
        key: "m5_postmarketing", label: "上市後安全：PSUR、上市後研究、RMP 與利益風險評估", category: "module5_clinical", required: true,
        risk_rules: { completed: "low", under_review: "medium", default: "high" },
        action: "Provide PSURs, the benefit-risk assessment, and assess post-marketing studies and a risk management plan",
        action_zh: "檢附 PSUR 與利益風險評估，並評估上市後研究與風險管理計畫",
        criteria: [
          "已於國外上市者檢附上市後藥品定期安全性報告（PSUR）〔審查重點110.10.27〕。",
          "評估是否需執行上市後研究；精簡審查案件說明國外主管機關要求之 Phase IV commitment 是否比照〔審查重點110.10.27〕。",
          "評估是否需風險管理計畫（RMP）；採用證明 0 張者強制檢附 RMP（見 M1 採用證明）。",
          "提供利益風險評估（Benefit-Risk Assessment）〔審查重點110.10.27〕。",
        ],
      },
      {
        key: "label_draft", label: "中文仿單擬稿（及 RMP 草本）", category: "cross_module", required: true,
        risk_rules: { completed: "low", under_review: "medium", default: "high" },
        action: "Draft the Chinese package insert consistent with the dossier",
        action_zh: "完成與全案資料一致之中文仿單擬稿",
        criteria: [
          "中文仿單擬稿內容恰當，適應症、用法用量、特殊族群、警語與交互作用均可回溯至 CTD 資料〔審查重點110.10.27〕。",
          "新複方之特殊族群建議取個別單方中最保守者；超出單方仿單建議者須有藥動或臨床試驗支持〔RegMed 2020 Vol.115〕。",
          "TFDA 發 AL 通知或審查完成通知函時，須提供仿單或 RMP 草本（新成分新藥約第330天）〔審查流程110.10〕。",
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
      {
        key: "type_new_indication", label: "新藥類別：新療效（新適應症）", category: "nda_type", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Address the review points for a new indication",
        action_zh: "依新療效審查重點準備資料",
        criteria: [
          "CMC 與已上市藥品不同者，原料藥與製劑依新成分藥品審查〔審查重點110.10.27〕。",
          "藥理資料足以支持新療效；新用法用量超過原核准範圍者，現有非臨床與臨床資料足以支持，否則另附安全性資料〔審查重點110.10.27〕。",
          "評估新適應症族群之藥動特性（血中濃度、曝露量）與新用法用量合理性，並評估特殊族群、藥物交互作用及食物效應〔審查重點110.10.27〕。",
          "臨床資料支持新適應症與用法用量之療效、安全性及長期使用；說明種族差異、與其他核准療法之比較、PSUR 與利益風險評估〔審查重點110.10.27〕。",
        ],
      },
      {
        key: "type_new_combination", label: "新藥類別：新複方", category: "nda_type", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Address the review points for a new fixed-dose combination",
        action_zh: "依新複方審查重點準備資料",
        criteria: [
          "定義：二種以上已核准成分之複方，具有優於各該單一成分之醫療效能；含未核准新成分者依新成分新藥準備資料〔RegMed 2020 Vol.115〕。",
          "CMC：評估原料藥之間及原料藥與賦形劑之相容性；原料藥檢送技術性資料者依新成分藥品審查〔審查重點110.10.27〕。",
          "藥毒理：缺乏臨床合併使用經驗者，評估單方間交互作用及最長 90 天複方銜接性毒性試驗；毒性器官或機轉相似、近臨床暴露量有嚴重毒性或交互作用有安全疑慮者，提供最長 90 天重覆劑量毒性及／或胚胎－胎兒發育試驗；臨床常見併用且無疑慮、適應症與劑量相當者可免除〔審查重點110.10.27〕。",
          "藥動：fixed 對 free combination 之生體相等性試驗（交叉或拉丁方格設計），不得以文獻免除；食物效應原則上不得免除；單方間藥物交互作用可以文獻支持；評估特殊族群〔RegMed 2020 Vol.115〕。",
          "不同單位含量：依溶離率曲線比對取代 BE 原則（衛署藥字第0980364804號）；控釋劑型高劑量者應執行 BE〔RegMed 2020 Vol.115〕。",
          "臨床：樞紐試驗支持療效安全；說明個別單方貢獻（contribution）及優於各單方之療效；除改善順從性外具臨床與公衛價值；不同劑量均涵蓋；合乎醫療常規（第一線或後線）；族群差異與利益風險評估〔審查重點110.10.27〕。",
          "僅提供 free combination = fixed combination 之生體相等性資料，而無附加治療或起始治療之臨床試驗或文獻者，不足以支持上市〔RegMed 2020 Vol.114〕。",
        ],
      },
      {
        key: "type_new_route", label: "新藥類別：新使用途徑", category: "nda_type", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Address the review points for a new route of administration",
        action_zh: "依新使用途徑審查重點準備資料",
        criteria: [
          "CMC：原料藥晶型或粒徑影響生體可用率者須管控；注射劑管控微粒、無菌與內毒素；放寬不純物規格須說明合理性〔審查重點110.10.27〕。",
          "非臨床安全性資料支持新途徑及預期給藥間隔與期間；引用同成分資料支持全身曝露者，評估是否僅需局部組織安全性〔審查重點110.10.27〕。",
          "於最大用法用量下執行生體可用率試驗；血管內外途徑轉換時，重新評估吸收、代謝、藥物交互作用、食物效應與特殊族群；生體可用率較高者評估是否需涵蓋新曝露量之試驗〔審查重點110.10.27〕。",
          "樞紐試驗支持療效安全；說明新途徑是否伴隨新安全議題、劑量選擇合理性、族群差異及利益風險評估〔審查重點110.10.27〕。",
        ],
      },
      {
        key: "type_new_dosage_form", label: "新藥類別：新劑型（速放、控釋、奈米）", category: "nda_type", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Address the review points for a new dosage form",
        action_zh: "依新劑型審查重點準備資料",
        criteria: [
          "CMC：說明賦形劑選擇、配方與製程開發、容器封蓋系統及微生物學屬性，以支持製程與成品管制〔審查重點110.10.27〕。",
          "藥毒理：比較新劑型與已核准劑型之 Cmax、AUC 與曲線形狀，判斷是否需額外非臨床試驗；產生新不純物或使用新賦形劑者可能需安全性試驗〔審查重點110.10.27〕。",
          "奈米劑型原則上視為全新藥品：評估穿透生理障壁之標的器官、免疫毒性、凝集與血栓、局部刺激、基因毒性及胚胎毒性〔審查重點110.10.27〕。",
          "藥動：原則上提供 BE 或 BA 試驗報告，並重新評估食物效應、特殊族群與藥物交互作用〔審查重點110.10.27〕。",
          "臨床：原則上檢送與原核准劑型之 BE；無法達到 BE 者檢送樞紐試驗，原核准劑型有多個適應症者須逐一支持；控釋劑型之用法用量須能配合劑量調整與特殊族群；奈米劑型須樞紐試驗；評估 RMP 與利益風險〔審查重點110.10.27〕。",
        ],
      },
      {
        key: "type_new_dose_strength", label: "新藥類別：新使用劑量／新單位含量", category: "nda_type", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Address the review points for a new dose or strength",
        action_zh: "依新使用劑量／新單位含量審查重點準備資料",
        criteria: [
          "CMC：與已核准藥品比較原料藥規格；每日最大劑量增加而不純物超過驗證閾值者，提供安全性資料；同一分析方法用於多種含量者，評估方法確效之適用性〔審查重點110.10.27〕。",
          "藥毒理：提供已核准藥品之非臨床資訊，以藥理或藥動建立劑量與療效之關聯；安全性資料不足處另行評估或試驗〔審查重點110.10.27〕。",
          "新使用劑量：最大用法用量下之 BA；曝露量較高者重新評估藥物交互作用、食物效應與特殊族群；檢送樞紐試驗（設計比照新成分藥品）並說明劑量改變目的〔審查重點110.10.27〕。",
          "新單位含量：適應症與用法用量須與已核准藥品相同；檢送與原含量之 BE，無法達到 BE 者檢送 BA 及樞紐試驗〔審查重點110.10.27〕。",
        ],
      },
      {
        key: "type_prodrug", label: "新藥類別：前驅藥物（Prodrug）", category: "nda_type", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Address the review points for a prodrug or active metabolite",
        action_zh: "依前驅藥物審查重點準備資料",
        criteria: [
          "CMC 與藥動要求同新成分藥品，並同時評估前驅藥品與活性代謝產物之藥動資料〔審查重點110.10.27〕。",
          "欲引用已上市藥品資料減免非臨床試驗者，提供前驅藥是否具活性、人體與試驗物種間之轉換比率與時間等科學連結資料，並與法規單位討論〔審查重點110.10.27〕。",
          "前驅藥品之 in vitro hERG、基因毒性與局部耐受性為必須執行或評估之項目〔審查重點110.10.27〕。",
          "活性代謝產物已於國內核准者，說明代謝途徑、特殊族群、藥物交互作用與劑量合理性；引用既有資料須說明合理性〔審查重點110.10.27〕。",
        ],
      },
      {
        key: "type_abbreviated", label: "新藥類別：精簡審查（經 TFDA 認定）", category: "nda_type", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Address the review points for abbreviated review",
        action_zh: "依精簡審查重點準備資料",
        criteria: [
          "經本署認定之精簡審查案件，審查時程約 180 天（不含補件時間）〔審查流程110.10〕。",
          "化學藥 CMC：檢附原料藥製造廠、製程、規格與容器封蓋系統與 FDA、EMA 或 MHLW/PMDA 至少一地區相同之聲明者，原料藥審查物化性質、規格與 CoA；製劑審查藥劑發展、製程、規格與 CoA、容器封蓋系統與安定性〔審查重點110.10.27〕。",
          "藥毒理原則上認可 FDA、EMA 或 MHLW/PMDA 審查意見，須檢附藥毒理總結報告或審查意見〔審查重點110.10.27〕。",
          "已在美歐日其中兩國／區域核准者，藥動重點為東西方族群差異、配方或製程變更之連結資料，以及兩區域意見不同時之特殊族群與交互作用評估〔審查重點110.10.27〕。",
          "臨床：說明宣稱適應症與 FDA、EMA 或 MHLW/PMDA 核准適應症之差異、銜接性與種族差異、國外 Phase IV commitment、RMP、PSUR 與利益風險評估〔審查重點110.10.27〕。",
        ],
      },
    ],
  },
  dmf_rtf_full: {
    display_name: "API / DMF — RTF Checklist 1 (full technical data)",
    display_name_zh: "原料藥／DMF 查檢表一（完整技術資料）",
    deadline_default_days: 90,
    rtf_rules: [
      {
        items: ["dmf1_rtf_form", "dmf1_ctd_32s", "dmf1_language", "dmf1_single_spec", "dmf1_spec_coa", "dmf1_stability"],
        max_failures: 0,
        rule: "第1至6任一項判定為「否」者，退件。",
      },
      {
        items: ["dmf1_process", "dmf1_starting_material", "dmf1_intermediate", "dmf1_process_validation", "dmf1_method_validation"],
        max_failures: 2,
        rule: "第7至11項判定為「否」之總數≥3項，退件。",
      },
    ],
    items: [
      {
        key: "dmf1_rtf_form", label: "檢送 RTF 查檢表（110年8月版 查檢表一）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach RTF checklist 1 (Aug 2021 version) with every item self-assessed",
        action_zh: "填妥並檢附 110年8月版 RTF 查檢表一",
        criteria: [
          "適用：依102.02.21 署授食字第1021400426號「原料藥查驗登記審查技術資料查檢表」或第1021401257號「原料藥主檔案技術資料查檢表」檢齊資料之案件。",
          "本表僅供單獨申請原料藥查驗登記或 DMF；學名藥案內併送原料藥資料者，改填「學名藥查驗登記退件機制 RTF 查檢表」〔問答集 Q2、Q7〕。",
          "「業者審視情形」每項勾「是」或「不適用（列原因）」；「TFDA 審核結果」欄留白。",
          "closed part 由原廠直送時，申請商仍須勾選並檢附本表；建議將查檢項目轉知原料藥廠協助確認〔問答集 Q3、Q8〕。",
        ],
      },
      {
        key: "dmf1_ctd_32s", label: "CTD Module 3 原料藥章節 3.2.S（含 open part 與 closed part）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide the full 3.2.S section (3.2.S.1.1–3.2.S.7.3), open and closed parts",
        action_zh: "依 CTD 格式提供 3.2.S.1.1～3.2.S.7.3（open 與 closed part）",
        criteria: [
          "涵蓋 3.2.S.1.1～3.2.S.7.3，open part 與 closed part 均已提供或已安排原廠直送。",
          "TFDA 於收案日起7日內函請行政補件（closed part），須於30日內回復〔問答集 Q4〕。",
          "3.2.S.1 基本資料：化學結構（含立體結構、光學活性中心）、化學名／學名／CAS、分子式、分子量、外觀及理化性質〔98年查檢表〕。",
        ],
      },
      {
        key: "dmf1_language", label: "技術性資料為繁體中文或英文", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide technical data in Traditional Chinese or English",
        action_zh: "技術性資料以繁體中文或英文提供",
        criteria: [
          "所有技術性資料（含原廠提供之 closed part）為繁體中文或英文版本。",
        ],
      },
      {
        key: "dmf1_single_spec", label: "僅宣稱一種原料藥規格（3.2.S.4.1）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Claim a single API specification in 3.2.S.4.1",
        action_zh: "3.2.S.4.1 僅宣稱一套原料藥規格",
        criteria: [
          "一件 DMF 只核准一套規格；製程相同時可將 USP、EP 合併為一套廠規，並於核備函敘明同時符合〔問答集 Q9、Q10〕。",
          "擬登記兩種不同規格者，應分開申請兩件 DMF〔問答集 Q9〕。",
          "依藥典訂定者註明藥典名稱與版次，藥典收載之檢驗項目不得任意刪減〔98年查檢表〕。",
        ],
      },
      {
        key: "dmf1_spec_coa", label: "原料藥規格、方法及檢驗成績書（3.2.S.4.1／4.2／4.4）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide the API specification, analytical procedures and batch CoAs",
        action_zh: "檢附原料藥規格、分析方法及批次檢驗成績書",
        criteria: [
          "提供規格與允收標準、分析方法及方法依據；依藥典者仍須檢附上述資料並敘明藥典及版次，不得僅附藥典依據〔問答集 Q13〕。",
          "檢驗成績書填實測數據，不以「合格」「符合」「陰性」帶過；有效數字一致〔98年查檢表〕。",
          "不純物資料含名稱、含量及管制方式，必要時附結構、方法、數據與圖譜〔98年查檢表〕。",
        ],
      },
      {
        key: "dmf1_stability", label: "安定性試驗：三批先導性規模、6個月加速及6個月長期（3.2.S.7）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide 6-month accelerated and 6-month long-term data on three pilot-scale batches",
        action_zh: "依藥品安定性試驗基準提供三批先導性規模批次之6個月加速與6個月長期資料",
        criteria: [
          "依「藥品安定性試驗基準」：至少三批具代表性之先導性規模批次，已達6個月加速試驗及6個月長期試驗。",
          "含試驗方法與條件、安定性指標分析方法、試驗數據及推定之再驗期／儲存條件〔98年查檢表〕。",
        ],
      },
      {
        key: "dmf1_process", label: "製程描述及製程管制（3.2.S.2.2）", category: "rtf_secondary", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Describe the synthetic steps, flow chart and in-process controls",
        action_zh: "提供合成步驟、製程流程圖與製程管制",
        criteria: [
          "製程描述含合成步驟（化學合成者）與製程流程圖〔RTF 註1〕。",
          "製程管制含製程中管制、關鍵步驟與關鍵參數，及量產批量〔RTF 註1〕。",
          "反應方程式涵蓋反應條件、實際下料量、莫耳數及產率〔98年查檢表〕。",
        ],
      },
      {
        key: "dmf1_starting_material", label: "起始物資料（3.2.S.2.3）", category: "rtf_secondary", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Provide starting-material data and the justification for its selection (ICH Q11 §5)",
        action_zh: "提供起始物規格、成績書及選擇合理性（ICH Q11 Section 5）",
        criteria: [
          "參考 ICH Q11 Section 5；除規格、方法、成績書外，應說明選擇該起始物之合理性〔RTF 註2〕。",
          "僅經純化或鹽化即得原料藥之物質不接受作為起始物；非屬此者須提供或引用起始物技術性資料〔RTF 註2〕。",
          "RTF 階段僅需提供起始物資料並說明合理性，不要求資料完整性〔問答集 Q11〕。",
        ],
      },
      {
        key: "dmf1_intermediate", label: "可分離之中間體規格（3.2.S.2.4）", category: "rtf_secondary", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Provide specifications for isolated intermediates",
        action_zh: "提供可分離中間體（含關鍵、最終中間體）之規格",
        criteria: [
          "列出可分離之中間體（含關鍵中間體及最終中間體）之規格、方法及成績書〔98年查檢表〕。",
          "製程中無可分離中間體者，勾「不適用」並列原因（推論：查檢表允許「不適用」且須列原因）。",
          "中間體資料多屬 closed part，建議請原料藥廠協助確認〔問答集 Q12〕。",
        ],
      },
      {
        key: "dmf1_process_validation", label: "製程確效計畫書與報告書（3.2.S.2.5）", category: "rtf_secondary", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Provide the process validation protocol and report, or representative batch records",
        action_zh: "提供製程確效計畫書與報告書，或代表性批次製造紀錄",
        criteria: [
          "可以具代表性之批次製造紀錄代替製程確效報告書〔RTF 註3〕。",
          "製程含無菌操作或滅菌者，須另附相關確效資料〔RTF 註3〕。",
          "批次紀錄偏離規格之結果須說明並提供 CAPA〔98年查檢表〕。",
        ],
      },
      {
        key: "dmf1_method_validation", label: "原料藥分析方法確效／確認（3.2.S.4.3）", category: "rtf_secondary", required: true,
        risk_rules: { completed: "low", default: "medium" },
        action: "Provide analytical method validation (non-compendial) or verification (compendial)",
        action_zh: "非藥典方法附確效報告；藥典方法附確認報告",
        criteria: [
          "依「分析方法確效作業指導手冊」或 ICH Q2 執行〔RTF 註4〕。",
          "非依藥典者提供分析方法確效報告書；依藥典者提供分析方法確認報告書〔RTF 註4〕。",
        ],
      },
    ],
  },
  dmf_rtf_reference: {
    display_name: "API / DMF — RTF Checklist 2 (citing approved data)",
    display_name_zh: "原料藥／DMF 查檢表二（引用已核准資料）",
    deadline_default_days: 90,
    rtf_rules: [
      {
        items: ["dmf2_rtf_form", "dmf2_authorization", "dmf2_ctd_open", "dmf2_language", "dmf2_single_spec", "dmf2_spec_coa", "dmf2_stability", "dmf2_process"],
        max_failures: 0,
        rule: "應檢送 open part，第1至8任一項判定為「否」者，退件。",
      },
    ],
    items: [
      {
        key: "dmf2_rtf_form", label: "檢送 RTF 查檢表（110年8月版 查檢表二）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach RTF checklist 2 (Aug 2021 version) with every item self-assessed",
        action_zh: "填妥並檢附 110年8月版 RTF 查檢表二",
        criteria: [
          "適用：技術性資料為引用已核准之資料；除查檢表外仍須提供第2～8項 CMC 資料〔問答集 Q1〕。",
          "被引用案件原依精實送審文件（100.06.21 署授食字第1001403285號）或 CEP/COS（104.02.24 部授食字第1031413543號）簡化申請者，改用查檢表三或四〔RTF 註1〕。",
          "「業者審視情形」每項勾「是」或「不適用（列原因）」；「TFDA 審核結果」欄留白。",
        ],
      },
      {
        key: "dmf2_authorization", label: "效期內 DMF 號碼或核備函、原廠授權書及製程無變更聲明函", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the valid DMF number or acceptance letter, the manufacturer's letter of authorization and no-change declaration",
        action_zh: "檢附效期內 DMF 號碼／核備函、原料藥製造廠授權書與製程無變更聲明函",
        criteria: [
          "DMF 號碼或核備函在效期內。",
          "授權書與製程無變更聲明函由原料藥製造廠出具。",
          "製程曾變更者，檢附變更備查函。",
        ],
      },
      {
        key: "dmf2_ctd_open", label: "CTD Module 3 原料藥章節 3.2.S（open part）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide the 3.2.S open part (3.2.S.1.1–3.2.S.7.3)",
        action_zh: "提供 3.2.S.1.1～3.2.S.7.3 之 open part",
        criteria: [
          "涵蓋 3.2.S.1.1～3.2.S.7.3 之 open part。",
        ],
      },
      {
        key: "dmf2_language", label: "技術性資料為繁體中文或英文", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide technical data in Traditional Chinese or English",
        action_zh: "技術性資料以繁體中文或英文提供",
        criteria: [
          "所有技術性資料為繁體中文或英文版本。",
        ],
      },
      {
        key: "dmf2_single_spec", label: "僅宣稱一種原料藥規格（3.2.S.4.1）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Claim a single API specification in 3.2.S.4.1",
        action_zh: "3.2.S.4.1 僅宣稱一套原料藥規格",
        criteria: [
          "一件 DMF 只核准一套規格；USP、EP 可合併為一套廠規〔問答集 Q9、Q10〕。",
        ],
      },
      {
        key: "dmf2_spec_coa", label: "原料藥規格、方法及檢驗成績書（3.2.S.4.1／4.2／4.4）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide the API specification, analytical procedures and batch CoAs",
        action_zh: "檢附原料藥規格、分析方法及批次檢驗成績書",
        criteria: [
          "提供規格與允收標準、分析方法及依據；依藥典者敘明藥典及版次〔問答集 Q13〕。",
          "檢驗成績書填實測數據〔98年查檢表〕。",
        ],
      },
      {
        key: "dmf2_stability", label: "安定性試驗：三批先導性規模、6個月加速及6個月長期（3.2.S.7）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide 6-month accelerated and 6-month long-term data on three pilot-scale batches",
        action_zh: "依藥品安定性試驗基準提供三批先導性規模批次之6個月加速與6個月長期資料",
        criteria: [
          "依「藥品安定性試驗基準」：至少三批具代表性之先導性規模批次，已達6個月加速及6個月長期試驗。",
        ],
      },
      {
        key: "dmf2_process", label: "製程描述及製程管制（3.2.S.2.2）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Describe at least the synthetic steps and manufacturing flow chart",
        action_zh: "至少提供合成步驟（化學合成圖）與製造流程圖",
        criteria: [
          "製程描述至少包括合成步驟（化學合成圖）與製造流程圖〔RTF 註2〕。",
        ],
      },
    ],
  },
  dmf_rtf_lean: {
    display_name: "API / DMF — RTF Checklist 3 (lean submission, reference-country approval)",
    display_name_zh: "原料藥／DMF 查檢表三（精實送審）",
    deadline_default_days: 90,
    rtf_rules: [
      {
        items: ["dmf3_rtf_form", "dmf3_official_approval", "dmf3_language", "dmf3_starting_material", "dmf3_route", "dmf3_reagents", "dmf3_spec_coa", "dmf3_stability"],
        max_failures: 0,
        rule: "第1至8任一項判定為「否」者，退件。",
      },
    ],
    items: [
      {
        key: "dmf3_rtf_form", label: "檢送 RTF 查檢表（110年8月版 查檢表三）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach RTF checklist 3 (Aug 2021 version) with every item self-assessed",
        action_zh: "填妥並檢附 110年8月版 RTF 查檢表三",
        criteria: [
          "適用：依100.06.21 署授食字第1001403285號「原料藥主檔案精實送審文件」公告檢附資料之案件。",
          "「業者審視情形」每項勾「是」或「不適用（列原因）」；「TFDA 審核結果」欄留白。",
        ],
      },
      {
        key: "dmf3_official_approval", label: "官方核准證明（美國 FDA、EDQM、EMA、PMDA 或十大醫藥先進國家）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide official evidence of approval by FDA, EDQM, EMA, PMDA or a reference country",
        action_zh: "檢附官方核准證明文件",
        criteria: [
          "證明該原料藥已經美國 FDA、歐洲 EDQM、歐盟 EMA、日本 PMDA 或藥品查驗登記審查準則所稱之十大醫藥先進國家審查通過，或已有十大醫藥先進國家上市製劑使用該原料藥。",
          "證明文件須為官方核准文件。",
        ],
      },
      {
        key: "dmf3_language", label: "技術性資料為繁體中文或英文", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide technical data in Traditional Chinese or English",
        action_zh: "技術性資料以繁體中文或英文提供",
        criteria: [
          "所有技術性資料為繁體中文或英文版本。",
        ],
      },
      {
        key: "dmf3_starting_material", label: "起始物質資料：來源、規格、檢驗成績書（3.2.S.2.3）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide starting-material source, specification and CoA",
        action_zh: "提供起始物質之來源、規格及檢驗成績書",
        criteria: [
          "包含起始物質之來源、規格及檢驗成績書。",
        ],
      },
      {
        key: "dmf3_route", label: "反應步驟及流程圖，敘明產率、下料量（3.2.S.2.2）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide reaction steps and flow chart with yields and charge quantities",
        action_zh: "提供反應步驟與流程圖並敘明產率、下料量",
        criteria: [
          "反應步驟及流程圖完整，並敘明各步驟產率與下料量。",
        ],
      },
      {
        key: "dmf3_reagents", label: "反應途徑使用之有機溶劑、催化劑、試劑等（3.2.S.2.3）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "List the solvents, catalysts and reagents used in the route",
        action_zh: "列出反應途徑中使用之有機溶劑、催化劑與試劑",
        criteria: [
          "列出反應途徑中使用之各種有機溶劑、催化劑、試劑等參與物。",
        ],
      },
      {
        key: "dmf3_spec_coa", label: "原料藥及中間體之規格、方法及成績書（3.2.S.2.4／4.1／4.2／4.4）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide specifications, methods and CoAs for the API and intermediates",
        action_zh: "提供原料藥（成品）及中間體之規格、方法與成績書",
        criteria: [
          "原料藥（成品）及中間體均附檢驗規格、方法及成績書。",
          "依藥典者敘明藥典及版次，並附規格與方法本身〔問答集 Q13〕。",
        ],
      },
      {
        key: "dmf3_stability", label: "安定性試驗條件及結果（3.2.S.7）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide 6-month accelerated and 6-month long-term data on three pilot-scale batches",
        action_zh: "依藥品安定性試驗基準提供三批先導性規模批次之6個月加速與6個月長期資料",
        criteria: [
          "依「藥品安定性試驗基準」：至少三批具代表性之先導性規模批次，已達6個月加速及6個月長期試驗〔RTF 查檢表三註〕。",
        ],
      },
    ],
  },
  dmf_rtf_cep: {
    display_name: "API / DMF — RTF Checklist 4 (EDQM CEP/COS, simplified data)",
    display_name_zh: "原料藥／DMF 查檢表四（具 EDQM CEP/COS）",
    deadline_default_days: 90,
    rtf_rules: [
      {
        items: ["dmf4_rtf_form", "dmf4_cep", "dmf4_language", "dmf4_coa", "dmf4_route"],
        max_failures: 0,
        rule: "第1至5任一項判定為「否」者，退件。",
      },
    ],
    items: [
      {
        key: "dmf4_rtf_form", label: "檢送 RTF 查檢表（110年8月版 查檢表四）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach RTF checklist 4 (Aug 2021 version) with every item self-assessed",
        action_zh: "填妥並檢附 110年8月版 RTF 查檢表四",
        criteria: [
          "適用：依104.02.24 部授食字第1031413543號「具EDQM之CEP/COS」公告檢附簡化技術性資料之案件。",
          "無菌、生物性、發酵或植物性之原料藥不適用本表，應改用查檢表一。",
          "「業者審視情形」每項勾「是」或「不適用（列原因）」；「TFDA 審核結果」欄留白。",
        ],
      },
      {
        key: "dmf4_cep", label: "CEP/COS 證書、同意 TFDA 參考 CEP/COS 審查資料之授權書及無變更聲明書", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the CEP/COS, the letter authorizing TFDA to reference it, and the no-change declaration",
        action_zh: "檢附 CEP/COS 證書、授權書與無變更聲明書",
        criteria: [
          "CEP/COS 證書為現行有效版本。",
          "授權書載明同意衛福部食品藥物管理署參考 CEP/COS 審查資料。",
          "附無變更聲明書。",
        ],
      },
      {
        key: "dmf4_language", label: "技術性資料為繁體中文或英文", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide technical data in Traditional Chinese or English",
        action_zh: "技術性資料以繁體中文或英文提供",
        criteria: [
          "所有技術性資料為繁體中文或英文版本。",
        ],
      },
      {
        key: "dmf4_coa", label: "檢驗成績書（至少三批次）", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach certificates of analysis for at least three batches",
        action_zh: "檢附至少三批次之檢驗成績書",
        criteria: [
          "至少三批次之檢驗成績書，檢驗項目與 CEP 核准規格一致（推論：以 CEP 為簡化依據）。",
        ],
      },
      {
        key: "dmf4_route", label: "EDQM 審查通過之現行合成步驟或製程", category: "rtf_gate", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide the current synthetic route or process as approved by EDQM",
        action_zh: "提供 EDQM 審查通過之現行合成步驟或製程",
        criteria: [
          "合成步驟或製程與 EDQM 審查通過之現行版本一致。",
        ],
      },
    ],
  },
  pmf_nonsterile_full: {
    display_name: "Foreign plant PMF — Non-sterile products (incl. packaging), full review",
    display_name_zh: "國外藥廠 PMF：非無菌產品（含包裝作業）－全套審查",
    deadline_default_days: 90,
    items: [
      {
        key: "pmf_a_form", label: "表A 申請國外藥廠工廠資料（PMF）審查送審表", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete Form A with the dosage forms, scope and review route",
        action_zh: "填妥表A 申請內容與申請方式",
        criteria: [
          "使用「國外藥廠工廠資料準備須知」表A（115.04.27 衛授食字第1151102225號函公告，表A 修訂日期113.05.24）〔準備須知115.04.27〕。",
          "填妥申請日期、申請藥商名稱與販賣業藥商許可執照編號、承辦人及聯絡方式，以及製造廠國別、廠名與廠址。",
          "申請內容依「西藥製造許可及GMP核定項目與作業內容之藥品劑型分類原則」完整填寫，例如「固體劑型：著衣錠（不含特定毒性及危害物質）」。",
          "每案限單一廠址、最多3個劑型／品項／作業內容；勾選本次申請範圍（不含特定毒性及危害物質，或青黴素類、頭孢子菌素、女性荷爾蒙類、細胞毒類等）。",
          "申請方式勾選（全套／簡化／確效替代／引用）與實際檢送資料一致。",
          "製造廠位於 PIC/S 會員國境內；非 PIC/S 會員國境內藥廠一律採國外實地查廠，MRA／MOU 範圍內藥廠依本署相關公告減免文件。",
        ],
      },
      {
        key: "pmf_a_fee", label: "表A 審查費", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Pay the review fee",
        action_zh: "繳納審查費",
        criteria: [
          "依最新版「西藥查驗登記審查費收費標準」繳費；罕藥依「罕見疾病藥物查驗登記審查費收費標準」，且每個申請內容須附罕藥證明文件。",
          "每案最多3個劑型／品項／作業內容（即每案限增加二個）；案件經審查後審查費不予退費。",
          "補繳費時間併入廠商補件之90天期限〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_checklist", label: "表B 申請送審資料查檢表（逐項 Y／N／NA）", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Self-check every Form B item",
        action_zh: "逐項自我檢核表B",
        criteria: [
          "表B 各查檢項目逐項勾選 Y／N／NA，審查員審核欄留白；0. 來函視個案需求檢附。",
          "9. 資料格式符合準備須知：以線上申請平台送件為原則，正本留存於製造許可持有者處；電子文件可閱讀、可辨識且內容真實〔準備須知115.04.27〕。",
          "非英文之外文文件附中文或英文翻譯並確認正確；文件有工廠品保及各相關負責人簽名。",
          "倘檢附文件不實涉及刑事責任者，依刑法第214條移送司法機關。",
          "補件期限90天，以最後一次自行補件日結算；申復案不得補件或展延〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_site", label: "表B-1 單一廠址與廠名廠址一致性", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Match the site name and address to the latest local GMP certificate",
        action_zh: "核對廠名廠址與最新 GMP 證明一致",
        criteria: [
          "每案限申請單一廠址之製造工廠。",
          "表A 所填廠名與廠址，與當地衛生主管機關最新核發之 GMP 證明文件（或當地主管機關官網登記資訊）一致，並附佐證文件。",
        ],
      },
      {
        key: "pmf_b_cforms", label: "表B-2 國外藥廠工廠資料查核表（表C）之填寫與簽署", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete and sign the Form C checklists with page references",
        action_zh: "填寫並簽署表C，標註頁碼",
        criteria: [
          "表C 依申請劑型、品項、作業內容填寫，並一併檢附查核表所要求之資料與文件。",
          "查核表填寫完整，並有代理商或原廠品保／相關人員簽名正本或數位簽章正本電子檔（含簽署日期）。",
          "於表中註明各審查項目所對應送審資料之頁碼或附件；文件排列編碼標示清楚、能與表C 對應〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_auth", label: "表B-3 原廠授權函", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the manufacturer's letter of authorization",
        action_zh: "檢附原廠授權函正本",
        criteria: [
          "原廠授權送審藥商申請 PMF 審查之授權函正本或數位簽章正本電子檔；每案必備，內容要正確。",
        ],
      },
      {
        key: "pmf_b_legalization", label: "表B-4／表C-1 1.3 簽證文件", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide legalized GMP evidence per Article 5(2)",
        action_zh: "依檢查辦法第5條第2項檢送簽證文件",
        criteria: [
          "依「藥物製造業者檢查辦法」第5條第2項擇一檢送：(1) PMF 或 SMF 經出產國最高衛生主管機關或商會簽證；(2) 出產國最高衛生主管機關出具之 GMP 證明正本，或影本加簽證正本；(3) 載明符合當地 GMP 之產品製售證明正本，或影本加簽證正本。",
          "前述正本已送本部其他案件者，得附整份影本並說明正本所送案件案號。",
          "出產國不再出具實體 GMP 證明或屬委託製造者，依105.10.17 FDA風字第1051105400號函，檢送「國外藥品許可證持有者說明函」及十大先進國、EMA 及委託者所在國最高衛生主管機關出具之產品製售證明。",
          "電子化 GMP 或 CPP 須附可驗證之網址連結；出產國為德國者，證明文件得由邦政府衛生主管機關出具〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_smf", label: "表B-5 工廠基本資料（SMF）最新版", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the latest Site Master File",
        action_zh: "檢附最新版 SMF",
        criteria: [
          "內容參照「製藥工廠基本資料（Site Master File）製備說明」（100.05.02 署授食字第1001100562號函）；非依該格式者，由代理商依 SMF 章節依序排列原製造廠資料。",
          "最新版中文或英文電子檔（或紙本）；每案必備。",
        ],
      },
      {
        key: "c1_name_address", label: "表C-1 *1.1 廠名、*1.2 廠址", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.1 廠名、*1.2 廠址",
        action_zh: "備妥表C-1 *1.1 廠名、*1.2 廠址",
        criteria: [
          "廠名與官方證明文件一致。",
          "廠址正確詳細且與官方證明文件一致；通訊地址與廠址不同時另行註明。",
        ],
      },
      {
        key: "c1_scope", label: "表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        action_zh: "備妥表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        criteria: [
          "由國內藥商填寫，並註明申請之製程階段。",
        ],
      },
      {
        key: "c1_special_scope", label: "表C-1 *1.4.2 申請劑型是否含特殊類別產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        action_zh: "備妥表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        criteria: [
          "說明是否限定或包含生物藥品、高致敏性、高活性、有毒或有害物質，例如 β-lactam（青黴素、頭孢子菌素、Penems、Carbacephem、Monobactams）、荷爾蒙（含性荷爾蒙、一般荷爾蒙）、Cytotoxic／Cytostatic 及放射性藥品。",
        ],
      },
      {
        key: "c1_phasing", label: "表C-1 *1.4.3 全程或分段生產、委外檢驗", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.3 全程或分段生產、委外檢驗",
        action_zh: "備妥表C-1 *1.4.3 全程或分段生產、委外檢驗",
        criteria: [
          "說明申請劑型之製造及檢驗為全程或分段；分段生產或委外檢驗者，分別說明廠內執行階段。",
        ],
      },
      {
        key: "c1_layout", label: "表C-1 *1.4.4 生產區平面圖", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.4 生產區平面圖",
        action_zh: "備妥表C-1 *1.4.4 生產區平面圖",
        criteria: [
          "由秤量至包裝作業，涵蓋人流、物流、空氣流向／壓差及潔淨度，並標示本次申請劑型所在區域。",
          "檢送申請劑型所有相關區域（含跨棟作業）之平面圖，例如膠囊劑涉及 A、D 兩棟者兩棟都要附〔113年研討會〕。",
        ],
      },
      {
        key: "c1_existing_approval", label: "表C-1 1.5 國內已核准劑型或引用之核准函", category: "pmf_form_c1", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Prepare 表C-1 1.5 國內已核准劑型或引用之核准函",
        action_zh: "備妥表C-1 1.5 國內已核准劑型或引用之核准函",
        criteria: [
          "申請商已持有該製造廠經本部核准之證明文件者，檢附影本。",
          "申請引用者，填寫引用之核准函劑型，並附該劑型及作業內容經本部核准之證明文件。",
        ],
      },
      {
        key: "c1_site_overview", label: "表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        action_zh: "備妥表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        criteria: [
          "1.6.1 簡述廠地面積、位置與周邊環境。",
          "*1.6.2 檢附全廠平面圖，說明各棟建築與各樓層用途，並標示本次申請劑型所在廠房與樓層。",
          "1.6.3 說明全廠委受託活動及合約。",
        ],
      },
      {
        key: "c1_local_license", label: "表C-1 1.7 出產國主管機關核准之藥廠作業項目", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 1.7 出產國主管機關核准之藥廠作業項目",
        action_zh: "備妥表C-1 1.7 出產國主管機關核准之藥廠作業項目",
        criteria: [
          "檢附官方文件影本，核准作業項目涵蓋本次申請劑型。",
        ],
      },
      {
        key: "c1_product_list", label: "表C-1 *1.8.1 全廠生產產品清單", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.1 全廠生產產品清單",
        action_zh: "備妥表C-1 *1.8.1 全廠生產產品清單",
        criteria: [
          "依劑型列出全廠製造及分包裝之各類產品（人用西藥、人用研究用藥品、動物用藥、醫療器材、化粧品、食品、草藥等），標示類別、主成分與生產廠房編號；屬1.8.2.1特殊產品者另註明。",
          "原廠資料非依劑型排列者，由代理商依劑型整理。",
        ],
      },
      {
        key: "c1_special_products", label: "表C-1 *1.8.2 廠內特殊產品與交叉汙染防止", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        action_zh: "備妥表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        criteria: [
          "勾選廠內生產之特殊產品類別（青黴素類、頭孢子菌素類、Penems、Carbacephem、Monobactams、Estrogen、性荷爾蒙、一般荷爾蒙（含固醇類）、具荷爾蒙活性產品、Cytotoxic、Cytostatic、生物藥品、放射線藥品等）並說明劑型；由代理商填寫者附原廠說明函正本。",
          "說明生產配置（獨立廠房、獨立生產區、共用生產區專用設備或共用設施設備），並於平面圖標示。",
          "共用生產區專用設備或共用設施設備者，附依品質風險管理（含 HBEL-PDE／ADE 效價與毒理評估）之交叉汙染防止措施說明或評估報告、有效性定期評估，以及清潔確效摘要（群組方式須說明分組、各組主成分及指標成分）。",
          "廠內未生產特殊產品者（1.8.2 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "c1_non_medicinal", label: "表C-1 *1.8.3 兼製非人用藥品或其他產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.3 兼製非人用藥品或其他產品",
        action_zh: "備妥表C-1 *1.8.3 兼製非人用藥品或其他產品",
        criteria: [
          "勾選兼製之動物用藥（人體可用／不可用）、食品、化粧品、醫療器材（藥典／非藥典成分）、草藥、順勢藥物、一般商品、飼料，並說明種類、劑型、組成與是否為人體可用成分，附佐證；代理商填寫者附原廠說明函正本。",
          "說明生產配置並於平面圖標示。",
          "共用生產區專用設備者：說明主成分是否為藥典收載（附依據）、是否採 PIC/S GMP（原廠聲明函），以及依品質風險管理之交叉汙染防止措施與定期評估。",
          "共用設施設備者：說明主成分是否為藥典收載或可作為藥品成分、交叉汙染防止措施；兼製非人體可用之動物用藥者，另附含 HBEL-PDE／ADE 毒理資料之風險評估，並列出共用設備清單與清潔確效摘要。",
          "未兼製者（1.8.3 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "pmf_c3", label: "表C-3 全套審查查核表（所有產品）", category: "pmf_form_c", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-3 全套審查查核表（所有產品）",
        action_zh: "備妥表C-3 全套審查查核表（所有產品）",
        criteria: [
          "依表C-3 逐欄填寫並檢附資料。",
          "無菌產品依 PIC/S GMP Annex 1 增修內容填寫（品質風險管理、CCS、RABS／隔離裝置）〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_c5", label: "表C-5 確效及驗證作業", category: "pmf_form_c", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-5 確效及驗證作業",
        action_zh: "備妥表C-5 確效及驗證作業",
        criteria: [
          "依表C-5 逐欄填寫並檢附確效及驗證資料。",
          "新版依 PIC/S GMP Annex 1 增修：品質風險管理（Annex 20）、汙染管制策略（CCS）之執行與定期評估〔113年研討會〕。",
          "以確效替代三文件減免者，本項標記「不適用」並寫明「採確效替代」。",
        ],
      },
      {
        key: "val_alternative", label: "確效替代三文件（減免表C-5）", category: "pmf_mode", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Prepare 確效替代三文件（減免表C-5）",
        action_zh: "備妥確效替代三文件（減免表C-5）",
        criteria: [
          "十大先進國或 EMA 核發之產品製售證明（CPP）正本或影本，於2年有效期限內。",
          "確效及驗證摘要說明：經廠內權責人員簽署之正本或數位簽章電子文件，涵蓋支援系統（空調、水及製程中氣體）確效、設施設備驗證、電腦化系統確效及清潔確效。",
          "原廠說明函：經廠內權責人員簽署之正本或數位簽章電子文件，載明認知本部有查廠之完全權力，必要時依國際慣例查廠。",
          "未採確效替代者，本項標記「不適用」並寫明原因。",
        ],
      },
    ],
  },
  pmf_nonsterile_simplified: {
    display_name: "Foreign plant PMF — Non-sterile products (incl. packaging), simplified review",
    display_name_zh: "國外藥廠 PMF：非無菌產品（含包裝作業）－簡化審查",
    deadline_default_days: 90,
    items: [
      {
        key: "pmf_a_form", label: "表A 申請國外藥廠工廠資料（PMF）審查送審表", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete Form A with the dosage forms, scope and review route",
        action_zh: "填妥表A 申請內容與申請方式",
        criteria: [
          "使用「國外藥廠工廠資料準備須知」表A（115.04.27 衛授食字第1151102225號函公告，表A 修訂日期113.05.24）〔準備須知115.04.27〕。",
          "填妥申請日期、申請藥商名稱與販賣業藥商許可執照編號、承辦人及聯絡方式，以及製造廠國別、廠名與廠址。",
          "申請內容依「西藥製造許可及GMP核定項目與作業內容之藥品劑型分類原則」完整填寫，例如「固體劑型：著衣錠（不含特定毒性及危害物質）」。",
          "每案限單一廠址、最多3個劑型／品項／作業內容；勾選本次申請範圍（不含特定毒性及危害物質，或青黴素類、頭孢子菌素、女性荷爾蒙類、細胞毒類等）。",
          "申請方式勾選（全套／簡化／確效替代／引用）與實際檢送資料一致。",
          "製造廠位於 PIC/S 會員國境內；非 PIC/S 會員國境內藥廠一律採國外實地查廠，MRA／MOU 範圍內藥廠依本署相關公告減免文件。",
        ],
      },
      {
        key: "pmf_a_fee", label: "表A 審查費", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Pay the review fee",
        action_zh: "繳納審查費",
        criteria: [
          "依最新版「西藥查驗登記審查費收費標準」繳費；罕藥依「罕見疾病藥物查驗登記審查費收費標準」，且每個申請內容須附罕藥證明文件。",
          "每案最多3個劑型／品項／作業內容（即每案限增加二個）；案件經審查後審查費不予退費。",
          "補繳費時間併入廠商補件之90天期限〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_checklist", label: "表B 申請送審資料查檢表（逐項 Y／N／NA）", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Self-check every Form B item",
        action_zh: "逐項自我檢核表B",
        criteria: [
          "表B 各查檢項目逐項勾選 Y／N／NA，審查員審核欄留白；0. 來函視個案需求檢附。",
          "9. 資料格式符合準備須知：以線上申請平台送件為原則，正本留存於製造許可持有者處；電子文件可閱讀、可辨識且內容真實〔準備須知115.04.27〕。",
          "非英文之外文文件附中文或英文翻譯並確認正確；文件有工廠品保及各相關負責人簽名。",
          "倘檢附文件不實涉及刑事責任者，依刑法第214條移送司法機關。",
          "補件期限90天，以最後一次自行補件日結算；申復案不得補件或展延〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_site", label: "表B-1 單一廠址與廠名廠址一致性", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Match the site name and address to the latest local GMP certificate",
        action_zh: "核對廠名廠址與最新 GMP 證明一致",
        criteria: [
          "每案限申請單一廠址之製造工廠。",
          "表A 所填廠名與廠址，與當地衛生主管機關最新核發之 GMP 證明文件（或當地主管機關官網登記資訊）一致，並附佐證文件。",
        ],
      },
      {
        key: "pmf_b_cforms", label: "表B-2 國外藥廠工廠資料查核表（表C）之填寫與簽署", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete and sign the Form C checklists with page references",
        action_zh: "填寫並簽署表C，標註頁碼",
        criteria: [
          "表C 依申請劑型、品項、作業內容填寫，並一併檢附查核表所要求之資料與文件。",
          "查核表填寫完整，並有代理商或原廠品保／相關人員簽名正本或數位簽章正本電子檔（含簽署日期）。",
          "於表中註明各審查項目所對應送審資料之頁碼或附件；文件排列編碼標示清楚、能與表C 對應〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_auth", label: "表B-3 原廠授權函", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the manufacturer's letter of authorization",
        action_zh: "檢附原廠授權函正本",
        criteria: [
          "原廠授權送審藥商申請 PMF 審查之授權函正本或數位簽章正本電子檔；每案必備，內容要正確。",
        ],
      },
      {
        key: "pmf_b_legalization", label: "表B-4／表C-1 1.3 簽證文件", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide legalized GMP evidence per Article 5(2)",
        action_zh: "依檢查辦法第5條第2項檢送簽證文件",
        criteria: [
          "依「藥物製造業者檢查辦法」第5條第2項擇一檢送：(1) PMF 或 SMF 經出產國最高衛生主管機關或商會簽證；(2) 出產國最高衛生主管機關出具之 GMP 證明正本，或影本加簽證正本；(3) 載明符合當地 GMP 之產品製售證明正本，或影本加簽證正本。",
          "前述正本已送本部其他案件者，得附整份影本並說明正本所送案件案號。",
          "出產國不再出具實體 GMP 證明或屬委託製造者，依105.10.17 FDA風字第1051105400號函，檢送「國外藥品許可證持有者說明函」及十大先進國、EMA 及委託者所在國最高衛生主管機關出具之產品製售證明。",
          "電子化 GMP 或 CPP 須附可驗證之網址連結；出產國為德國者，證明文件得由邦政府衛生主管機關出具〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_smf", label: "表B-5 工廠基本資料（SMF）最新版", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the latest Site Master File",
        action_zh: "檢附最新版 SMF",
        criteria: [
          "內容參照「製藥工廠基本資料（Site Master File）製備說明」（100.05.02 署授食字第1001100562號函）；非依該格式者，由代理商依 SMF 章節依序排列原製造廠資料。",
          "最新版中文或英文電子檔（或紙本）；每案必備。",
        ],
      },
      {
        key: "c1_name_address", label: "表C-1 *1.1 廠名、*1.2 廠址", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.1 廠名、*1.2 廠址",
        action_zh: "備妥表C-1 *1.1 廠名、*1.2 廠址",
        criteria: [
          "廠名與官方證明文件一致。",
          "廠址正確詳細且與官方證明文件一致；通訊地址與廠址不同時另行註明。",
        ],
      },
      {
        key: "c1_scope", label: "表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        action_zh: "備妥表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        criteria: [
          "由國內藥商填寫，並註明申請之製程階段。",
        ],
      },
      {
        key: "c1_special_scope", label: "表C-1 *1.4.2 申請劑型是否含特殊類別產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        action_zh: "備妥表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        criteria: [
          "說明是否限定或包含生物藥品、高致敏性、高活性、有毒或有害物質，例如 β-lactam（青黴素、頭孢子菌素、Penems、Carbacephem、Monobactams）、荷爾蒙（含性荷爾蒙、一般荷爾蒙）、Cytotoxic／Cytostatic 及放射性藥品。",
        ],
      },
      {
        key: "c1_phasing", label: "表C-1 *1.4.3 全程或分段生產、委外檢驗", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.3 全程或分段生產、委外檢驗",
        action_zh: "備妥表C-1 *1.4.3 全程或分段生產、委外檢驗",
        criteria: [
          "說明申請劑型之製造及檢驗為全程或分段；分段生產或委外檢驗者，分別說明廠內執行階段。",
          "申請非無菌產品（不含包裝作業）簡化審查者，檢附申請劑型／作業內容之作業流程圖（表A 註5）。",
        ],
      },
      {
        key: "c1_layout", label: "表C-1 *1.4.4 生產區平面圖", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.4 生產區平面圖",
        action_zh: "備妥表C-1 *1.4.4 生產區平面圖",
        criteria: [
          "由秤量至包裝作業，涵蓋人流、物流、空氣流向／壓差及潔淨度，並標示本次申請劑型所在區域。",
          "檢送申請劑型所有相關區域（含跨棟作業）之平面圖，例如膠囊劑涉及 A、D 兩棟者兩棟都要附〔113年研討會〕。",
        ],
      },
      {
        key: "c1_existing_approval", label: "表C-1 1.5 國內已核准劑型或引用之核准函", category: "pmf_form_c1", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Prepare 表C-1 1.5 國內已核准劑型或引用之核准函",
        action_zh: "備妥表C-1 1.5 國內已核准劑型或引用之核准函",
        criteria: [
          "申請商已持有該製造廠經本部核准之證明文件者，檢附影本。",
          "申請引用者，填寫引用之核准函劑型，並附該劑型及作業內容經本部核准之證明文件。",
        ],
      },
      {
        key: "c1_site_overview", label: "表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        action_zh: "備妥表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        criteria: [
          "1.6.1 簡述廠地面積、位置與周邊環境。",
          "*1.6.2 檢附全廠平面圖，說明各棟建築與各樓層用途，並標示本次申請劑型所在廠房與樓層。",
          "1.6.3 說明全廠委受託活動及合約。",
        ],
      },
      {
        key: "c1_local_license", label: "表C-1 1.7 出產國主管機關核准之藥廠作業項目", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 1.7 出產國主管機關核准之藥廠作業項目",
        action_zh: "備妥表C-1 1.7 出產國主管機關核准之藥廠作業項目",
        criteria: [
          "檢附官方文件影本，核准作業項目涵蓋本次申請劑型。",
        ],
      },
      {
        key: "c1_product_list", label: "表C-1 *1.8.1 全廠生產產品清單", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.1 全廠生產產品清單",
        action_zh: "備妥表C-1 *1.8.1 全廠生產產品清單",
        criteria: [
          "依劑型列出全廠製造及分包裝之各類產品（人用西藥、人用研究用藥品、動物用藥、醫療器材、化粧品、食品、草藥等），標示類別、主成分與生產廠房編號；屬1.8.2.1特殊產品者另註明。",
          "原廠資料非依劑型排列者，由代理商依劑型整理。",
        ],
      },
      {
        key: "c1_special_products", label: "表C-1 *1.8.2 廠內特殊產品與交叉汙染防止", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        action_zh: "備妥表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        criteria: [
          "勾選廠內生產之特殊產品類別（青黴素類、頭孢子菌素類、Penems、Carbacephem、Monobactams、Estrogen、性荷爾蒙、一般荷爾蒙（含固醇類）、具荷爾蒙活性產品、Cytotoxic、Cytostatic、生物藥品、放射線藥品等）並說明劑型；由代理商填寫者附原廠說明函正本。",
          "說明生產配置（獨立廠房、獨立生產區、共用生產區專用設備或共用設施設備），並於平面圖標示。",
          "共用生產區專用設備或共用設施設備者，附依品質風險管理（含 HBEL-PDE／ADE 效價與毒理評估）之交叉汙染防止措施說明或評估報告、有效性定期評估，以及清潔確效摘要（群組方式須說明分組、各組主成分及指標成分）。",
          "廠內未生產特殊產品者（1.8.2 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "c1_non_medicinal", label: "表C-1 *1.8.3 兼製非人用藥品或其他產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.3 兼製非人用藥品或其他產品",
        action_zh: "備妥表C-1 *1.8.3 兼製非人用藥品或其他產品",
        criteria: [
          "勾選兼製之動物用藥（人體可用／不可用）、食品、化粧品、醫療器材（藥典／非藥典成分）、草藥、順勢藥物、一般商品、飼料，並說明種類、劑型、組成與是否為人體可用成分，附佐證；代理商填寫者附原廠說明函正本。",
          "說明生產配置並於平面圖標示。",
          "共用生產區專用設備者：說明主成分是否為藥典收載（附依據）、是否採 PIC/S GMP（原廠聲明函），以及依品質風險管理之交叉汙染防止措施與定期評估。",
          "共用設施設備者：說明主成分是否為藥典收載或可作為藥品成分、交叉汙染防止措施；兼製非人體可用之動物用藥者，另附含 HBEL-PDE／ADE 毒理資料之風險評估，並列出共用設備清單與清潔確效摘要。",
          "未兼製者（1.8.3 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "sim_inspection_list", label: "簡化文件1：最近5年 GMP 查核清單", category: "pmf_mode", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 簡化文件1：最近5年 GMP 查核清單",
        action_zh: "備妥簡化文件1：最近5年 GMP 查核清單",
        criteria: [
          "列出最近5年接受當地及外國衛生主管機關之 GMP 查核，至少包括查核日期、查核主題與範疇。",
        ],
      },
      {
        key: "sim_inspection_report", label: "簡化文件2：最近一次當地主管機關實地查核報告及通過證明", category: "pmf_mode", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 簡化文件2：最近一次當地主管機關實地查核報告及通過證明",
        action_zh: "備妥簡化文件2：最近一次當地主管機關實地查核報告及通過證明",
        criteria: [
          "為最近一次接受當地衛生主管機關 GMP 實地查核之查廠報告，查核範圍涵蓋 PMF 申請劑型或作業內容。",
          "附原文查廠報告，及中文或英文之全文翻譯。",
          "附當次查廠通過之證明文件（如 GMP certificate）。",
        ],
      },
      {
        key: "sim_major_changes", label: "簡化文件3：查廠後至送件日之重大變更清單", category: "pmf_mode", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 簡化文件3：查廠後至送件日之重大變更清單",
        action_zh: "備妥簡化文件3：查廠後至送件日之重大變更清單",
        criteria: [
          "列出該次查廠至本案送件日期間，申請劑型／作業內容之重大變更事項（含廠房、設施、設備、製程）。",
        ],
      },
    ],
  },
  pmf_sterile_full: {
    display_name: "Foreign plant PMF — Sterile products, full review",
    display_name_zh: "國外藥廠 PMF：無菌產品－全套審查",
    deadline_default_days: 90,
    items: [
      {
        key: "pmf_a_form", label: "表A 申請國外藥廠工廠資料（PMF）審查送審表", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete Form A with the dosage forms, scope and review route",
        action_zh: "填妥表A 申請內容與申請方式",
        criteria: [
          "使用「國外藥廠工廠資料準備須知」表A（115.04.27 衛授食字第1151102225號函公告，表A 修訂日期113.05.24）〔準備須知115.04.27〕。",
          "填妥申請日期、申請藥商名稱與販賣業藥商許可執照編號、承辦人及聯絡方式，以及製造廠國別、廠名與廠址。",
          "申請內容依「西藥製造許可及GMP核定項目與作業內容之藥品劑型分類原則」完整填寫，例如「固體劑型：著衣錠（不含特定毒性及危害物質）」。",
          "每案限單一廠址、最多3個劑型／品項／作業內容；勾選本次申請範圍（不含特定毒性及危害物質，或青黴素類、頭孢子菌素、女性荷爾蒙類、細胞毒類等）。",
          "申請方式勾選（全套／簡化／確效替代／引用）與實際檢送資料一致。",
          "製造廠位於 PIC/S 會員國境內；非 PIC/S 會員國境內藥廠一律採國外實地查廠，MRA／MOU 範圍內藥廠依本署相關公告減免文件。",
          "無菌產品勾選最終滅菌或無菌製備，並勾選 SVP／LVP；無菌製備與最終滅菌、大容量與小容量各算1種劑型〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_a_fee", label: "表A 審查費", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Pay the review fee",
        action_zh: "繳納審查費",
        criteria: [
          "依最新版「西藥查驗登記審查費收費標準」繳費；罕藥依「罕見疾病藥物查驗登記審查費收費標準」，且每個申請內容須附罕藥證明文件。",
          "每案最多3個劑型／品項／作業內容（即每案限增加二個）；案件經審查後審查費不予退費。",
          "補繳費時間併入廠商補件之90天期限〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_checklist", label: "表B 申請送審資料查檢表（逐項 Y／N／NA）", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Self-check every Form B item",
        action_zh: "逐項自我檢核表B",
        criteria: [
          "表B 各查檢項目逐項勾選 Y／N／NA，審查員審核欄留白；0. 來函視個案需求檢附。",
          "9. 資料格式符合準備須知：以線上申請平台送件為原則，正本留存於製造許可持有者處；電子文件可閱讀、可辨識且內容真實〔準備須知115.04.27〕。",
          "非英文之外文文件附中文或英文翻譯並確認正確；文件有工廠品保及各相關負責人簽名。",
          "倘檢附文件不實涉及刑事責任者，依刑法第214條移送司法機關。",
          "補件期限90天，以最後一次自行補件日結算；申復案不得補件或展延〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_site", label: "表B-1 單一廠址與廠名廠址一致性", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Match the site name and address to the latest local GMP certificate",
        action_zh: "核對廠名廠址與最新 GMP 證明一致",
        criteria: [
          "每案限申請單一廠址之製造工廠。",
          "表A 所填廠名與廠址，與當地衛生主管機關最新核發之 GMP 證明文件（或當地主管機關官網登記資訊）一致，並附佐證文件。",
        ],
      },
      {
        key: "pmf_b_cforms", label: "表B-2 國外藥廠工廠資料查核表（表C）之填寫與簽署", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete and sign the Form C checklists with page references",
        action_zh: "填寫並簽署表C，標註頁碼",
        criteria: [
          "表C 依申請劑型、品項、作業內容填寫，並一併檢附查核表所要求之資料與文件。",
          "查核表填寫完整，並有代理商或原廠品保／相關人員簽名正本或數位簽章正本電子檔（含簽署日期）。",
          "於表中註明各審查項目所對應送審資料之頁碼或附件；文件排列編碼標示清楚、能與表C 對應〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_auth", label: "表B-3 原廠授權函", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the manufacturer's letter of authorization",
        action_zh: "檢附原廠授權函正本",
        criteria: [
          "原廠授權送審藥商申請 PMF 審查之授權函正本或數位簽章正本電子檔；每案必備，內容要正確。",
        ],
      },
      {
        key: "pmf_b_legalization", label: "表B-4／表C-1 1.3 簽證文件", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide legalized GMP evidence per Article 5(2)",
        action_zh: "依檢查辦法第5條第2項檢送簽證文件",
        criteria: [
          "依「藥物製造業者檢查辦法」第5條第2項擇一檢送：(1) PMF 或 SMF 經出產國最高衛生主管機關或商會簽證；(2) 出產國最高衛生主管機關出具之 GMP 證明正本，或影本加簽證正本；(3) 載明符合當地 GMP 之產品製售證明正本，或影本加簽證正本。",
          "前述正本已送本部其他案件者，得附整份影本並說明正本所送案件案號。",
          "出產國不再出具實體 GMP 證明或屬委託製造者，依105.10.17 FDA風字第1051105400號函，檢送「國外藥品許可證持有者說明函」及十大先進國、EMA 及委託者所在國最高衛生主管機關出具之產品製售證明。",
          "電子化 GMP 或 CPP 須附可驗證之網址連結；出產國為德國者，證明文件得由邦政府衛生主管機關出具〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_smf", label: "表B-5 工廠基本資料（SMF）最新版", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the latest Site Master File",
        action_zh: "檢附最新版 SMF",
        criteria: [
          "內容參照「製藥工廠基本資料（Site Master File）製備說明」（100.05.02 署授食字第1001100562號函）；非依該格式者，由代理商依 SMF 章節依序排列原製造廠資料。",
          "最新版中文或英文電子檔（或紙本）；每案必備。",
        ],
      },
      {
        key: "c1_name_address", label: "表C-1 *1.1 廠名、*1.2 廠址", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.1 廠名、*1.2 廠址",
        action_zh: "備妥表C-1 *1.1 廠名、*1.2 廠址",
        criteria: [
          "廠名與官方證明文件一致。",
          "廠址正確詳細且與官方證明文件一致；通訊地址與廠址不同時另行註明。",
        ],
      },
      {
        key: "c1_scope", label: "表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        action_zh: "備妥表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        criteria: [
          "由國內藥商填寫，並註明申請之製程階段。",
        ],
      },
      {
        key: "c1_special_scope", label: "表C-1 *1.4.2 申請劑型是否含特殊類別產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        action_zh: "備妥表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        criteria: [
          "說明是否限定或包含生物藥品、高致敏性、高活性、有毒或有害物質，例如 β-lactam（青黴素、頭孢子菌素、Penems、Carbacephem、Monobactams）、荷爾蒙（含性荷爾蒙、一般荷爾蒙）、Cytotoxic／Cytostatic 及放射性藥品。",
        ],
      },
      {
        key: "c1_phasing", label: "表C-1 *1.4.3 全程或分段生產、委外檢驗", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.3 全程或分段生產、委外檢驗",
        action_zh: "備妥表C-1 *1.4.3 全程或分段生產、委外檢驗",
        criteria: [
          "說明申請劑型之製造及檢驗為全程或分段；分段生產或委外檢驗者，分別說明廠內執行階段。",
        ],
      },
      {
        key: "c1_layout", label: "表C-1 *1.4.4 生產區平面圖", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.4 生產區平面圖",
        action_zh: "備妥表C-1 *1.4.4 生產區平面圖",
        criteria: [
          "由秤量至包裝作業，涵蓋人流、物流、空氣流向／壓差及潔淨度，並標示本次申請劑型所在區域。",
          "檢送申請劑型所有相關區域（含跨棟作業）之平面圖，例如膠囊劑涉及 A、D 兩棟者兩棟都要附〔113年研討會〕。",
        ],
      },
      {
        key: "c1_existing_approval", label: "表C-1 1.5 國內已核准劑型或引用之核准函", category: "pmf_form_c1", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Prepare 表C-1 1.5 國內已核准劑型或引用之核准函",
        action_zh: "備妥表C-1 1.5 國內已核准劑型或引用之核准函",
        criteria: [
          "申請商已持有該製造廠經本部核准之證明文件者，檢附影本。",
          "申請引用者，填寫引用之核准函劑型，並附該劑型及作業內容經本部核准之證明文件。",
        ],
      },
      {
        key: "c1_site_overview", label: "表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        action_zh: "備妥表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        criteria: [
          "1.6.1 簡述廠地面積、位置與周邊環境。",
          "*1.6.2 檢附全廠平面圖，說明各棟建築與各樓層用途，並標示本次申請劑型所在廠房與樓層。",
          "1.6.3 說明全廠委受託活動及合約。",
        ],
      },
      {
        key: "c1_local_license", label: "表C-1 1.7 出產國主管機關核准之藥廠作業項目", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 1.7 出產國主管機關核准之藥廠作業項目",
        action_zh: "備妥表C-1 1.7 出產國主管機關核准之藥廠作業項目",
        criteria: [
          "檢附官方文件影本，核准作業項目涵蓋本次申請劑型。",
        ],
      },
      {
        key: "c1_product_list", label: "表C-1 *1.8.1 全廠生產產品清單", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.1 全廠生產產品清單",
        action_zh: "備妥表C-1 *1.8.1 全廠生產產品清單",
        criteria: [
          "依劑型列出全廠製造及分包裝之各類產品（人用西藥、人用研究用藥品、動物用藥、醫療器材、化粧品、食品、草藥等），標示類別、主成分與生產廠房編號；屬1.8.2.1特殊產品者另註明。",
          "原廠資料非依劑型排列者，由代理商依劑型整理。",
        ],
      },
      {
        key: "c1_special_products", label: "表C-1 *1.8.2 廠內特殊產品與交叉汙染防止", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        action_zh: "備妥表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        criteria: [
          "勾選廠內生產之特殊產品類別（青黴素類、頭孢子菌素類、Penems、Carbacephem、Monobactams、Estrogen、性荷爾蒙、一般荷爾蒙（含固醇類）、具荷爾蒙活性產品、Cytotoxic、Cytostatic、生物藥品、放射線藥品等）並說明劑型；由代理商填寫者附原廠說明函正本。",
          "說明生產配置（獨立廠房、獨立生產區、共用生產區專用設備或共用設施設備），並於平面圖標示。",
          "共用生產區專用設備或共用設施設備者，附依品質風險管理（含 HBEL-PDE／ADE 效價與毒理評估）之交叉汙染防止措施說明或評估報告、有效性定期評估，以及清潔確效摘要（群組方式須說明分組、各組主成分及指標成分）。",
          "廠內未生產特殊產品者（1.8.2 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "c1_non_medicinal", label: "表C-1 *1.8.3 兼製非人用藥品或其他產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.3 兼製非人用藥品或其他產品",
        action_zh: "備妥表C-1 *1.8.3 兼製非人用藥品或其他產品",
        criteria: [
          "勾選兼製之動物用藥（人體可用／不可用）、食品、化粧品、醫療器材（藥典／非藥典成分）、草藥、順勢藥物、一般商品、飼料，並說明種類、劑型、組成與是否為人體可用成分，附佐證；代理商填寫者附原廠說明函正本。",
          "說明生產配置並於平面圖標示。",
          "共用生產區專用設備者：說明主成分是否為藥典收載（附依據）、是否採 PIC/S GMP（原廠聲明函），以及依品質風險管理之交叉汙染防止措施與定期評估。",
          "共用設施設備者：說明主成分是否為藥典收載或可作為藥品成分、交叉汙染防止措施；兼製非人體可用之動物用藥者，另附含 HBEL-PDE／ADE 毒理資料之風險評估，並列出共用設備清單與清潔確效摘要。",
          "未兼製者（1.8.3 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "pmf_c3", label: "表C-3 全套審查查核表（所有產品）", category: "pmf_form_c", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-3 全套審查查核表（所有產品）",
        action_zh: "備妥表C-3 全套審查查核表（所有產品）",
        criteria: [
          "依表C-3 逐欄填寫並檢附資料。",
          "無菌產品依 PIC/S GMP Annex 1 增修內容填寫（品質風險管理、CCS、RABS／隔離裝置）〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_c5", label: "表C-5 確效及驗證作業", category: "pmf_form_c", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-5 確效及驗證作業",
        action_zh: "備妥表C-5 確效及驗證作業",
        criteria: [
          "依表C-5 逐欄填寫並檢附確效及驗證資料。",
          "新版依 PIC/S GMP Annex 1 增修：品質風險管理（Annex 20）、汙染管制策略（CCS）之執行與定期評估〔113年研討會〕。",
          "以確效替代三文件減免者，本項標記「不適用」並寫明「採確效替代」。",
        ],
      },
      {
        key: "val_alternative", label: "確效替代三文件（減免表C-5）", category: "pmf_mode", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Prepare 確效替代三文件（減免表C-5）",
        action_zh: "備妥確效替代三文件（減免表C-5）",
        criteria: [
          "十大先進國或 EMA 核發之產品製售證明（CPP）正本或影本，於2年有效期限內。",
          "確效及驗證摘要說明：經廠內權責人員簽署之正本或數位簽章電子文件，涵蓋支援系統（空調、水及製程中氣體）確效、設施設備驗證、電腦化系統確效及清潔確效。",
          "原廠說明函：經廠內權責人員簽署之正本或數位簽章電子文件，載明認知本部有查廠之完全權力，必要時依國際慣例查廠。",
          "未採確效替代者，本項標記「不適用」並寫明原因。",
        ],
      },
    ],
  },
  pmf_sterile_simplified: {
    display_name: "Foreign plant PMF — Sterile products, simplified review",
    display_name_zh: "國外藥廠 PMF：無菌產品－簡化審查",
    deadline_default_days: 90,
    items: [
      {
        key: "pmf_a_form", label: "表A 申請國外藥廠工廠資料（PMF）審查送審表", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete Form A with the dosage forms, scope and review route",
        action_zh: "填妥表A 申請內容與申請方式",
        criteria: [
          "使用「國外藥廠工廠資料準備須知」表A（115.04.27 衛授食字第1151102225號函公告，表A 修訂日期113.05.24）〔準備須知115.04.27〕。",
          "填妥申請日期、申請藥商名稱與販賣業藥商許可執照編號、承辦人及聯絡方式，以及製造廠國別、廠名與廠址。",
          "申請內容依「西藥製造許可及GMP核定項目與作業內容之藥品劑型分類原則」完整填寫，例如「固體劑型：著衣錠（不含特定毒性及危害物質）」。",
          "每案限單一廠址、最多3個劑型／品項／作業內容；勾選本次申請範圍（不含特定毒性及危害物質，或青黴素類、頭孢子菌素、女性荷爾蒙類、細胞毒類等）。",
          "申請方式勾選（全套／簡化／確效替代／引用）與實際檢送資料一致。",
          "製造廠位於 PIC/S 會員國境內；非 PIC/S 會員國境內藥廠一律採國外實地查廠，MRA／MOU 範圍內藥廠依本署相關公告減免文件。",
          "無菌產品勾選最終滅菌或無菌製備，並勾選 SVP／LVP；無菌製備與最終滅菌、大容量與小容量各算1種劑型〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_a_fee", label: "表A 審查費", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Pay the review fee",
        action_zh: "繳納審查費",
        criteria: [
          "依最新版「西藥查驗登記審查費收費標準」繳費；罕藥依「罕見疾病藥物查驗登記審查費收費標準」，且每個申請內容須附罕藥證明文件。",
          "每案最多3個劑型／品項／作業內容（即每案限增加二個）；案件經審查後審查費不予退費。",
          "補繳費時間併入廠商補件之90天期限〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_checklist", label: "表B 申請送審資料查檢表（逐項 Y／N／NA）", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Self-check every Form B item",
        action_zh: "逐項自我檢核表B",
        criteria: [
          "表B 各查檢項目逐項勾選 Y／N／NA，審查員審核欄留白；0. 來函視個案需求檢附。",
          "9. 資料格式符合準備須知：以線上申請平台送件為原則，正本留存於製造許可持有者處；電子文件可閱讀、可辨識且內容真實〔準備須知115.04.27〕。",
          "非英文之外文文件附中文或英文翻譯並確認正確；文件有工廠品保及各相關負責人簽名。",
          "倘檢附文件不實涉及刑事責任者，依刑法第214條移送司法機關。",
          "補件期限90天，以最後一次自行補件日結算；申復案不得補件或展延〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_site", label: "表B-1 單一廠址與廠名廠址一致性", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Match the site name and address to the latest local GMP certificate",
        action_zh: "核對廠名廠址與最新 GMP 證明一致",
        criteria: [
          "每案限申請單一廠址之製造工廠。",
          "表A 所填廠名與廠址，與當地衛生主管機關最新核發之 GMP 證明文件（或當地主管機關官網登記資訊）一致，並附佐證文件。",
        ],
      },
      {
        key: "pmf_b_cforms", label: "表B-2 國外藥廠工廠資料查核表（表C）之填寫與簽署", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete and sign the Form C checklists with page references",
        action_zh: "填寫並簽署表C，標註頁碼",
        criteria: [
          "表C 依申請劑型、品項、作業內容填寫，並一併檢附查核表所要求之資料與文件。",
          "查核表填寫完整，並有代理商或原廠品保／相關人員簽名正本或數位簽章正本電子檔（含簽署日期）。",
          "於表中註明各審查項目所對應送審資料之頁碼或附件；文件排列編碼標示清楚、能與表C 對應〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_auth", label: "表B-3 原廠授權函", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the manufacturer's letter of authorization",
        action_zh: "檢附原廠授權函正本",
        criteria: [
          "原廠授權送審藥商申請 PMF 審查之授權函正本或數位簽章正本電子檔；每案必備，內容要正確。",
        ],
      },
      {
        key: "pmf_b_legalization", label: "表B-4／表C-1 1.3 簽證文件", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide legalized GMP evidence per Article 5(2)",
        action_zh: "依檢查辦法第5條第2項檢送簽證文件",
        criteria: [
          "依「藥物製造業者檢查辦法」第5條第2項擇一檢送：(1) PMF 或 SMF 經出產國最高衛生主管機關或商會簽證；(2) 出產國最高衛生主管機關出具之 GMP 證明正本，或影本加簽證正本；(3) 載明符合當地 GMP 之產品製售證明正本，或影本加簽證正本。",
          "前述正本已送本部其他案件者，得附整份影本並說明正本所送案件案號。",
          "出產國不再出具實體 GMP 證明或屬委託製造者，依105.10.17 FDA風字第1051105400號函，檢送「國外藥品許可證持有者說明函」及十大先進國、EMA 及委託者所在國最高衛生主管機關出具之產品製售證明。",
          "電子化 GMP 或 CPP 須附可驗證之網址連結；出產國為德國者，證明文件得由邦政府衛生主管機關出具〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_smf", label: "表B-5 工廠基本資料（SMF）最新版", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the latest Site Master File",
        action_zh: "檢附最新版 SMF",
        criteria: [
          "內容參照「製藥工廠基本資料（Site Master File）製備說明」（100.05.02 署授食字第1001100562號函）；非依該格式者，由代理商依 SMF 章節依序排列原製造廠資料。",
          "最新版中文或英文電子檔（或紙本）；每案必備。",
        ],
      },
      {
        key: "c1_name_address", label: "表C-1 *1.1 廠名、*1.2 廠址", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.1 廠名、*1.2 廠址",
        action_zh: "備妥表C-1 *1.1 廠名、*1.2 廠址",
        criteria: [
          "廠名與官方證明文件一致。",
          "廠址正確詳細且與官方證明文件一致；通訊地址與廠址不同時另行註明。",
        ],
      },
      {
        key: "c1_scope", label: "表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        action_zh: "備妥表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        criteria: [
          "由國內藥商填寫，並註明申請之製程階段。",
        ],
      },
      {
        key: "c1_special_scope", label: "表C-1 *1.4.2 申請劑型是否含特殊類別產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        action_zh: "備妥表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        criteria: [
          "說明是否限定或包含生物藥品、高致敏性、高活性、有毒或有害物質，例如 β-lactam（青黴素、頭孢子菌素、Penems、Carbacephem、Monobactams）、荷爾蒙（含性荷爾蒙、一般荷爾蒙）、Cytotoxic／Cytostatic 及放射性藥品。",
        ],
      },
      {
        key: "c1_phasing", label: "表C-1 *1.4.3 全程或分段生產、委外檢驗", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.3 全程或分段生產、委外檢驗",
        action_zh: "備妥表C-1 *1.4.3 全程或分段生產、委外檢驗",
        criteria: [
          "說明申請劑型之製造及檢驗為全程或分段；分段生產或委外檢驗者，分別說明廠內執行階段。",
        ],
      },
      {
        key: "c1_layout", label: "表C-1 *1.4.4 生產區平面圖", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.4 生產區平面圖",
        action_zh: "備妥表C-1 *1.4.4 生產區平面圖",
        criteria: [
          "由秤量至包裝作業，涵蓋人流、物流、空氣流向／壓差及潔淨度，並標示本次申請劑型所在區域。",
          "檢送申請劑型所有相關區域（含跨棟作業）之平面圖，例如膠囊劑涉及 A、D 兩棟者兩棟都要附〔113年研討會〕。",
        ],
      },
      {
        key: "c1_existing_approval", label: "表C-1 1.5 國內已核准劑型或引用之核准函", category: "pmf_form_c1", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Prepare 表C-1 1.5 國內已核准劑型或引用之核准函",
        action_zh: "備妥表C-1 1.5 國內已核准劑型或引用之核准函",
        criteria: [
          "申請商已持有該製造廠經本部核准之證明文件者，檢附影本。",
          "申請引用者，填寫引用之核准函劑型，並附該劑型及作業內容經本部核准之證明文件。",
        ],
      },
      {
        key: "c1_site_overview", label: "表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        action_zh: "備妥表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        criteria: [
          "1.6.1 簡述廠地面積、位置與周邊環境。",
          "*1.6.2 檢附全廠平面圖，說明各棟建築與各樓層用途，並標示本次申請劑型所在廠房與樓層。",
          "1.6.3 說明全廠委受託活動及合約。",
        ],
      },
      {
        key: "c1_local_license", label: "表C-1 1.7 出產國主管機關核准之藥廠作業項目", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 1.7 出產國主管機關核准之藥廠作業項目",
        action_zh: "備妥表C-1 1.7 出產國主管機關核准之藥廠作業項目",
        criteria: [
          "檢附官方文件影本，核准作業項目涵蓋本次申請劑型。",
        ],
      },
      {
        key: "c1_product_list", label: "表C-1 *1.8.1 全廠生產產品清單", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.1 全廠生產產品清單",
        action_zh: "備妥表C-1 *1.8.1 全廠生產產品清單",
        criteria: [
          "依劑型列出全廠製造及分包裝之各類產品（人用西藥、人用研究用藥品、動物用藥、醫療器材、化粧品、食品、草藥等），標示類別、主成分與生產廠房編號；屬1.8.2.1特殊產品者另註明。",
          "原廠資料非依劑型排列者，由代理商依劑型整理。",
        ],
      },
      {
        key: "c1_special_products", label: "表C-1 *1.8.2 廠內特殊產品與交叉汙染防止", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        action_zh: "備妥表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        criteria: [
          "勾選廠內生產之特殊產品類別（青黴素類、頭孢子菌素類、Penems、Carbacephem、Monobactams、Estrogen、性荷爾蒙、一般荷爾蒙（含固醇類）、具荷爾蒙活性產品、Cytotoxic、Cytostatic、生物藥品、放射線藥品等）並說明劑型；由代理商填寫者附原廠說明函正本。",
          "說明生產配置（獨立廠房、獨立生產區、共用生產區專用設備或共用設施設備），並於平面圖標示。",
          "共用生產區專用設備或共用設施設備者，附依品質風險管理（含 HBEL-PDE／ADE 效價與毒理評估）之交叉汙染防止措施說明或評估報告、有效性定期評估，以及清潔確效摘要（群組方式須說明分組、各組主成分及指標成分）。",
          "廠內未生產特殊產品者（1.8.2 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "c1_non_medicinal", label: "表C-1 *1.8.3 兼製非人用藥品或其他產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.3 兼製非人用藥品或其他產品",
        action_zh: "備妥表C-1 *1.8.3 兼製非人用藥品或其他產品",
        criteria: [
          "勾選兼製之動物用藥（人體可用／不可用）、食品、化粧品、醫療器材（藥典／非藥典成分）、草藥、順勢藥物、一般商品、飼料，並說明種類、劑型、組成與是否為人體可用成分，附佐證；代理商填寫者附原廠說明函正本。",
          "說明生產配置並於平面圖標示。",
          "共用生產區專用設備者：說明主成分是否為藥典收載（附依據）、是否採 PIC/S GMP（原廠聲明函），以及依品質風險管理之交叉汙染防止措施與定期評估。",
          "共用設施設備者：說明主成分是否為藥典收載或可作為藥品成分、交叉汙染防止措施；兼製非人體可用之動物用藥者，另附含 HBEL-PDE／ADE 毒理資料之風險評估，並列出共用設備清單與清潔確效摘要。",
          "未兼製者（1.8.3 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "sim_inspection_list", label: "簡化文件1：最近5年 GMP 查核清單", category: "pmf_mode", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 簡化文件1：最近5年 GMP 查核清單",
        action_zh: "備妥簡化文件1：最近5年 GMP 查核清單",
        criteria: [
          "列出最近5年接受當地及外國衛生主管機關之 GMP 查核，至少包括查核日期、查核主題與範疇。",
        ],
      },
      {
        key: "sim_inspection_report", label: "簡化文件2：最近一次當地主管機關實地查核報告及通過證明", category: "pmf_mode", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 簡化文件2：最近一次當地主管機關實地查核報告及通過證明",
        action_zh: "備妥簡化文件2：最近一次當地主管機關實地查核報告及通過證明",
        criteria: [
          "為最近一次接受當地衛生主管機關 GMP 實地查核之查廠報告，查核範圍涵蓋 PMF 申請劑型或作業內容。",
          "附原文查廠報告，及中文或英文之全文翻譯。",
          "附當次查廠通過之證明文件（如 GMP certificate）。",
        ],
      },
      {
        key: "sim_major_changes", label: "簡化文件3：查廠後至送件日之重大變更清單", category: "pmf_mode", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 簡化文件3：查廠後至送件日之重大變更清單",
        action_zh: "備妥簡化文件3：查廠後至送件日之重大變更清單",
        criteria: [
          "列出該次查廠至本案送件日期間，申請劑型／作業內容之重大變更事項（含廠房、設施、設備、製程）。",
        ],
      },
      {
        key: "pmf_c2", label: "表C-2 簡化審查查核表（無菌產品／生物產品）", category: "pmf_form_c", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-2 簡化審查查核表（無菌產品／生物產品）",
        action_zh: "備妥表C-2 簡化審查查核表（無菌產品／生物產品）",
        criteria: [
          "依表C-2 逐欄填寫並檢附資料；適用無菌產品、生物產品、生物原料藥（含宣稱非無菌或負荷菌管制者）及血液產品。",
          "依 PIC/S GMP Annex 1 增修內容：品質風險管理、汙染管制策略（CCS）、屏障系統（RABS）或隔離裝置之應用〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_c5", label: "表C-5 確效及驗證作業", category: "pmf_form_c", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-5 確效及驗證作業",
        action_zh: "備妥表C-5 確效及驗證作業",
        criteria: [
          "依表C-5 逐欄填寫並檢附確效及驗證資料。",
          "新版依 PIC/S GMP Annex 1 增修：品質風險管理（Annex 20）、汙染管制策略（CCS）之執行與定期評估〔113年研討會〕。",
          "以確效替代三文件減免者，本項標記「不適用」並寫明「採確效替代」。",
        ],
      },
      {
        key: "val_alternative", label: "確效替代三文件（減免表C-5）", category: "pmf_mode", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Prepare 確效替代三文件（減免表C-5）",
        action_zh: "備妥確效替代三文件（減免表C-5）",
        criteria: [
          "十大先進國或 EMA 核發之產品製售證明（CPP）正本或影本，於2年有效期限內。",
          "確效及驗證摘要說明：經廠內權責人員簽署之正本或數位簽章電子文件，涵蓋支援系統（空調、水及製程中氣體）確效、設施設備驗證、電腦化系統確效及清潔確效。",
          "原廠說明函：經廠內權責人員簽署之正本或數位簽章電子文件，載明認知本部有查廠之完全權力，必要時依國際慣例查廠。",
          "未採確效替代者，本項標記「不適用」並寫明原因。",
        ],
      },
    ],
  },
  pmf_bio_full: {
    display_name: "Foreign plant PMF — ATMPs / biologicals / plasma-derived products, full review",
    display_name_zh: "國外藥廠 PMF：ATMPs／生物產品／生物原料藥／血漿衍生產品－全套審查",
    deadline_default_days: 90,
    items: [
      {
        key: "pmf_a_form", label: "表A 申請國外藥廠工廠資料（PMF）審查送審表", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete Form A with the dosage forms, scope and review route",
        action_zh: "填妥表A 申請內容與申請方式",
        criteria: [
          "使用「國外藥廠工廠資料準備須知」表A（115.04.27 衛授食字第1151102225號函公告，表A 修訂日期113.05.24）〔準備須知115.04.27〕。",
          "填妥申請日期、申請藥商名稱與販賣業藥商許可執照編號、承辦人及聯絡方式，以及製造廠國別、廠名與廠址。",
          "申請內容依「西藥製造許可及GMP核定項目與作業內容之藥品劑型分類原則」完整填寫，例如「固體劑型：著衣錠（不含特定毒性及危害物質）」。",
          "每案限單一廠址、最多3個劑型／品項／作業內容；勾選本次申請範圍（不含特定毒性及危害物質，或青黴素類、頭孢子菌素、女性荷爾蒙類、細胞毒類等）。",
          "申請方式勾選（全套／簡化／確效替代／引用）與實際檢送資料一致。",
          "製造廠位於 PIC/S 會員國境內；非 PIC/S 會員國境內藥廠一律採國外實地查廠，MRA／MOU 範圍內藥廠依本署相關公告減免文件。",
          "勾選生物產品、生物產品之原料藥、血漿衍生之產品、ATMPs 或疫苗，並寫明製程範圍（例如「從細胞庫到原料藥 abc 的製造」）〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_a_fee", label: "表A 審查費", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Pay the review fee",
        action_zh: "繳納審查費",
        criteria: [
          "依最新版「西藥查驗登記審查費收費標準」繳費；罕藥依「罕見疾病藥物查驗登記審查費收費標準」，且每個申請內容須附罕藥證明文件。",
          "每案最多3個劑型／品項／作業內容（即每案限增加二個）；案件經審查後審查費不予退費。",
          "補繳費時間併入廠商補件之90天期限〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_checklist", label: "表B 申請送審資料查檢表（逐項 Y／N／NA）", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Self-check every Form B item",
        action_zh: "逐項自我檢核表B",
        criteria: [
          "表B 各查檢項目逐項勾選 Y／N／NA，審查員審核欄留白；0. 來函視個案需求檢附。",
          "9. 資料格式符合準備須知：以線上申請平台送件為原則，正本留存於製造許可持有者處；電子文件可閱讀、可辨識且內容真實〔準備須知115.04.27〕。",
          "非英文之外文文件附中文或英文翻譯並確認正確；文件有工廠品保及各相關負責人簽名。",
          "倘檢附文件不實涉及刑事責任者，依刑法第214條移送司法機關。",
          "補件期限90天，以最後一次自行補件日結算；申復案不得補件或展延〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_site", label: "表B-1 單一廠址與廠名廠址一致性", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Match the site name and address to the latest local GMP certificate",
        action_zh: "核對廠名廠址與最新 GMP 證明一致",
        criteria: [
          "每案限申請單一廠址之製造工廠。",
          "表A 所填廠名與廠址，與當地衛生主管機關最新核發之 GMP 證明文件（或當地主管機關官網登記資訊）一致，並附佐證文件。",
        ],
      },
      {
        key: "pmf_b_cforms", label: "表B-2 國外藥廠工廠資料查核表（表C）之填寫與簽署", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete and sign the Form C checklists with page references",
        action_zh: "填寫並簽署表C，標註頁碼",
        criteria: [
          "表C 依申請劑型、品項、作業內容填寫，並一併檢附查核表所要求之資料與文件。",
          "查核表填寫完整，並有代理商或原廠品保／相關人員簽名正本或數位簽章正本電子檔（含簽署日期）。",
          "於表中註明各審查項目所對應送審資料之頁碼或附件；文件排列編碼標示清楚、能與表C 對應〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_auth", label: "表B-3 原廠授權函", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the manufacturer's letter of authorization",
        action_zh: "檢附原廠授權函正本",
        criteria: [
          "原廠授權送審藥商申請 PMF 審查之授權函正本或數位簽章正本電子檔；每案必備，內容要正確。",
          "申請 ATMPs／生物產品／生物原料藥／血液產品者，授權函說明申請品項／劑型及製程階段（表B-3(2)）。",
        ],
      },
      {
        key: "pmf_b_legalization", label: "表B-4／表C-1 1.3 簽證文件", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide legalized GMP evidence per Article 5(2)",
        action_zh: "依檢查辦法第5條第2項檢送簽證文件",
        criteria: [
          "依「藥物製造業者檢查辦法」第5條第2項擇一檢送：(1) PMF 或 SMF 經出產國最高衛生主管機關或商會簽證；(2) 出產國最高衛生主管機關出具之 GMP 證明正本，或影本加簽證正本；(3) 載明符合當地 GMP 之產品製售證明正本，或影本加簽證正本。",
          "前述正本已送本部其他案件者，得附整份影本並說明正本所送案件案號。",
          "出產國不再出具實體 GMP 證明或屬委託製造者，依105.10.17 FDA風字第1051105400號函，檢送「國外藥品許可證持有者說明函」及十大先進國、EMA 及委託者所在國最高衛生主管機關出具之產品製售證明。",
          "電子化 GMP 或 CPP 須附可驗證之網址連結；出產國為德國者，證明文件得由邦政府衛生主管機關出具〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_smf", label: "表B-5 工廠基本資料（SMF）最新版", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the latest Site Master File",
        action_zh: "檢附最新版 SMF",
        criteria: [
          "內容參照「製藥工廠基本資料（Site Master File）製備說明」（100.05.02 署授食字第1001100562號函）；非依該格式者，由代理商依 SMF 章節依序排列原製造廠資料。",
          "最新版中文或英文電子檔（或紙本）；每案必備。",
        ],
      },
      {
        key: "c1_name_address", label: "表C-1 *1.1 廠名、*1.2 廠址", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.1 廠名、*1.2 廠址",
        action_zh: "備妥表C-1 *1.1 廠名、*1.2 廠址",
        criteria: [
          "廠名與官方證明文件一致。",
          "廠址正確詳細且與官方證明文件一致；通訊地址與廠址不同時另行註明。",
        ],
      },
      {
        key: "c1_scope", label: "表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        action_zh: "備妥表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        criteria: [
          "由國內藥商填寫，並註明申請之製程階段。",
          "ATMPs／生物藥品／血漿衍生產品再說明品項／劑型及生產階段，並勾選：動物來源、過敏原、動物免疫血清、疫苗、基因重組、單株抗體、基因轉殖動物、基因轉殖植物、基因治療、體細胞與異體細胞治療及組織工程、血液產品。",
        ],
      },
      {
        key: "c1_special_scope", label: "表C-1 *1.4.2 申請劑型是否含特殊類別產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        action_zh: "備妥表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        criteria: [
          "說明是否限定或包含生物藥品、高致敏性、高活性、有毒或有害物質，例如 β-lactam（青黴素、頭孢子菌素、Penems、Carbacephem、Monobactams）、荷爾蒙（含性荷爾蒙、一般荷爾蒙）、Cytotoxic／Cytostatic 及放射性藥品。",
        ],
      },
      {
        key: "c1_phasing", label: "表C-1 *1.4.3 全程或分段生產、委外檢驗", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.3 全程或分段生產、委外檢驗",
        action_zh: "備妥表C-1 *1.4.3 全程或分段生產、委外檢驗",
        criteria: [
          "說明申請劑型之製造及檢驗為全程或分段；分段生產或委外檢驗者，分別說明廠內執行階段。",
        ],
      },
      {
        key: "c1_layout", label: "表C-1 *1.4.4 生產區平面圖", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.4 生產區平面圖",
        action_zh: "備妥表C-1 *1.4.4 生產區平面圖",
        criteria: [
          "由秤量至包裝作業，涵蓋人流、物流、空氣流向／壓差及潔淨度，並標示本次申請劑型所在區域。",
          "檢送申請劑型所有相關區域（含跨棟作業）之平面圖，例如膠囊劑涉及 A、D 兩棟者兩棟都要附〔113年研討會〕。",
        ],
      },
      {
        key: "c1_existing_approval", label: "表C-1 1.5 國內已核准劑型或引用之核准函", category: "pmf_form_c1", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Prepare 表C-1 1.5 國內已核准劑型或引用之核准函",
        action_zh: "備妥表C-1 1.5 國內已核准劑型或引用之核准函",
        criteria: [
          "申請商已持有該製造廠經本部核准之證明文件者，檢附影本。",
          "申請引用者，填寫引用之核准函劑型，並附該劑型及作業內容經本部核准之證明文件。",
        ],
      },
      {
        key: "c1_site_overview", label: "表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        action_zh: "備妥表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        criteria: [
          "1.6.1 簡述廠地面積、位置與周邊環境。",
          "*1.6.2 檢附全廠平面圖，說明各棟建築與各樓層用途，並標示本次申請劑型所在廠房與樓層。",
          "1.6.3 說明全廠委受託活動及合約。",
        ],
      },
      {
        key: "c1_local_license", label: "表C-1 1.7 出產國主管機關核准之藥廠作業項目", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 1.7 出產國主管機關核准之藥廠作業項目",
        action_zh: "備妥表C-1 1.7 出產國主管機關核准之藥廠作業項目",
        criteria: [
          "檢附官方文件影本，核准作業項目涵蓋本次申請劑型。",
        ],
      },
      {
        key: "c1_product_list", label: "表C-1 *1.8.1 全廠生產產品清單", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.1 全廠生產產品清單",
        action_zh: "備妥表C-1 *1.8.1 全廠生產產品清單",
        criteria: [
          "依劑型列出全廠製造及分包裝之各類產品（人用西藥、人用研究用藥品、動物用藥、醫療器材、化粧品、食品、草藥等），標示類別、主成分與生產廠房編號；屬1.8.2.1特殊產品者另註明。",
          "原廠資料非依劑型排列者，由代理商依劑型整理。",
        ],
      },
      {
        key: "c1_special_products", label: "表C-1 *1.8.2 廠內特殊產品與交叉汙染防止", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        action_zh: "備妥表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        criteria: [
          "勾選廠內生產之特殊產品類別（青黴素類、頭孢子菌素類、Penems、Carbacephem、Monobactams、Estrogen、性荷爾蒙、一般荷爾蒙（含固醇類）、具荷爾蒙活性產品、Cytotoxic、Cytostatic、生物藥品、放射線藥品等）並說明劑型；由代理商填寫者附原廠說明函正本。",
          "說明生產配置（獨立廠房、獨立生產區、共用生產區專用設備或共用設施設備），並於平面圖標示。",
          "共用生產區專用設備或共用設施設備者，附依品質風險管理（含 HBEL-PDE／ADE 效價與毒理評估）之交叉汙染防止措施說明或評估報告、有效性定期評估，以及清潔確效摘要（群組方式須說明分組、各組主成分及指標成分）。",
          "廠內未生產特殊產品者（1.8.2 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "c1_non_medicinal", label: "表C-1 *1.8.3 兼製非人用藥品或其他產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.3 兼製非人用藥品或其他產品",
        action_zh: "備妥表C-1 *1.8.3 兼製非人用藥品或其他產品",
        criteria: [
          "勾選兼製之動物用藥（人體可用／不可用）、食品、化粧品、醫療器材（藥典／非藥典成分）、草藥、順勢藥物、一般商品、飼料，並說明種類、劑型、組成與是否為人體可用成分，附佐證；代理商填寫者附原廠說明函正本。",
          "說明生產配置並於平面圖標示。",
          "共用生產區專用設備者：說明主成分是否為藥典收載（附依據）、是否採 PIC/S GMP（原廠聲明函），以及依品質風險管理之交叉汙染防止措施與定期評估。",
          "共用設施設備者：說明主成分是否為藥典收載或可作為藥品成分、交叉汙染防止措施；兼製非人體可用之動物用藥者，另附含 HBEL-PDE／ADE 毒理資料之風險評估，並列出共用設備清單與清潔確效摘要。",
          "未兼製者（1.8.3 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "pmf_c3", label: "表C-3 全套審查查核表（所有產品）", category: "pmf_form_c", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-3 全套審查查核表（所有產品）",
        action_zh: "備妥表C-3 全套審查查核表（所有產品）",
        criteria: [
          "依表C-3 逐欄填寫並檢附資料。",
          "無菌產品依 PIC/S GMP Annex 1 增修內容填寫（品質風險管理、CCS、RABS／隔離裝置）〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_c4", label: "表C-4 ATMPs／生物原料藥及產品查核表", category: "pmf_form_c", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-4 ATMPs／生物原料藥及產品查核表",
        action_zh: "備妥表C-4 ATMPs／生物原料藥及產品查核表",
        criteria: [
          "依表C-4 逐欄填寫；架構依 PIC/S GMP Annex 2：共同一般性項目，再分 Annex 2A（ATMPs）、Annex 2B（生物原料藥及產品）及 Annex 14（血漿衍生藥品）〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_c5", label: "表C-5 確效及驗證作業", category: "pmf_form_c", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-5 確效及驗證作業",
        action_zh: "備妥表C-5 確效及驗證作業",
        criteria: [
          "依表C-5 逐欄填寫並檢附確效及驗證資料。",
          "新版依 PIC/S GMP Annex 1 增修：品質風險管理（Annex 20）、汙染管制策略（CCS）之執行與定期評估〔113年研討會〕。",
          "以確效替代三文件減免者，本項標記「不適用」並寫明「採確效替代」。",
        ],
      },
      {
        key: "val_alternative", label: "確效替代三文件（減免表C-5）", category: "pmf_mode", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Prepare 確效替代三文件（減免表C-5）",
        action_zh: "備妥確效替代三文件（減免表C-5）",
        criteria: [
          "十大先進國或 EMA 核發之產品製售證明（CPP）正本或影本，於2年有效期限內。",
          "確效及驗證摘要說明：經廠內權責人員簽署之正本或數位簽章電子文件，涵蓋支援系統（空調、水及製程中氣體）確效、設施設備驗證、電腦化系統確效及清潔確效。",
          "原廠說明函：經廠內權責人員簽署之正本或數位簽章電子文件，載明認知本部有查廠之完全權力，必要時依國際慣例查廠。",
          "未採確效替代者，本項標記「不適用」並寫明原因。",
        ],
      },
    ],
  },
  pmf_bio_simplified: {
    display_name: "Foreign plant PMF — ATMPs / biologicals / plasma-derived products, simplified review",
    display_name_zh: "國外藥廠 PMF：ATMPs／生物產品／生物原料藥／血漿衍生產品－簡化審查",
    deadline_default_days: 90,
    items: [
      {
        key: "pmf_a_form", label: "表A 申請國外藥廠工廠資料（PMF）審查送審表", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete Form A with the dosage forms, scope and review route",
        action_zh: "填妥表A 申請內容與申請方式",
        criteria: [
          "使用「國外藥廠工廠資料準備須知」表A（115.04.27 衛授食字第1151102225號函公告，表A 修訂日期113.05.24）〔準備須知115.04.27〕。",
          "填妥申請日期、申請藥商名稱與販賣業藥商許可執照編號、承辦人及聯絡方式，以及製造廠國別、廠名與廠址。",
          "申請內容依「西藥製造許可及GMP核定項目與作業內容之藥品劑型分類原則」完整填寫，例如「固體劑型：著衣錠（不含特定毒性及危害物質）」。",
          "每案限單一廠址、最多3個劑型／品項／作業內容；勾選本次申請範圍（不含特定毒性及危害物質，或青黴素類、頭孢子菌素、女性荷爾蒙類、細胞毒類等）。",
          "申請方式勾選（全套／簡化／確效替代／引用）與實際檢送資料一致。",
          "製造廠位於 PIC/S 會員國境內；非 PIC/S 會員國境內藥廠一律採國外實地查廠，MRA／MOU 範圍內藥廠依本署相關公告減免文件。",
          "勾選生物產品、生物產品之原料藥、血漿衍生之產品、ATMPs 或疫苗，並寫明製程範圍（例如「從細胞庫到原料藥 abc 的製造」）〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_a_fee", label: "表A 審查費", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Pay the review fee",
        action_zh: "繳納審查費",
        criteria: [
          "依最新版「西藥查驗登記審查費收費標準」繳費；罕藥依「罕見疾病藥物查驗登記審查費收費標準」，且每個申請內容須附罕藥證明文件。",
          "每案最多3個劑型／品項／作業內容（即每案限增加二個）；案件經審查後審查費不予退費。",
          "補繳費時間併入廠商補件之90天期限〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_checklist", label: "表B 申請送審資料查檢表（逐項 Y／N／NA）", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Self-check every Form B item",
        action_zh: "逐項自我檢核表B",
        criteria: [
          "表B 各查檢項目逐項勾選 Y／N／NA，審查員審核欄留白；0. 來函視個案需求檢附。",
          "9. 資料格式符合準備須知：以線上申請平台送件為原則，正本留存於製造許可持有者處；電子文件可閱讀、可辨識且內容真實〔準備須知115.04.27〕。",
          "非英文之外文文件附中文或英文翻譯並確認正確；文件有工廠品保及各相關負責人簽名。",
          "倘檢附文件不實涉及刑事責任者，依刑法第214條移送司法機關。",
          "補件期限90天，以最後一次自行補件日結算；申復案不得補件或展延〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_site", label: "表B-1 單一廠址與廠名廠址一致性", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Match the site name and address to the latest local GMP certificate",
        action_zh: "核對廠名廠址與最新 GMP 證明一致",
        criteria: [
          "每案限申請單一廠址之製造工廠。",
          "表A 所填廠名與廠址，與當地衛生主管機關最新核發之 GMP 證明文件（或當地主管機關官網登記資訊）一致，並附佐證文件。",
        ],
      },
      {
        key: "pmf_b_cforms", label: "表B-2 國外藥廠工廠資料查核表（表C）之填寫與簽署", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete and sign the Form C checklists with page references",
        action_zh: "填寫並簽署表C，標註頁碼",
        criteria: [
          "表C 依申請劑型、品項、作業內容填寫，並一併檢附查核表所要求之資料與文件。",
          "查核表填寫完整，並有代理商或原廠品保／相關人員簽名正本或數位簽章正本電子檔（含簽署日期）。",
          "於表中註明各審查項目所對應送審資料之頁碼或附件；文件排列編碼標示清楚、能與表C 對應〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_auth", label: "表B-3 原廠授權函", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the manufacturer's letter of authorization",
        action_zh: "檢附原廠授權函正本",
        criteria: [
          "原廠授權送審藥商申請 PMF 審查之授權函正本或數位簽章正本電子檔；每案必備，內容要正確。",
          "申請 ATMPs／生物產品／生物原料藥／血液產品者，授權函說明申請品項／劑型及製程階段（表B-3(2)）。",
        ],
      },
      {
        key: "pmf_b_legalization", label: "表B-4／表C-1 1.3 簽證文件", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide legalized GMP evidence per Article 5(2)",
        action_zh: "依檢查辦法第5條第2項檢送簽證文件",
        criteria: [
          "依「藥物製造業者檢查辦法」第5條第2項擇一檢送：(1) PMF 或 SMF 經出產國最高衛生主管機關或商會簽證；(2) 出產國最高衛生主管機關出具之 GMP 證明正本，或影本加簽證正本；(3) 載明符合當地 GMP 之產品製售證明正本，或影本加簽證正本。",
          "前述正本已送本部其他案件者，得附整份影本並說明正本所送案件案號。",
          "出產國不再出具實體 GMP 證明或屬委託製造者，依105.10.17 FDA風字第1051105400號函，檢送「國外藥品許可證持有者說明函」及十大先進國、EMA 及委託者所在國最高衛生主管機關出具之產品製售證明。",
          "電子化 GMP 或 CPP 須附可驗證之網址連結；出產國為德國者，證明文件得由邦政府衛生主管機關出具〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_smf", label: "表B-5 工廠基本資料（SMF）最新版", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the latest Site Master File",
        action_zh: "檢附最新版 SMF",
        criteria: [
          "內容參照「製藥工廠基本資料（Site Master File）製備說明」（100.05.02 署授食字第1001100562號函）；非依該格式者，由代理商依 SMF 章節依序排列原製造廠資料。",
          "最新版中文或英文電子檔（或紙本）；每案必備。",
        ],
      },
      {
        key: "c1_name_address", label: "表C-1 *1.1 廠名、*1.2 廠址", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.1 廠名、*1.2 廠址",
        action_zh: "備妥表C-1 *1.1 廠名、*1.2 廠址",
        criteria: [
          "廠名與官方證明文件一致。",
          "廠址正確詳細且與官方證明文件一致；通訊地址與廠址不同時另行註明。",
        ],
      },
      {
        key: "c1_scope", label: "表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        action_zh: "備妥表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        criteria: [
          "由國內藥商填寫，並註明申請之製程階段。",
          "ATMPs／生物藥品／血漿衍生產品再說明品項／劑型及生產階段，並勾選：動物來源、過敏原、動物免疫血清、疫苗、基因重組、單株抗體、基因轉殖動物、基因轉殖植物、基因治療、體細胞與異體細胞治療及組織工程、血液產品。",
        ],
      },
      {
        key: "c1_special_scope", label: "表C-1 *1.4.2 申請劑型是否含特殊類別產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        action_zh: "備妥表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        criteria: [
          "說明是否限定或包含生物藥品、高致敏性、高活性、有毒或有害物質，例如 β-lactam（青黴素、頭孢子菌素、Penems、Carbacephem、Monobactams）、荷爾蒙（含性荷爾蒙、一般荷爾蒙）、Cytotoxic／Cytostatic 及放射性藥品。",
        ],
      },
      {
        key: "c1_phasing", label: "表C-1 *1.4.3 全程或分段生產、委外檢驗", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.3 全程或分段生產、委外檢驗",
        action_zh: "備妥表C-1 *1.4.3 全程或分段生產、委外檢驗",
        criteria: [
          "說明申請劑型之製造及檢驗為全程或分段；分段生產或委外檢驗者，分別說明廠內執行階段。",
        ],
      },
      {
        key: "c1_layout", label: "表C-1 *1.4.4 生產區平面圖", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.4 生產區平面圖",
        action_zh: "備妥表C-1 *1.4.4 生產區平面圖",
        criteria: [
          "由秤量至包裝作業，涵蓋人流、物流、空氣流向／壓差及潔淨度，並標示本次申請劑型所在區域。",
          "檢送申請劑型所有相關區域（含跨棟作業）之平面圖，例如膠囊劑涉及 A、D 兩棟者兩棟都要附〔113年研討會〕。",
        ],
      },
      {
        key: "c1_existing_approval", label: "表C-1 1.5 國內已核准劑型或引用之核准函", category: "pmf_form_c1", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Prepare 表C-1 1.5 國內已核准劑型或引用之核准函",
        action_zh: "備妥表C-1 1.5 國內已核准劑型或引用之核准函",
        criteria: [
          "申請商已持有該製造廠經本部核准之證明文件者，檢附影本。",
          "申請引用者，填寫引用之核准函劑型，並附該劑型及作業內容經本部核准之證明文件。",
        ],
      },
      {
        key: "c1_site_overview", label: "表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        action_zh: "備妥表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        criteria: [
          "1.6.1 簡述廠地面積、位置與周邊環境。",
          "*1.6.2 檢附全廠平面圖，說明各棟建築與各樓層用途，並標示本次申請劑型所在廠房與樓層。",
          "1.6.3 說明全廠委受託活動及合約。",
        ],
      },
      {
        key: "c1_local_license", label: "表C-1 1.7 出產國主管機關核准之藥廠作業項目", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 1.7 出產國主管機關核准之藥廠作業項目",
        action_zh: "備妥表C-1 1.7 出產國主管機關核准之藥廠作業項目",
        criteria: [
          "檢附官方文件影本，核准作業項目涵蓋本次申請劑型。",
        ],
      },
      {
        key: "c1_product_list", label: "表C-1 *1.8.1 全廠生產產品清單", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.1 全廠生產產品清單",
        action_zh: "備妥表C-1 *1.8.1 全廠生產產品清單",
        criteria: [
          "依劑型列出全廠製造及分包裝之各類產品（人用西藥、人用研究用藥品、動物用藥、醫療器材、化粧品、食品、草藥等），標示類別、主成分與生產廠房編號；屬1.8.2.1特殊產品者另註明。",
          "原廠資料非依劑型排列者，由代理商依劑型整理。",
        ],
      },
      {
        key: "c1_special_products", label: "表C-1 *1.8.2 廠內特殊產品與交叉汙染防止", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        action_zh: "備妥表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        criteria: [
          "勾選廠內生產之特殊產品類別（青黴素類、頭孢子菌素類、Penems、Carbacephem、Monobactams、Estrogen、性荷爾蒙、一般荷爾蒙（含固醇類）、具荷爾蒙活性產品、Cytotoxic、Cytostatic、生物藥品、放射線藥品等）並說明劑型；由代理商填寫者附原廠說明函正本。",
          "說明生產配置（獨立廠房、獨立生產區、共用生產區專用設備或共用設施設備），並於平面圖標示。",
          "共用生產區專用設備或共用設施設備者，附依品質風險管理（含 HBEL-PDE／ADE 效價與毒理評估）之交叉汙染防止措施說明或評估報告、有效性定期評估，以及清潔確效摘要（群組方式須說明分組、各組主成分及指標成分）。",
          "廠內未生產特殊產品者（1.8.2 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "c1_non_medicinal", label: "表C-1 *1.8.3 兼製非人用藥品或其他產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.3 兼製非人用藥品或其他產品",
        action_zh: "備妥表C-1 *1.8.3 兼製非人用藥品或其他產品",
        criteria: [
          "勾選兼製之動物用藥（人體可用／不可用）、食品、化粧品、醫療器材（藥典／非藥典成分）、草藥、順勢藥物、一般商品、飼料，並說明種類、劑型、組成與是否為人體可用成分，附佐證；代理商填寫者附原廠說明函正本。",
          "說明生產配置並於平面圖標示。",
          "共用生產區專用設備者：說明主成分是否為藥典收載（附依據）、是否採 PIC/S GMP（原廠聲明函），以及依品質風險管理之交叉汙染防止措施與定期評估。",
          "共用設施設備者：說明主成分是否為藥典收載或可作為藥品成分、交叉汙染防止措施；兼製非人體可用之動物用藥者，另附含 HBEL-PDE／ADE 毒理資料之風險評估，並列出共用設備清單與清潔確效摘要。",
          "未兼製者（1.8.3 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "sim_inspection_list", label: "簡化文件1：最近5年 GMP 查核清單", category: "pmf_mode", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 簡化文件1：最近5年 GMP 查核清單",
        action_zh: "備妥簡化文件1：最近5年 GMP 查核清單",
        criteria: [
          "列出最近5年接受當地及外國衛生主管機關之 GMP 查核，至少包括查核日期、查核主題與範疇。",
        ],
      },
      {
        key: "sim_inspection_report", label: "簡化文件2：最近一次當地主管機關實地查核報告及通過證明", category: "pmf_mode", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 簡化文件2：最近一次當地主管機關實地查核報告及通過證明",
        action_zh: "備妥簡化文件2：最近一次當地主管機關實地查核報告及通過證明",
        criteria: [
          "為最近一次接受當地衛生主管機關 GMP 實地查核之查廠報告，查核範圍涵蓋 PMF 申請劑型或作業內容。",
          "附原文查廠報告，及中文或英文之全文翻譯。",
          "附當次查廠通過之證明文件（如 GMP certificate）。",
        ],
      },
      {
        key: "sim_major_changes", label: "簡化文件3：查廠後至送件日之重大變更清單", category: "pmf_mode", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 簡化文件3：查廠後至送件日之重大變更清單",
        action_zh: "備妥簡化文件3：查廠後至送件日之重大變更清單",
        criteria: [
          "列出該次查廠至本案送件日期間，申請劑型／作業內容之重大變更事項（含廠房、設施、設備、製程）。",
        ],
      },
      {
        key: "pmf_c2", label: "表C-2 簡化審查查核表（無菌產品／生物產品）", category: "pmf_form_c", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-2 簡化審查查核表（無菌產品／生物產品）",
        action_zh: "備妥表C-2 簡化審查查核表（無菌產品／生物產品）",
        criteria: [
          "依表C-2 逐欄填寫並檢附資料；適用無菌產品、生物產品、生物原料藥（含宣稱非無菌或負荷菌管制者）及血液產品。",
          "依 PIC/S GMP Annex 1 增修內容：品質風險管理、汙染管制策略（CCS）、屏障系統（RABS）或隔離裝置之應用〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_c4", label: "表C-4 ATMPs／生物原料藥及產品查核表", category: "pmf_form_c", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-4 ATMPs／生物原料藥及產品查核表",
        action_zh: "備妥表C-4 ATMPs／生物原料藥及產品查核表",
        criteria: [
          "依表C-4 逐欄填寫；架構依 PIC/S GMP Annex 2：共同一般性項目，再分 Annex 2A（ATMPs）、Annex 2B（生物原料藥及產品）及 Annex 14（血漿衍生藥品）〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_c5", label: "表C-5 確效及驗證作業", category: "pmf_form_c", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-5 確效及驗證作業",
        action_zh: "備妥表C-5 確效及驗證作業",
        criteria: [
          "依表C-5 逐欄填寫並檢附確效及驗證資料。",
          "新版依 PIC/S GMP Annex 1 增修：品質風險管理（Annex 20）、汙染管制策略（CCS）之執行與定期評估〔113年研討會〕。",
          "以確效替代三文件減免者，本項標記「不適用」並寫明「採確效替代」。",
        ],
      },
      {
        key: "val_alternative", label: "確效替代三文件（減免表C-5）", category: "pmf_mode", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Prepare 確效替代三文件（減免表C-5）",
        action_zh: "備妥確效替代三文件（減免表C-5）",
        criteria: [
          "十大先進國或 EMA 核發之產品製售證明（CPP）正本或影本，於2年有效期限內。",
          "確效及驗證摘要說明：經廠內權責人員簽署之正本或數位簽章電子文件，涵蓋支援系統（空調、水及製程中氣體）確效、設施設備驗證、電腦化系統確效及清潔確效。",
          "原廠說明函：經廠內權責人員簽署之正本或數位簽章電子文件，載明認知本部有查廠之完全權力，必要時依國際慣例查廠。",
          "未採確效替代者，本項標記「不適用」並寫明原因。",
        ],
      },
    ],
  },
  pmf_quote_same: {
    display_name: "Foreign plant PMF — reference review, non-holder, same dosage forms",
    display_name_zh: "國外藥廠 PMF 引用：非原核准函持有者申請相同劑型／品項",
    deadline_default_days: 90,
    items: [
      {
        key: "pmf_a_form", label: "表A 申請國外藥廠工廠資料（PMF）審查送審表", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete Form A with the dosage forms, scope and review route",
        action_zh: "填妥表A 申請內容與申請方式",
        criteria: [
          "使用「國外藥廠工廠資料準備須知」表A（115.04.27 衛授食字第1151102225號函公告，表A 修訂日期113.05.24）〔準備須知115.04.27〕。",
          "填妥申請日期、申請藥商名稱與販賣業藥商許可執照編號、承辦人及聯絡方式，以及製造廠國別、廠名與廠址。",
          "申請內容依「西藥製造許可及GMP核定項目與作業內容之藥品劑型分類原則」完整填寫，例如「固體劑型：著衣錠（不含特定毒性及危害物質）」。",
          "每案限單一廠址、最多3個劑型／品項／作業內容；勾選本次申請範圍（不含特定毒性及危害物質，或青黴素類、頭孢子菌素、女性荷爾蒙類、細胞毒類等）。",
          "申請方式勾選（全套／簡化／確效替代／引用）與實際檢送資料一致。",
          "製造廠位於 PIC/S 會員國境內；非 PIC/S 會員國境內藥廠一律採國外實地查廠，MRA／MOU 範圍內藥廠依本署相關公告減免文件。",
          "引用：在原核准函（海外實地查廠、PMF 審查或定期檢查通過之核准函）效期內申請，免附簽證文件（表A 註6）。",
          "非 PIC/S 會員國境內藥廠亦可引用實地查核之核准函，申請相同劑型及相同效期之核准函（113.04.16 國外藥廠GMP管理溝通會議）。",
        ],
      },
      {
        key: "pmf_a_fee", label: "表A 審查費", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Pay the review fee",
        action_zh: "繳納審查費",
        criteria: [
          "依最新版「西藥查驗登記審查費收費標準」繳費；罕藥依「罕見疾病藥物查驗登記審查費收費標準」，且每個申請內容須附罕藥證明文件。",
          "每案最多3個劑型／品項／作業內容（即每案限增加二個）；案件經審查後審查費不予退費。",
          "補繳費時間併入廠商補件之90天期限〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_checklist", label: "表B 申請送審資料查檢表（逐項 Y／N／NA）", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Self-check every Form B item",
        action_zh: "逐項自我檢核表B",
        criteria: [
          "表B 各查檢項目逐項勾選 Y／N／NA，審查員審核欄留白；0. 來函視個案需求檢附。",
          "9. 資料格式符合準備須知：以線上申請平台送件為原則，正本留存於製造許可持有者處；電子文件可閱讀、可辨識且內容真實〔準備須知115.04.27〕。",
          "非英文之外文文件附中文或英文翻譯並確認正確；文件有工廠品保及各相關負責人簽名。",
          "倘檢附文件不實涉及刑事責任者，依刑法第214條移送司法機關。",
          "補件期限90天，以最後一次自行補件日結算；申復案不得補件或展延〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_site", label: "表B-1 單一廠址與廠名廠址一致性", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Match the site name and address to the latest local GMP certificate",
        action_zh: "核對廠名廠址與最新 GMP 證明一致",
        criteria: [
          "每案限申請單一廠址之製造工廠。",
          "表A 所填廠名與廠址，與當地衛生主管機關最新核發之 GMP 證明文件（或當地主管機關官網登記資訊）一致，並附佐證文件。",
        ],
      },
      {
        key: "pmf_b_auth", label: "表B-3 原廠授權函", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the manufacturer's letter of authorization",
        action_zh: "檢附原廠授權函正本",
        criteria: [
          "原廠授權送審藥商申請 PMF 審查之授權函正本或數位簽章正本電子檔；每案必備，內容要正確。",
        ],
      },
      {
        key: "pmf_b_quote_letter", label: "表B-3(1)-2 原廠同意引用前次送審資料說明函", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the manufacturer's letter agreeing to reference the previous dossier",
        action_zh: "檢附原廠同意引用說明函",
        criteria: [
          "原廠說明函正本或數位簽章正本電子檔，載明 (i) 同意參照前次送審之資料、(ii) 原核定編號。",
          "申請相同劑型／品項／作業內容者，免載前次申請迄今之變更情形（表B-3(1)-2）。",
        ],
      },
      {
        key: "pmf_b_holder_auth", label: "表B-3(3) 原 GMP 核准函持有者之授權文件", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the approval holder's authorization",
        action_zh: "檢附原核准函持有者授權文件",
        criteria: [
          "授權文件正本或數位簽章正本電子檔，載明欲引用核准函之公文號及前次送審案之案號。",
          "經原核准函持有者公司與負責人核章；經核符合者，本部核發效期相同之核准函並加註授權使用情形。",
        ],
      },
      {
        key: "pmf_b_prev_approval", label: "表B-6 前次核准之 GMP 核准函影本", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach a copy of the previous GMP approval letter",
        action_zh: "檢附原 GMP 核准函影本",
        criteria: [
          "檢附前次核准之 GMP 核准函影本（海外實地查廠、PMF 審查或定期檢查通過之核准函皆可引用）。",
          "須於原核准函效期內申請，並於表A 填寫欲引用核准函之核定編號與效期。",
        ],
      },
      {
        key: "pmf_b_smf", label: "表B-5 工廠基本資料（SMF）最新版", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the latest Site Master File",
        action_zh: "檢附最新版 SMF",
        criteria: [
          "內容參照「製藥工廠基本資料（Site Master File）製備說明」（100.05.02 署授食字第1001100562號函）；非依該格式者，由代理商依 SMF 章節依序排列原製造廠資料。",
          "最新版中文或英文電子檔（或紙本）；每案必備。",
        ],
      },
    ],
  },
  pmf_quote_holder_new: {
    display_name: "Foreign plant PMF — reference review, holder, additional dosage forms",
    display_name_zh: "國外藥廠 PMF 引用：原核准函持有者申請新增劑型／品項",
    deadline_default_days: 90,
    items: [
      {
        key: "pmf_a_form", label: "表A 申請國外藥廠工廠資料（PMF）審查送審表", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete Form A with the dosage forms, scope and review route",
        action_zh: "填妥表A 申請內容與申請方式",
        criteria: [
          "使用「國外藥廠工廠資料準備須知」表A（115.04.27 衛授食字第1151102225號函公告，表A 修訂日期113.05.24）〔準備須知115.04.27〕。",
          "填妥申請日期、申請藥商名稱與販賣業藥商許可執照編號、承辦人及聯絡方式，以及製造廠國別、廠名與廠址。",
          "申請內容依「西藥製造許可及GMP核定項目與作業內容之藥品劑型分類原則」完整填寫，例如「固體劑型：著衣錠（不含特定毒性及危害物質）」。",
          "每案限單一廠址、最多3個劑型／品項／作業內容；勾選本次申請範圍（不含特定毒性及危害物質，或青黴素類、頭孢子菌素、女性荷爾蒙類、細胞毒類等）。",
          "申請方式勾選（全套／簡化／確效替代／引用）與實際檢送資料一致。",
          "製造廠位於 PIC/S 會員國境內；非 PIC/S 會員國境內藥廠一律採國外實地查廠，MRA／MOU 範圍內藥廠依本署相關公告減免文件。",
          "引用：在原核准函（海外實地查廠、PMF 審查或定期檢查通過之核准函）效期內申請，免附簽證文件（表A 註6）。",
          "非 PIC/S 會員國境內藥廠於前次實地查廠核准函核發1年內，得引用申請新增劑型；無菌或生物製劑新增部分須與欲引用核准函之核定項目同生產線（108年國外藥廠GMP管理溝通決議）。",
        ],
      },
      {
        key: "pmf_a_fee", label: "表A 審查費", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Pay the review fee",
        action_zh: "繳納審查費",
        criteria: [
          "依最新版「西藥查驗登記審查費收費標準」繳費；罕藥依「罕見疾病藥物查驗登記審查費收費標準」，且每個申請內容須附罕藥證明文件。",
          "每案最多3個劑型／品項／作業內容（即每案限增加二個）；案件經審查後審查費不予退費。",
          "補繳費時間併入廠商補件之90天期限〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_checklist", label: "表B 申請送審資料查檢表（逐項 Y／N／NA）", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Self-check every Form B item",
        action_zh: "逐項自我檢核表B",
        criteria: [
          "表B 各查檢項目逐項勾選 Y／N／NA，審查員審核欄留白；0. 來函視個案需求檢附。",
          "9. 資料格式符合準備須知：以線上申請平台送件為原則，正本留存於製造許可持有者處；電子文件可閱讀、可辨識且內容真實〔準備須知115.04.27〕。",
          "非英文之外文文件附中文或英文翻譯並確認正確；文件有工廠品保及各相關負責人簽名。",
          "倘檢附文件不實涉及刑事責任者，依刑法第214條移送司法機關。",
          "補件期限90天，以最後一次自行補件日結算；申復案不得補件或展延〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_site", label: "表B-1 單一廠址與廠名廠址一致性", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Match the site name and address to the latest local GMP certificate",
        action_zh: "核對廠名廠址與最新 GMP 證明一致",
        criteria: [
          "每案限申請單一廠址之製造工廠。",
          "表A 所填廠名與廠址，與當地衛生主管機關最新核發之 GMP 證明文件（或當地主管機關官網登記資訊）一致，並附佐證文件。",
        ],
      },
      {
        key: "pmf_b_cforms", label: "表B-2 國外藥廠工廠資料查核表（表C）之填寫與簽署", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete and sign the Form C checklists with page references",
        action_zh: "填寫並簽署表C，標註頁碼",
        criteria: [
          "表C 依申請劑型、品項、作業內容填寫，並一併檢附查核表所要求之資料與文件。",
          "查核表填寫完整，並有代理商或原廠品保／相關人員簽名正本或數位簽章正本電子檔（含簽署日期）。",
          "於表中註明各審查項目所對應送審資料之頁碼或附件；文件排列編碼標示清楚、能與表C 對應〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_auth", label: "表B-3 原廠授權函", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the manufacturer's letter of authorization",
        action_zh: "檢附原廠授權函正本",
        criteria: [
          "原廠授權送審藥商申請 PMF 審查之授權函正本或數位簽章正本電子檔；每案必備，內容要正確。",
        ],
      },
      {
        key: "pmf_b_quote_letter", label: "表B-3(1)-2 原廠同意引用前次送審資料說明函", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the manufacturer's letter agreeing to reference the previous dossier",
        action_zh: "檢附原廠同意引用說明函",
        criteria: [
          "原廠說明函正本或數位簽章正本電子檔，載明 (i) 同意參照前次送審之資料、(ii) 原核定編號。",
          "並載明 (iii) 前次申請迄今之變更情形。",
        ],
      },
      {
        key: "pmf_b_prev_approval", label: "表B-6 前次核准之 GMP 核准函影本", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach a copy of the previous GMP approval letter",
        action_zh: "檢附原 GMP 核准函影本",
        criteria: [
          "檢附前次核准之 GMP 核准函影本（海外實地查廠、PMF 審查或定期檢查通過之核准函皆可引用）。",
          "須於原核准函效期內申請，並於表A 填寫欲引用核准函之核定編號與效期。",
        ],
      },
      {
        key: "pmf_b_smf", label: "表B-5 工廠基本資料（SMF）最新版", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the latest Site Master File",
        action_zh: "檢附最新版 SMF",
        criteria: [
          "內容參照「製藥工廠基本資料（Site Master File）製備說明」（100.05.02 署授食字第1001100562號函）；非依該格式者，由代理商依 SMF 章節依序排列原製造廠資料。",
          "最新版中文或英文電子檔（或紙本）；每案必備。",
        ],
      },
      {
        key: "c1_name_address", label: "表C-1 *1.1 廠名、*1.2 廠址", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.1 廠名、*1.2 廠址",
        action_zh: "備妥表C-1 *1.1 廠名、*1.2 廠址",
        criteria: [
          "廠名與官方證明文件一致。",
          "廠址正確詳細且與官方證明文件一致；通訊地址與廠址不同時另行註明。",
        ],
      },
      {
        key: "c1_scope", label: "表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        action_zh: "備妥表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        criteria: [
          "由國內藥商填寫，並註明申請之製程階段。",
        ],
      },
      {
        key: "c1_special_scope", label: "表C-1 *1.4.2 申請劑型是否含特殊類別產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        action_zh: "備妥表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        criteria: [
          "說明是否限定或包含生物藥品、高致敏性、高活性、有毒或有害物質，例如 β-lactam（青黴素、頭孢子菌素、Penems、Carbacephem、Monobactams）、荷爾蒙（含性荷爾蒙、一般荷爾蒙）、Cytotoxic／Cytostatic 及放射性藥品。",
        ],
      },
      {
        key: "c1_phasing", label: "表C-1 *1.4.3 全程或分段生產、委外檢驗", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.3 全程或分段生產、委外檢驗",
        action_zh: "備妥表C-1 *1.4.3 全程或分段生產、委外檢驗",
        criteria: [
          "說明申請劑型之製造及檢驗為全程或分段；分段生產或委外檢驗者，分別說明廠內執行階段。",
        ],
      },
      {
        key: "c1_layout", label: "表C-1 *1.4.4 生產區平面圖", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.4 生產區平面圖",
        action_zh: "備妥表C-1 *1.4.4 生產區平面圖",
        criteria: [
          "由秤量至包裝作業，涵蓋人流、物流、空氣流向／壓差及潔淨度，並標示本次申請劑型所在區域。",
          "檢送申請劑型所有相關區域（含跨棟作業）之平面圖，例如膠囊劑涉及 A、D 兩棟者兩棟都要附〔113年研討會〕。",
        ],
      },
      {
        key: "c1_existing_approval", label: "表C-1 1.5 國內已核准劑型或引用之核准函", category: "pmf_form_c1", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Prepare 表C-1 1.5 國內已核准劑型或引用之核准函",
        action_zh: "備妥表C-1 1.5 國內已核准劑型或引用之核准函",
        criteria: [
          "申請商已持有該製造廠經本部核准之證明文件者，檢附影本。",
          "申請引用者，填寫引用之核准函劑型，並附該劑型及作業內容經本部核准之證明文件。",
        ],
      },
      {
        key: "c1_site_overview", label: "表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        action_zh: "備妥表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        criteria: [
          "1.6.1 簡述廠地面積、位置與周邊環境。",
          "*1.6.2 檢附全廠平面圖，說明各棟建築與各樓層用途，並標示本次申請劑型所在廠房與樓層。",
          "1.6.3 說明全廠委受託活動及合約。",
        ],
      },
      {
        key: "c1_local_license", label: "表C-1 1.7 出產國主管機關核准之藥廠作業項目", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 1.7 出產國主管機關核准之藥廠作業項目",
        action_zh: "備妥表C-1 1.7 出產國主管機關核准之藥廠作業項目",
        criteria: [
          "檢附官方文件影本，核准作業項目涵蓋本次申請劑型。",
        ],
      },
      {
        key: "c1_product_list", label: "表C-1 *1.8.1 全廠生產產品清單", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.1 全廠生產產品清單",
        action_zh: "備妥表C-1 *1.8.1 全廠生產產品清單",
        criteria: [
          "依劑型列出全廠製造及分包裝之各類產品（人用西藥、人用研究用藥品、動物用藥、醫療器材、化粧品、食品、草藥等），標示類別、主成分與生產廠房編號；屬1.8.2.1特殊產品者另註明。",
          "原廠資料非依劑型排列者，由代理商依劑型整理。",
        ],
      },
      {
        key: "c1_special_products", label: "表C-1 *1.8.2 廠內特殊產品與交叉汙染防止", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        action_zh: "備妥表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        criteria: [
          "勾選廠內生產之特殊產品類別（青黴素類、頭孢子菌素類、Penems、Carbacephem、Monobactams、Estrogen、性荷爾蒙、一般荷爾蒙（含固醇類）、具荷爾蒙活性產品、Cytotoxic、Cytostatic、生物藥品、放射線藥品等）並說明劑型；由代理商填寫者附原廠說明函正本。",
          "說明生產配置（獨立廠房、獨立生產區、共用生產區專用設備或共用設施設備），並於平面圖標示。",
          "共用生產區專用設備或共用設施設備者，附依品質風險管理（含 HBEL-PDE／ADE 效價與毒理評估）之交叉汙染防止措施說明或評估報告、有效性定期評估，以及清潔確效摘要（群組方式須說明分組、各組主成分及指標成分）。",
          "廠內未生產特殊產品者（1.8.2 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "c1_non_medicinal", label: "表C-1 *1.8.3 兼製非人用藥品或其他產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.3 兼製非人用藥品或其他產品",
        action_zh: "備妥表C-1 *1.8.3 兼製非人用藥品或其他產品",
        criteria: [
          "勾選兼製之動物用藥（人體可用／不可用）、食品、化粧品、醫療器材（藥典／非藥典成分）、草藥、順勢藥物、一般商品、飼料，並說明種類、劑型、組成與是否為人體可用成分，附佐證；代理商填寫者附原廠說明函正本。",
          "說明生產配置並於平面圖標示。",
          "共用生產區專用設備者：說明主成分是否為藥典收載（附依據）、是否採 PIC/S GMP（原廠聲明函），以及依品質風險管理之交叉汙染防止措施與定期評估。",
          "共用設施設備者：說明主成分是否為藥典收載或可作為藥品成分、交叉汙染防止措施；兼製非人體可用之動物用藥者，另附含 HBEL-PDE／ADE 毒理資料之風險評估，並列出共用設備清單與清潔確效摘要。",
          "未兼製者（1.8.3 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "pmf_c_tech", label: "表C-2～C-5（視申請劑型／品項檢送對應資料）", category: "pmf_form_c", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-2～C-5（視申請劑型／品項檢送對應資料）",
        action_zh: "備妥表C-2～C-5（視申請劑型／品項檢送對應資料）",
        criteria: [
          "依申請劑型／品項類別，檢送對應之表C-2、C-3、C-4、C-5 及資料（表A 註4）。",
          "申請之劑型／品項製程較原核准內容複雜者，本署得要求補送相關資料（表A 註3）。",
        ],
      },
    ],
  },
  pmf_quote_nonholder_diff: {
    display_name: "Foreign plant PMF — reference review, non-holder, different dosage forms",
    display_name_zh: "國外藥廠 PMF 引用：非原核准函持有者申請不同劑型／品項",
    deadline_default_days: 90,
    items: [
      {
        key: "pmf_a_form", label: "表A 申請國外藥廠工廠資料（PMF）審查送審表", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete Form A with the dosage forms, scope and review route",
        action_zh: "填妥表A 申請內容與申請方式",
        criteria: [
          "使用「國外藥廠工廠資料準備須知」表A（115.04.27 衛授食字第1151102225號函公告，表A 修訂日期113.05.24）〔準備須知115.04.27〕。",
          "填妥申請日期、申請藥商名稱與販賣業藥商許可執照編號、承辦人及聯絡方式，以及製造廠國別、廠名與廠址。",
          "申請內容依「西藥製造許可及GMP核定項目與作業內容之藥品劑型分類原則」完整填寫，例如「固體劑型：著衣錠（不含特定毒性及危害物質）」。",
          "每案限單一廠址、最多3個劑型／品項／作業內容；勾選本次申請範圍（不含特定毒性及危害物質，或青黴素類、頭孢子菌素、女性荷爾蒙類、細胞毒類等）。",
          "申請方式勾選（全套／簡化／確效替代／引用）與實際檢送資料一致。",
          "製造廠位於 PIC/S 會員國境內；非 PIC/S 會員國境內藥廠一律採國外實地查廠，MRA／MOU 範圍內藥廠依本署相關公告減免文件。",
          "引用：在原核准函（海外實地查廠、PMF 審查或定期檢查通過之核准函）效期內申請，免附簽證文件（表A 註6）。",
        ],
      },
      {
        key: "pmf_a_fee", label: "表A 審查費", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Pay the review fee",
        action_zh: "繳納審查費",
        criteria: [
          "依最新版「西藥查驗登記審查費收費標準」繳費；罕藥依「罕見疾病藥物查驗登記審查費收費標準」，且每個申請內容須附罕藥證明文件。",
          "每案最多3個劑型／品項／作業內容（即每案限增加二個）；案件經審查後審查費不予退費。",
          "補繳費時間併入廠商補件之90天期限〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_checklist", label: "表B 申請送審資料查檢表（逐項 Y／N／NA）", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Self-check every Form B item",
        action_zh: "逐項自我檢核表B",
        criteria: [
          "表B 各查檢項目逐項勾選 Y／N／NA，審查員審核欄留白；0. 來函視個案需求檢附。",
          "9. 資料格式符合準備須知：以線上申請平台送件為原則，正本留存於製造許可持有者處；電子文件可閱讀、可辨識且內容真實〔準備須知115.04.27〕。",
          "非英文之外文文件附中文或英文翻譯並確認正確；文件有工廠品保及各相關負責人簽名。",
          "倘檢附文件不實涉及刑事責任者，依刑法第214條移送司法機關。",
          "補件期限90天，以最後一次自行補件日結算；申復案不得補件或展延〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_site", label: "表B-1 單一廠址與廠名廠址一致性", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Match the site name and address to the latest local GMP certificate",
        action_zh: "核對廠名廠址與最新 GMP 證明一致",
        criteria: [
          "每案限申請單一廠址之製造工廠。",
          "表A 所填廠名與廠址，與當地衛生主管機關最新核發之 GMP 證明文件（或當地主管機關官網登記資訊）一致，並附佐證文件。",
        ],
      },
      {
        key: "pmf_b_cforms", label: "表B-2 國外藥廠工廠資料查核表（表C）之填寫與簽署", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete and sign the Form C checklists with page references",
        action_zh: "填寫並簽署表C，標註頁碼",
        criteria: [
          "表C 依申請劑型、品項、作業內容填寫，並一併檢附查核表所要求之資料與文件。",
          "查核表填寫完整，並有代理商或原廠品保／相關人員簽名正本或數位簽章正本電子檔（含簽署日期）。",
          "於表中註明各審查項目所對應送審資料之頁碼或附件；文件排列編碼標示清楚、能與表C 對應〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_auth", label: "表B-3 原廠授權函", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the manufacturer's letter of authorization",
        action_zh: "檢附原廠授權函正本",
        criteria: [
          "原廠授權送審藥商申請 PMF 審查之授權函正本或數位簽章正本電子檔；每案必備，內容要正確。",
        ],
      },
      {
        key: "pmf_b_quote_letter", label: "表B-3(1)-2 原廠同意引用前次送審資料說明函", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the manufacturer's letter agreeing to reference the previous dossier",
        action_zh: "檢附原廠同意引用說明函",
        criteria: [
          "原廠說明函正本或數位簽章正本電子檔，載明 (i) 同意參照前次送審之資料、(ii) 原核定編號。",
          "並載明 (iii) 前次申請迄今之變更情形。",
        ],
      },
      {
        key: "pmf_b_holder_auth", label: "表B-3(3) 原 GMP 核准函持有者之授權文件", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the approval holder's authorization",
        action_zh: "檢附原核准函持有者授權文件",
        criteria: [
          "授權文件正本或數位簽章正本電子檔，載明欲引用核准函之公文號及前次送審案之案號。",
          "經原核准函持有者公司與負責人核章；經核符合者，本部核發效期相同之核准函並加註授權使用情形。",
        ],
      },
      {
        key: "pmf_b_prev_approval", label: "表B-6 前次核准之 GMP 核准函影本", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach a copy of the previous GMP approval letter",
        action_zh: "檢附原 GMP 核准函影本",
        criteria: [
          "檢附前次核准之 GMP 核准函影本（海外實地查廠、PMF 審查或定期檢查通過之核准函皆可引用）。",
          "須於原核准函效期內申請，並於表A 填寫欲引用核准函之核定編號與效期。",
        ],
      },
      {
        key: "pmf_b_smf", label: "表B-5 工廠基本資料（SMF）最新版", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the latest Site Master File",
        action_zh: "檢附最新版 SMF",
        criteria: [
          "內容參照「製藥工廠基本資料（Site Master File）製備說明」（100.05.02 署授食字第1001100562號函）；非依該格式者，由代理商依 SMF 章節依序排列原製造廠資料。",
          "最新版中文或英文電子檔（或紙本）；每案必備。",
        ],
      },
      {
        key: "c1_name_address", label: "表C-1 *1.1 廠名、*1.2 廠址", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.1 廠名、*1.2 廠址",
        action_zh: "備妥表C-1 *1.1 廠名、*1.2 廠址",
        criteria: [
          "廠名與官方證明文件一致。",
          "廠址正確詳細且與官方證明文件一致；通訊地址與廠址不同時另行註明。",
        ],
      },
      {
        key: "c1_scope", label: "表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        action_zh: "備妥表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        criteria: [
          "由國內藥商填寫，並註明申請之製程階段。",
        ],
      },
      {
        key: "c1_special_scope", label: "表C-1 *1.4.2 申請劑型是否含特殊類別產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        action_zh: "備妥表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        criteria: [
          "說明是否限定或包含生物藥品、高致敏性、高活性、有毒或有害物質，例如 β-lactam（青黴素、頭孢子菌素、Penems、Carbacephem、Monobactams）、荷爾蒙（含性荷爾蒙、一般荷爾蒙）、Cytotoxic／Cytostatic 及放射性藥品。",
        ],
      },
      {
        key: "c1_phasing", label: "表C-1 *1.4.3 全程或分段生產、委外檢驗", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.3 全程或分段生產、委外檢驗",
        action_zh: "備妥表C-1 *1.4.3 全程或分段生產、委外檢驗",
        criteria: [
          "說明申請劑型之製造及檢驗為全程或分段；分段生產或委外檢驗者，分別說明廠內執行階段。",
        ],
      },
      {
        key: "c1_layout", label: "表C-1 *1.4.4 生產區平面圖", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.4 生產區平面圖",
        action_zh: "備妥表C-1 *1.4.4 生產區平面圖",
        criteria: [
          "由秤量至包裝作業，涵蓋人流、物流、空氣流向／壓差及潔淨度，並標示本次申請劑型所在區域。",
          "檢送申請劑型所有相關區域（含跨棟作業）之平面圖，例如膠囊劑涉及 A、D 兩棟者兩棟都要附〔113年研討會〕。",
        ],
      },
      {
        key: "c1_existing_approval", label: "表C-1 1.5 國內已核准劑型或引用之核准函", category: "pmf_form_c1", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Prepare 表C-1 1.5 國內已核准劑型或引用之核准函",
        action_zh: "備妥表C-1 1.5 國內已核准劑型或引用之核准函",
        criteria: [
          "申請商已持有該製造廠經本部核准之證明文件者，檢附影本。",
          "申請引用者，填寫引用之核准函劑型，並附該劑型及作業內容經本部核准之證明文件。",
        ],
      },
      {
        key: "c1_site_overview", label: "表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        action_zh: "備妥表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        criteria: [
          "1.6.1 簡述廠地面積、位置與周邊環境。",
          "*1.6.2 檢附全廠平面圖，說明各棟建築與各樓層用途，並標示本次申請劑型所在廠房與樓層。",
          "1.6.3 說明全廠委受託活動及合約。",
        ],
      },
      {
        key: "c1_local_license", label: "表C-1 1.7 出產國主管機關核准之藥廠作業項目", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 1.7 出產國主管機關核准之藥廠作業項目",
        action_zh: "備妥表C-1 1.7 出產國主管機關核准之藥廠作業項目",
        criteria: [
          "檢附官方文件影本，核准作業項目涵蓋本次申請劑型。",
        ],
      },
      {
        key: "c1_product_list", label: "表C-1 *1.8.1 全廠生產產品清單", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.1 全廠生產產品清單",
        action_zh: "備妥表C-1 *1.8.1 全廠生產產品清單",
        criteria: [
          "依劑型列出全廠製造及分包裝之各類產品（人用西藥、人用研究用藥品、動物用藥、醫療器材、化粧品、食品、草藥等），標示類別、主成分與生產廠房編號；屬1.8.2.1特殊產品者另註明。",
          "原廠資料非依劑型排列者，由代理商依劑型整理。",
        ],
      },
      {
        key: "c1_special_products", label: "表C-1 *1.8.2 廠內特殊產品與交叉汙染防止", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        action_zh: "備妥表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        criteria: [
          "勾選廠內生產之特殊產品類別（青黴素類、頭孢子菌素類、Penems、Carbacephem、Monobactams、Estrogen、性荷爾蒙、一般荷爾蒙（含固醇類）、具荷爾蒙活性產品、Cytotoxic、Cytostatic、生物藥品、放射線藥品等）並說明劑型；由代理商填寫者附原廠說明函正本。",
          "說明生產配置（獨立廠房、獨立生產區、共用生產區專用設備或共用設施設備），並於平面圖標示。",
          "共用生產區專用設備或共用設施設備者，附依品質風險管理（含 HBEL-PDE／ADE 效價與毒理評估）之交叉汙染防止措施說明或評估報告、有效性定期評估，以及清潔確效摘要（群組方式須說明分組、各組主成分及指標成分）。",
          "廠內未生產特殊產品者（1.8.2 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "c1_non_medicinal", label: "表C-1 *1.8.3 兼製非人用藥品或其他產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.3 兼製非人用藥品或其他產品",
        action_zh: "備妥表C-1 *1.8.3 兼製非人用藥品或其他產品",
        criteria: [
          "勾選兼製之動物用藥（人體可用／不可用）、食品、化粧品、醫療器材（藥典／非藥典成分）、草藥、順勢藥物、一般商品、飼料，並說明種類、劑型、組成與是否為人體可用成分，附佐證；代理商填寫者附原廠說明函正本。",
          "說明生產配置並於平面圖標示。",
          "共用生產區專用設備者：說明主成分是否為藥典收載（附依據）、是否採 PIC/S GMP（原廠聲明函），以及依品質風險管理之交叉汙染防止措施與定期評估。",
          "共用設施設備者：說明主成分是否為藥典收載或可作為藥品成分、交叉汙染防止措施；兼製非人體可用之動物用藥者，另附含 HBEL-PDE／ADE 毒理資料之風險評估，並列出共用設備清單與清潔確效摘要。",
          "未兼製者（1.8.3 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "pmf_c_tech", label: "表C-2～C-5（視申請劑型／品項檢送對應資料）", category: "pmf_form_c", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-2～C-5（視申請劑型／品項檢送對應資料）",
        action_zh: "備妥表C-2～C-5（視申請劑型／品項檢送對應資料）",
        criteria: [
          "依申請劑型／品項類別，檢送對應之表C-2、C-3、C-4、C-5 及資料（表A 註4）。",
          "申請之劑型／品項製程較原核准內容複雜者，本署得要求補送相關資料（表A 註3）。",
        ],
      },
    ],
  },
  pmf_expansion: {
    display_name: "Foreign plant PMF — plant expansion",
    display_name_zh: "國外藥廠 PMF：擴建廠房",
    deadline_default_days: 90,
    items: [
      {
        key: "pmf_a_form", label: "表A 申請國外藥廠工廠資料（PMF）審查送審表", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete Form A with the dosage forms, scope and review route",
        action_zh: "填妥表A 申請內容與申請方式",
        criteria: [
          "使用「國外藥廠工廠資料準備須知」表A（115.04.27 衛授食字第1151102225號函公告，表A 修訂日期113.05.24）〔準備須知115.04.27〕。",
          "填妥申請日期、申請藥商名稱與販賣業藥商許可執照編號、承辦人及聯絡方式，以及製造廠國別、廠名與廠址。",
          "申請內容依「西藥製造許可及GMP核定項目與作業內容之藥品劑型分類原則」完整填寫，例如「固體劑型：著衣錠（不含特定毒性及危害物質）」。",
          "每案限單一廠址、最多3個劑型／品項／作業內容；勾選本次申請範圍（不含特定毒性及危害物質，或青黴素類、頭孢子菌素、女性荷爾蒙類、細胞毒類等）。",
          "申請方式勾選（全套／簡化／確效替代／引用）與實際檢送資料一致。",
          "製造廠位於 PIC/S 會員國境內；非 PIC/S 會員國境內藥廠一律採國外實地查廠，MRA／MOU 範圍內藥廠依本署相關公告減免文件。",
          "勾選「擴廠」，並填寫擴廠位置（如棟別名稱）及涉及之原核定內容（表A 註2）；擴建廠房審查免附簽證文件。",
        ],
      },
      {
        key: "pmf_a_fee", label: "表A 審查費", category: "pmf_form_a", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Pay the review fee",
        action_zh: "繳納審查費",
        criteria: [
          "依最新版「西藥查驗登記審查費收費標準」繳費；罕藥依「罕見疾病藥物查驗登記審查費收費標準」，且每個申請內容須附罕藥證明文件。",
          "每案最多3個劑型／品項／作業內容（即每案限增加二個）；案件經審查後審查費不予退費。",
          "補繳費時間併入廠商補件之90天期限〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_checklist", label: "表B 申請送審資料查檢表（逐項 Y／N／NA）", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Self-check every Form B item",
        action_zh: "逐項自我檢核表B",
        criteria: [
          "表B 各查檢項目逐項勾選 Y／N／NA，審查員審核欄留白；0. 來函視個案需求檢附。",
          "9. 資料格式符合準備須知：以線上申請平台送件為原則，正本留存於製造許可持有者處；電子文件可閱讀、可辨識且內容真實〔準備須知115.04.27〕。",
          "非英文之外文文件附中文或英文翻譯並確認正確；文件有工廠品保及各相關負責人簽名。",
          "倘檢附文件不實涉及刑事責任者，依刑法第214條移送司法機關。",
          "補件期限90天，以最後一次自行補件日結算；申復案不得補件或展延〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_site", label: "表B-1 單一廠址與廠名廠址一致性", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Match the site name and address to the latest local GMP certificate",
        action_zh: "核對廠名廠址與最新 GMP 證明一致",
        criteria: [
          "每案限申請單一廠址之製造工廠。",
          "表A 所填廠名與廠址，與當地衛生主管機關最新核發之 GMP 證明文件（或當地主管機關官網登記資訊）一致，並附佐證文件。",
        ],
      },
      {
        key: "pmf_b_cforms", label: "表B-2 國外藥廠工廠資料查核表（表C）之填寫與簽署", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete and sign the Form C checklists with page references",
        action_zh: "填寫並簽署表C，標註頁碼",
        criteria: [
          "擴建廠房：依全套或簡化方式檢送表A、表B、表C，表C 只需填寫標示「*」之欄位並檢附對應文件。",
          "表C 依申請劑型、品項、作業內容填寫，並一併檢附查核表所要求之資料與文件。",
          "查核表填寫完整，並有代理商或原廠品保／相關人員簽名正本或數位簽章正本電子檔（含簽署日期）。",
          "於表中註明各審查項目所對應送審資料之頁碼或附件；文件排列編碼標示清楚、能與表C 對應〔113年研討會〕。",
        ],
      },
      {
        key: "pmf_b_auth", label: "表B-3 原廠授權函", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the manufacturer's letter of authorization",
        action_zh: "檢附原廠授權函正本",
        criteria: [
          "原廠授權送審藥商申請 PMF 審查之授權函正本或數位簽章正本電子檔；每案必備，內容要正確。",
        ],
      },
      {
        key: "pmf_b_prev_approval", label: "表B-6 前次核准之 GMP 核准函影本", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach a copy of the previous GMP approval letter",
        action_zh: "檢附原 GMP 核准函影本",
        criteria: [
          "檢附欲申請擴建廠房之劑型之原 GMP 核准函影本。",
        ],
      },
      {
        key: "pmf_b_smf", label: "表B-5 工廠基本資料（SMF）最新版", category: "pmf_form_b", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Attach the latest Site Master File",
        action_zh: "檢附最新版 SMF",
        criteria: [
          "內容參照「製藥工廠基本資料（Site Master File）製備說明」（100.05.02 署授食字第1001100562號函）；非依該格式者，由代理商依 SMF 章節依序排列原製造廠資料。",
          "最新版中文或英文電子檔（或紙本）；每案必備。",
        ],
      },
      {
        key: "c1_name_address", label: "表C-1 *1.1 廠名、*1.2 廠址", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.1 廠名、*1.2 廠址",
        action_zh: "備妥表C-1 *1.1 廠名、*1.2 廠址",
        criteria: [
          "廠名與官方證明文件一致。",
          "廠址正確詳細且與官方證明文件一致；通訊地址與廠址不同時另行註明。",
        ],
      },
      {
        key: "c1_scope", label: "表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        action_zh: "備妥表C-1 *1.4.1 申請劑型／品項／作業內容及製程階段",
        criteria: [
          "由國內藥商填寫，並註明申請之製程階段。",
        ],
      },
      {
        key: "c1_special_scope", label: "表C-1 *1.4.2 申請劑型是否含特殊類別產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        action_zh: "備妥表C-1 *1.4.2 申請劑型是否含特殊類別產品",
        criteria: [
          "說明是否限定或包含生物藥品、高致敏性、高活性、有毒或有害物質，例如 β-lactam（青黴素、頭孢子菌素、Penems、Carbacephem、Monobactams）、荷爾蒙（含性荷爾蒙、一般荷爾蒙）、Cytotoxic／Cytostatic 及放射性藥品。",
        ],
      },
      {
        key: "c1_phasing", label: "表C-1 *1.4.3 全程或分段生產、委外檢驗", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.3 全程或分段生產、委外檢驗",
        action_zh: "備妥表C-1 *1.4.3 全程或分段生產、委外檢驗",
        criteria: [
          "說明申請劑型之製造及檢驗為全程或分段；分段生產或委外檢驗者，分別說明廠內執行階段。",
        ],
      },
      {
        key: "c1_layout", label: "表C-1 *1.4.4 生產區平面圖", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.4.4 生產區平面圖",
        action_zh: "備妥表C-1 *1.4.4 生產區平面圖",
        criteria: [
          "由秤量至包裝作業，涵蓋人流、物流、空氣流向／壓差及潔淨度，並標示本次申請劑型所在區域。",
          "檢送申請劑型所有相關區域（含跨棟作業）之平面圖，例如膠囊劑涉及 A、D 兩棟者兩棟都要附〔113年研討會〕。",
        ],
      },
      {
        key: "c1_site_overview", label: "表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        action_zh: "備妥表C-1 1.6 藥廠概況（*1.6.2 全廠平面圖）",
        criteria: [
          "*1.6.2 檢附全廠平面圖，說明各棟建築與各樓層用途，並標示本次申請劑型所在廠房與樓層。",
        ],
      },
      {
        key: "c1_product_list", label: "表C-1 *1.8.1 全廠生產產品清單", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.1 全廠生產產品清單",
        action_zh: "備妥表C-1 *1.8.1 全廠生產產品清單",
        criteria: [
          "依劑型列出全廠製造及分包裝之各類產品（人用西藥、人用研究用藥品、動物用藥、醫療器材、化粧品、食品、草藥等），標示類別、主成分與生產廠房編號；屬1.8.2.1特殊產品者另註明。",
          "原廠資料非依劑型排列者，由代理商依劑型整理。",
        ],
      },
      {
        key: "c1_special_products", label: "表C-1 *1.8.2 廠內特殊產品與交叉汙染防止", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        action_zh: "備妥表C-1 *1.8.2 廠內特殊產品與交叉汙染防止",
        criteria: [
          "勾選廠內生產之特殊產品類別（青黴素類、頭孢子菌素類、Penems、Carbacephem、Monobactams、Estrogen、性荷爾蒙、一般荷爾蒙（含固醇類）、具荷爾蒙活性產品、Cytotoxic、Cytostatic、生物藥品、放射線藥品等）並說明劑型；由代理商填寫者附原廠說明函正本。",
          "說明生產配置（獨立廠房、獨立生產區、共用生產區專用設備或共用設施設備），並於平面圖標示。",
          "共用生產區專用設備或共用設施設備者，附依品質風險管理（含 HBEL-PDE／ADE 效價與毒理評估）之交叉汙染防止措施說明或評估報告、有效性定期評估，以及清潔確效摘要（群組方式須說明分組、各組主成分及指標成分）。",
          "廠內未生產特殊產品者（1.8.2 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "c1_non_medicinal", label: "表C-1 *1.8.3 兼製非人用藥品或其他產品", category: "pmf_form_c1", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 表C-1 *1.8.3 兼製非人用藥品或其他產品",
        action_zh: "備妥表C-1 *1.8.3 兼製非人用藥品或其他產品",
        criteria: [
          "勾選兼製之動物用藥（人體可用／不可用）、食品、化粧品、醫療器材（藥典／非藥典成分）、草藥、順勢藥物、一般商品、飼料，並說明種類、劑型、組成與是否為人體可用成分，附佐證；代理商填寫者附原廠說明函正本。",
          "說明生產配置並於平面圖標示。",
          "共用生產區專用設備者：說明主成分是否為藥典收載（附依據）、是否採 PIC/S GMP（原廠聲明函），以及依品質風險管理之交叉汙染防止措施與定期評估。",
          "共用設施設備者：說明主成分是否為藥典收載或可作為藥品成分、交叉汙染防止措施；兼製非人體可用之動物用藥者，另附含 HBEL-PDE／ADE 毒理資料之風險評估，並列出共用設備清單與清潔確效摘要。",
          "未兼製者（1.8.3 答 N），本項標記「不適用」並寫明原因。",
        ],
      },
    ],
  },
  gmp_onsite_inspection: {
    display_name: "Foreign plant GMP on-site inspection application",
    display_name_zh: "國外藥廠 GMP 實地查核申請（非 PIC/S 會員國等）",
    deadline_default_days: 90,
    items: [
      {
        key: "on_letter", label: "申請公文", category: "gmp_onsite", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 申請公文",
        action_zh: "備妥申請公文",
        criteria: [
          "新申請案（新劑型／生物原料藥品項／遷廠／擴廠）與定期檢查均須檢附；多家代理商併案者說明代表申請之代理商。",
          "非 PIC/S 會員國境內之藥廠新申請案一律採海外實地查廠；PIC/S 會員國藥廠得選擇 PMF 書面審查或海外查廠〔113年研討會〕。",
        ],
      },
      {
        key: "on_form", label: "輸入藥品國外製造廠實地查核申請表", category: "gmp_onsite", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 輸入藥品國外製造廠實地查核申請表",
        action_zh: "備妥輸入藥品國外製造廠實地查核申請表",
        criteria: [
          "新申請案限2個劑型／生物原料藥品項／作業內容，並列出代表性產品；定期檢查每廠1案，1廠多家代理商併1案申請。",
          "劑型依107.06.11 衛授食字第1071103236號函「西藥製造許可及GMP核定項目與作業內容之藥品劑型分類原則」填寫。",
        ],
      },
      {
        key: "on_registration", label: "查驗登記申請書影本或案號（遷廠附許可證變更申請書）", category: "gmp_onsite", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 查驗登記申請書影本或案號（遷廠附許可證變更申請書）",
        action_zh: "備妥查驗登記申請書影本或案號（遷廠附許可證變更申請書）",
        criteria: [
          "新申請案須檢附；收案原則為已申請查驗登記，遷廠者附許可證變更申請書。",
        ],
      },
      {
        key: "on_mfr_letter", label: "原廠說明函正本", category: "gmp_onsite", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 原廠說明函正本",
        action_zh: "備妥原廠說明函正本",
        criteria: [
          "載明申請說明、代理商資訊、申請內容與排程等；新藥、罕藥及遷廠尤須說明。",
        ],
      },
      {
        key: "on_gmp_cert", label: "GMP 證明文件", category: "gmp_onsite", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare GMP 證明文件",
        action_zh: "備妥GMP 證明文件",
        criteria: [
          "新申請案附當地衛生主管機關核發之證明文件與本署核准函；定期檢查附本署核准函。",
        ],
      },
      {
        key: "on_inspection_list", label: "近5年稽查清單", category: "gmp_onsite", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 近5年稽查清單",
        action_zh: "備妥近5年稽查清單",
        criteria: [
          "包含查核單位、查核日期、查核範圍、藥品劑型／品項及查核結果。",
        ],
      },
      {
        key: "on_recall", label: "近3年回收批次清單", category: "gmp_onsite", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 近3年回收批次清單",
        action_zh: "備妥近3年回收批次清單",
        criteria: [
          "含回收日期、品項及批號，不限輸入台灣之產品；無回收者於原廠說明函中說明。",
        ],
      },
      {
        key: "on_smf", label: "SMF（1式3份）", category: "gmp_onsite", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare SMF（1式3份）",
        action_zh: "備妥SMF（1式3份）",
        criteria: [
          "紙本列印1式3份，清晰可讀之中英文版本；申請時可先提供電子檔，待補件及繳費通知時再提供紙本。",
        ],
      },
      {
        key: "on_layouts", label: "生產區圖示與空調、水系統概述（1式2份）", category: "gmp_onsite", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 生產區圖示與空調、水系統概述（1式2份）",
        action_zh: "備妥生產區圖示與空調、水系統概述（1式2份）",
        criteria: [
          "紙本1式2份，A3或A4、彩色清晰之中英文版本。",
          "廠區平面圖（各建築物用途）、生產區平面圖（各操作室用途與人流／物流動向）、潔淨度分級及空氣流向圖示。",
          "空氣處理單元配置簡圖、各單元供應之作業區域圖示、水系統配置簡圖（各處理單元及管路流向）。",
        ],
      },
      {
        key: "on_periodic_lists", label: "定期檢查：輸入藥品許可證清冊、GMP 核備函授權清單", category: "gmp_onsite", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Prepare 定期檢查：輸入藥品許可證清冊、GMP 核備函授權清單",
        action_zh: "備妥定期檢查：輸入藥品許可證清冊、GMP 核備函授權清單",
        criteria: [
          "定期檢查案須附輸入藥品許可證清冊一覽表與 GMP 核備函授權清單；新申請案標記「不適用」。",
        ],
      },
      {
        key: "on_schedule", label: "代表性產品生產排程與查廠安排", category: "gmp_onsite", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 代表性產品生產排程與查廠安排",
        action_zh: "備妥代表性產品生產排程與查廠安排",
        criteria: [
          "提供申請劑型代表性產品（定期檢查不限輸台產品，但須同生產區或生產線）之製造排程；查廠期間須有關鍵製程生產作業，否則 TFDA 可暫停或取消查廠。",
          "確認原廠休假（國定假日、歲修、選舉）；查廠日期核定後不得變更查核內容，改期順延至最後順位，撤案收取書面資料審查費。",
          "確認翻譯需求與陪同查廠人員，安排當地交通與食宿；外交部旅遊警示橙色以上暫緩查廠。",
        ],
      },
      {
        key: "on_followup", label: "繳費、補件與查後改善", category: "gmp_onsite", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Prepare 繳費、補件與查後改善",
        action_zh: "備妥繳費、補件與查後改善",
        criteria: [
          "收到補件及繳費通知後於期限內繳費（因案而異，最長1個月）；因故需延後者提出展期申請。",
          "第一次補件60天、第二次補件30天；查核結束後30天內發查廠缺失報告，原廠提出改善報告或申請展延。",
          "不予核准者於4個月內提出申復；差旅費結算後通知退費或補繳。",
        ],
      },
    ],
  },
  bse_application: {
    display_name: "Bridging Study Evaluation (BSE)",
    display_name_zh: "銜接性試驗評估（BSE）",
    deadline_default_days: 90,
    items: [
      {
        key: "bse_scope", label: "申請前確認：是否須申請 BSE 與申請時點", category: "bse_check", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Confirm whether a bridging study evaluation is required and when to file",
        action_zh: "確認是否須申請 BSE 及申請時點",
        criteria: [
          "新成分新藥及屬新成分之生物藥品，以及其他經公告應申請者，應申請銜接性試驗評估；已於我國進行對國人用藥安全性及有效性具代表性之臨床試驗，且能提供東亞人種藥物動力學資料者除外〔審查準則§22-1〕。",
          "經認定符合「小兒或少數嚴重疾病藥品審查認定要點」者，以及細胞治療、基因治療製劑，免申請〔審查準則§22-1〕。",
          "得於查驗登記前提出申請，或與查驗登記申請案同時申請〔審查準則§22-1〕。",
          "經評估免除銜接性試驗者，查驗登記得免附銜接性試驗資料，但療效與安全性仍須有充足之臨床試驗資料為依據〔審查準則§22-1〕。",
        ],
      },
      {
        key: "bse_form_e", label: "附錄E 銜接性試驗評估查檢表", category: "bse_check", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Complete the Appendix E checklist with volume and page references",
        action_zh: "逐項填寫附錄E 查檢表並標註冊數頁數",
        criteria: [
          "使用銜接性試驗基準附錄E（112.12.13 衛授食字第1121413132號公告修正），逐項勾選「有／無」並填寫資料冊數及頁數，必要時標示該頁段落；沒有的資料也要說明〔銜接性試驗基準112.12〕。",
          "依查檢表順序提供敘述性之整合摘要或簡述所附資料；M2.5 Clinical Overview 與 M2.7 Clinical Summary 為主〔銜接性試驗基準112.12〕。",
          "查檢表只供核對資料是否齊備；是否須執行銜接性試驗，仍視整體審查結果決定〔銜接性試驗基準112.12〕。",
        ],
      },
      {
        key: "bse_i_trials", label: "Ⅰ 藥品之臨床試驗現況（完整臨床試驗列表）", category: "bse_check", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "List every completed, ongoing and planned clinical trial",
        action_zh: "提供完整臨床試驗列表",
        criteria: [
          "列出所有已完成、執行中及預計執行之臨床試驗〔BSE審查重點考量112.12〕。",
          "在台灣或其他亞洲國家獨立執行（stand-alone）之試驗，以及有台灣或亞洲國家參與之跨區域臨床試驗（MRCT），特別註明並說明進度〔BSE審查重點考量112.12〕。",
        ],
      },
      {
        key: "bse_ii_ccdp", label: "Ⅱ 完整臨床數據資料（CCDP）", category: "bse_check", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Provide the complete clinical data package",
        action_zh: "提供完整臨床數據資料",
        criteria: [
          "含 CTD Module 2（所有符合我國要求之 Phase I～III 試驗資料，含藥動資料）及仿單擬稿，必要時另附 CTD Module 5〔BSE審查重點考量112.12〕。",
          "銜接性數據選自部分臨床試驗結果者，附數據來源之完整臨床試驗報告，以支持數據可信度〔銜接性試驗基準112.12〕。",
          "建立劑量－反應、療效及安全性之試驗依我國法規標準設計與執行（含對照藥品選擇、GCP）、為設計適當且良好之對照試驗，並採用合適之評估指標與我國可接受之診斷定義〔銜接性試驗基準112.12〕。",
          "NCE-2 仍依 CTD 格式整理，並將引用文獻分類（PK data、guidelines、review articles、case reports、clinical trials、observational studies、其他國家 assessment reports）〔BSE審查重點考量112.12〕。",
          "附中文仿單擬稿；僅有英文仿單擬稿或未能提供者，說明擬申請之中文適應症及用法用量〔BSE審查重點考量112.12〕。",
        ],
      },
      {
        key: "bse_iii_east_asian", label: "Ⅲ 東亞族群之藥動學、安全性及療效資料", category: "bse_check", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Present East Asian PK, safety and efficacy data",
        action_zh: "整理東亞族群藥動、安全與療效資料",
        criteria: [
          "東亞族群須在科學上能代表我國族群：中國、韓國、日本可代表；印度、巴基斯坦、斯里蘭卡、中東及西亞人種不可代表；居住歐美之亞裔受試者須考量外因性差異，並注意如 B 型肝炎帶原等內外因性差異〔BSE審查重點考量112.12〕。",
          "說明銜接性數據資料（BDP）來源：銜接性試驗、東亞第二期試驗（劑量反應趨勢）、MRCT 東亞次族群分析或東亞第三期試驗〔BSE審查重點考量112.12〕。",
          "MRCT 列出各試驗東亞族群之來源國家、人數及比例（n/N, %）與總和；獨立東亞試驗簡述設計與人數；人數過少者可合併（pooling）或分國比較，必要時另附我國族群獨立分析〔BSE審查重點考量112.12〕。",
        ],
      },
      {
        key: "bse_iv_pk", label: "Ⅳ 東西方族群比較：藥動／藥效", category: "bse_check", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Compare East Asian and non-East Asian PK/PD",
        action_zh: "比較東西方族群之藥動／藥效",
        criteria: [
          "以東亞與非東亞族群分組比較為優先（全試驗族群與非東亞比例相近時，可比較東亞與全試驗族群）；除主成分外，納入具臨床相關性之分析物（如活性代謝物）〔BSE審查重點考量112.12〕。",
          "試驗內比較以列表與描述性統計呈現；跨試驗比較所選試驗之設計、劑量／頻率、劑型、受試者背景、分析方法及參數定義須相近，並以相同給藥狀態（單次或穩態）比較〔BSE審查重點考量112.12〕。",
          "pop-PK 報告含人種及國家資訊（東亞占比 >10% 可信度較高），剔除無法代表我國族群之數據，並提供模擬參數（如 AUCtau,ss、Cmax,ss）數值與族群差異〔BSE審查重點考量112.12〕。",
          "以東西方目標病人族群、涵蓋臨床最大治療劑量、重複給藥穩態之數據為最重要比較；不宜以體重標準化比較；有差異者分析原因（體重、代謝酵素基因多型性等）及臨床相關性〔BSE審查重點考量112.12〕。",
          "生物製劑另比較東亞與非東亞之抗藥抗體（ADA）發生率；PEG 修飾藥品比較抗 PEG 抗體發生率〔BSE審查重點考量112.12〕。",
        ],
      },
      {
        key: "bse_iv_clinical", label: "Ⅳ 東西方族群比較：療效與安全性", category: "bse_check", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Compare East Asian and non-East Asian efficacy and safety",
        action_zh: "比較東西方族群之療效與安全性",
        criteria: [
          "資料來源為劑量尋找試驗及樞紐試驗；東亞人數足夠者採試驗內比較，分散於多個 MRCT 者合併後跨試驗比較，所選試驗之設計、劑量、劑型、受試者背景、療效指標定義與追蹤期須相近〔BSE審查重點考量112.12〕。",
          "製表比較東亞與非東亞族群，及東亞與整體（overall／ITT）族群之一致性；一併比較基準特徵、劑量、曝藥及追蹤時間〔BSE審查重點考量112.12〕。",
          "療效比較含主要療效指標及納入統計分析之關鍵次要指標；抗生素提供我國 MIC 資料，抗病毒藥評估我國主要流行病毒株之療效；安全性可用 subject-time 校正曝藥時間〔BSE審查重點考量112.12〕。",
        ],
      },
      {
        key: "bse_v_sensitivity", label: "Ⅴ 12 項族群敏感性自我評估", category: "bse_check", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Answer the 12 ethnic-sensitivity questions with references",
        action_zh: "完成 12 項族群敏感性自我評估",
        criteria: [
          "逐題回答「是／否／未知」並附引用依據或文獻：(1) 非線性藥動學 (2) 驟升之藥效學曲線 (3) 治療劑量範圍狹窄 (4) 高度代謝、單一途徑、交互作用風險 (5) 經具族群差異之基因多形性酵素代謝 (6) 前驅藥經具族群差異之酵素轉換 (7) 生體可用率個體差異大 (8) 生體可用率低、易受飲食影響 (9) 常需與多種藥物併用 (10) 易被不當使用 (11) 主要試驗族群與我國適應症族群之流行病學差異 (12) 醫療行為等其他族群敏感因素〔銜接性試驗基準112.12〕。",
          "此自我評估只判斷族群敏感性可能性高低，不能取代項目Ⅲ、Ⅳ 之資料；法規單位仍依 BDP 決定是否須執行銜接性試驗〔BSE審查重點考量112.12〕。",
        ],
      },
      {
        key: "bse_vi_postmarketing", label: "Ⅵ 藥品上市後安全性資料", category: "bse_check", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Summarize post-marketing safety and attach PSUR/PBRER",
        action_zh: "摘要上市後安全性並附 PSUR／PBRER",
        criteria: [
          "已於他國上市者，依 PSUR、PBRER 或其他安全性資訊，於自我評估報告摘要上市後新增之重要安全性警訊，並附 PSUR、PBRER 完整報告及引用資料〔BSE審查重點考量112.12〕。",
          "尚未於任何國家上市者，本項標記「不適用」並寫明原因（推論：查檢表以「有／無」作答）。",
        ],
      },
      {
        key: "bse_vii_five_year", label: "Ⅶ 十大先進國上市滿五年之新成分新藥：國內臨床試驗資訊", category: "bse_check", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Provide domestic trial information for products marketed five years in reference countries",
        action_zh: "提供國內臨床試驗資訊（上市滿五年者）",
        criteria: [
          "預計依111.09.30 衛授食字第1111407703號公告「已在十大醫藥先進國核准上市滿五年，但屬國內新成分新藥（不包括生物藥品），辦理查驗登記審查重點」辦理者填寫〔銜接性試驗基準112.12〕。",
          "本品曾執行國內臨床試驗者，附衛生福利部計畫書准予執行公文（計畫編號、核准日期）。",
          "有相同成分藥品於國內執行臨床試驗者，附台灣藥物臨床試驗資訊網查詢結果（計畫編號、核准登錄日期）。",
          "不適用該審查重點者，本項標記「不適用」。",
        ],
      },
      {
        key: "bse_viii_conclusion", label: "Ⅷ 自我總結評估", category: "bse_check", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Write the overall self-assessment and conclusion",
        action_zh: "撰寫自我總結評估與結論",
        criteria: [
          "簡述主成分與作用機轉、宣稱適應症及用法用量、疾病背景、流行病學與現行治療；學名藥須列參考藥品與原開發廠並附連結資料（如 BE 報告）〔BSE審查重點考量112.12〕。",
          "簡述 BDP 來源、東亞族群總和人數及比例，人數過少者說明原因〔BSE審查重點考量112.12〕。",
          "說明東亞與非東亞之藥動差異及其臨床意義；療效與安全性差異之臨床意義，是否可藉調整國內用法用量處理，國人較高之安全性風險是否可預防、監測、處置或以劑量調整降低〔BSE審查重點考量112.12〕。",
          "綜合評估利害權衡（是否為嚴重疾患、有無替代療法、族群差異可否容忍），提出「是否須執行銜接性試驗」之結論〔BSE審查重點考量112.12〕。",
        ],
      },
      {
        key: "bse_self_report", label: "BSE 自我評估報告（獨立報告）", category: "bse_report", required: true,
        risk_rules: { completed: "low", default: "high" },
        action: "Write the standalone BSE self-assessment report",
        action_zh: "撰寫獨立之 BSE 自我評估報告",
        criteria: [
          "另撰一份獨立之 BSE 自我評估報告，提供架構化整合性摘要〔BSE審查重點考量112.12〕。",
          "內容至少包括：主成分與作用機轉；宣稱適應症及用法用量；疾病背景、流行病學與現行治療；我國與歐美在致病成因、流行病學（好發族群、流行菌種或病毒株、癌症組織型態或受體表現）、診斷標準、標準治療與醫療行為之差異〔BSE審查重點考量112.12〕。",
          "並包括：美國、歐盟、日本、十大醫藥先進國及其他亞洲國家之送件與核准現況；完整臨床試驗列表；劑量尋找與樞紐試驗之設計、療效與安全性摘要；項目Ⅲ～Ⅵ 之資料；12 項自我評估；自我總結評估〔BSE審查重點考量112.12〕。",
        ],
      },
      {
        key: "bse_study_protocol", label: "銜接性試驗計畫書（經評估不得免除時）", category: "bse_study", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Draft and submit the bridging study protocol if one is required",
        action_zh: "經要求時擬定並送審銜接性試驗計畫書",
        criteria: [
          "經評估不得免除者，依評估結果擬定銜接性試驗計畫書送審，審查同意後執行〔審查準則§22-1〕。",
          "試驗類型依族群敏感性與外因性因素決定：不需試驗；採藥理評估指標之藥效學試驗（同步測量藥動）；或於我國執行對照設計臨床試驗，通常為隨機、固定劑量之劑量－反應試驗（適用於劑量選擇有疑慮、缺乏接受國外對照試驗之經驗、醫療行為或併用藥品不同、我國對此類藥品不熟悉）〔銜接性試驗基準112.12〕。",
          "可簡化國外樞紐試驗之設計（減少人數、縮短期間或無對照組），並與國外樞紐試驗結果比較〔BSE審查重點考量112.12〕。",
          "以跨區域試驗作為銜接性試驗者，須在我國或東亞具說服力之結果：最佳為區域內統計顯著，其次為區域結果雖不顯著但趨勢一致；主要指標須明確定義並為各區域接受〔基準問答集〕。",
          "未被要求執行銜接性試驗者，本項標記「不適用」並註明 BSE 評估結果。",
        ],
      },
      {
        key: "bse_safety_bridging", label: "安全性銜接資料（有安全性疑慮時）", category: "bse_study", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "Provide bridging safety data when there is a safety concern",
        action_zh: "有安全性疑慮時提供安全性銜接資料",
        criteria: [
          "估計我國常見不良事件發生率並偵測嚴重不良事件；偵測約 1% 發生率之事件通常需評估約 300 位病人〔銜接性試驗基準112.12〕。",
          "可由療效銜接性試驗收集，或在其前執行小規模安全性試驗；國外資料有指標性嚴重不良事件、發生率可能有差異，或療效銜接性試驗之安全性數據不足時，執行獨立之安全性試驗〔銜接性試驗基準112.12〕。",
          "無安全性疑慮或未被要求者，本項標記「不適用」並寫明原因。",
        ],
      },
      {
        key: "bse_study_report", label: "銜接性試驗報告備查", category: "bse_study", required: false,
        risk_rules: { completed: "low", default: "medium" },
        action: "File the bridging study report after completion",
        action_zh: "試驗完成後送交報告備查",
        criteria: [
          "試驗完成後，將試驗報告及相關資料送交中央衛生主管機關備查〔審查準則§22-1〕。",
          "判讀原則：劑量－反應、安全性和療效與國外相似者即可銜接；以不同劑量得相似結果者，可在有藥動或藥效依據下調整劑量後外推；樣本數不足以外推安全性者需額外安全性數據；無法證實安全性及療效者可能需確認性臨床試驗〔銜接性試驗基準112.12〕。",
          "於國內完成銜接性試驗並經核准之新藥，自發證日起5年內，相同成分、劑型、劑量之學名藥須另附相同標準之國內銜接性試驗報告〔審查準則§22-1〕。",
          "未執行銜接性試驗者，本項標記「不適用」。",
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
  // A not-applicable item needs no document, so it carries no risk unless a rule says so.
  return rules[status] ?? (status === "not_applicable" ? "low" : rules.default);
}
