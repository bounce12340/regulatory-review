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
