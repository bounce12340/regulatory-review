import { describe, expect, it } from "vitest";
import { SCHEMAS } from "../src/schemas";
// @ts-expect-error plain browser module without type declarations
import { nodesIn } from "../public/lib/ectd.js";
// @ts-expect-error plain browser module without type declarations
import { suggestItems } from "../public/lib/match.js";

function suggest(type: string, names: string[]) {
  const items = SCHEMAS[type].items.map((i, n) => ({ id: n, item_key: i.key, item_name: i.label }));
  const out = suggestItems(names.map((name) => ({ name })), items) as { itemId: number | null }[];
  return Object.fromEntries(names.map((name, n) => [name, out[n].itemId === null ? null : items[out[n].itemId!].item_key]));
}

describe("nodesIn", () => {
  it("reads dotted, ranged and eCTD folder nodes", () => {
    expect(nodesIn("07_3.2.S.4.1_原料藥規格.pdf")).toContain("3.2.s.4.1");
    expect(nodesIn("03_3.2.S.2.1-2.2_製程.pdf")).toEqual(expect.arrayContaining(["3.2.s.2.1", "3.2.s.2.2"]));
    expect(nodesIn("0000/m3/32-body-data/32s-drug-sub/32s7-stab/stability.pdf")).toContain("3.2.s.7");
  });
});

describe("suggestItems on the fictional test packs", () => {
  it("places NDA Module 1 and Module 3 files", () => {
    expect(suggest("new_drug_registration", [
      "01_M1_RTF查檢表.pdf", "03_M1_製劑廠GMP證明_虛擬.pdf", "04_M1_CPP_虛擬.pdf", "05_M1_切結書甲乙_虛擬.pdf",
      "07_3.2.S.4.1_原料藥規格與檢驗成績書.pdf", "08_3.2.S.7_原料藥安定性.pdf", "09_3.2.P.3.2_批次配方.pdf",
      "10_3.2.P.5.1_成品規格.pdf", "11_3.2.P.8_成品安定性.pdf", "README_測試說明與答案.pdf",
    ])).toEqual({
      "01_M1_RTF查檢表.pdf": "m1_rtf", "03_M1_製劑廠GMP證明_虛擬.pdf": "m1_product_gmp", "04_M1_CPP_虛擬.pdf": "m1_cpp",
      "05_M1_切結書甲乙_虛擬.pdf": "m1_affidavit", "07_3.2.S.4.1_原料藥規格與檢驗成績書.pdf": "s41_specification",
      "08_3.2.S.7_原料藥安定性.pdf": "s7_stability", "09_3.2.P.3.2_批次配方.pdf": "p32_batch_formula",
      "10_3.2.P.5.1_成品規格.pdf": "p51_specification", "11_3.2.P.8_成品安定性.pdf": "p8_stability",
      "README_測試說明與答案.pdf": null,
    });
  });

  it("places DMF 3.2.S files", () => {
    expect(suggest("dmf_rtf_full", [
      "01_RTF查檢表一_填寫範例.pdf", "03_3.2.S.2.1-2.2_製造廠與製程描述.pdf", "04_3.2.S.2.3_起始物.pdf",
      "05_3.2.S.2.4_中間體規格.pdf", "08_3.2.S.4.3_分析方法確效摘要.pdf", "10_3.2.S.7_安定性.pdf", "11_3.2.S.7_安定性數據.xlsx",
    ])).toEqual({
      "01_RTF查檢表一_填寫範例.pdf": "dmf1_rtf_form", "03_3.2.S.2.1-2.2_製造廠與製程描述.pdf": "dmf1_process",
      "04_3.2.S.2.3_起始物.pdf": "dmf1_starting_material", "05_3.2.S.2.4_中間體規格.pdf": "dmf1_intermediate",
      "08_3.2.S.4.3_分析方法確效摘要.pdf": "dmf1_method_validation", "10_3.2.S.7_安定性.pdf": "dmf1_stability",
      "11_3.2.S.7_安定性數據.xlsx": "dmf1_stability",
    });
  });

  it("places PMF form files by form code and section number", () => {
    expect(suggest("pmf_nonsterile_full", [
      "01_表A_PMF送審表.pdf", "04_表B-3_原廠授權函.pdf", "06_表B-5_SMF節錄.pdf",
      "09_表C-1_1.4.4_生產區平面圖.pdf", "11_表C-1_1.7_出產國核准作業項目.pdf", "14_表C-5_確效及驗證作業.pdf",
    ])).toEqual({
      "01_表A_PMF送審表.pdf": "pmf_a_form", "04_表B-3_原廠授權函.pdf": "pmf_b_auth", "06_表B-5_SMF節錄.pdf": "pmf_b_smf",
      "09_表C-1_1.4.4_生產區平面圖.pdf": "c1_layout", "11_表C-1_1.7_出產國核准作業項目.pdf": "c1_local_license",
      "14_表C-5_確效及驗證作業.pdf": "pmf_c5",
    });
  });
});
