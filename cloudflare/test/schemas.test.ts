import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ITEM_STATUSES, riskFor, SCHEMAS } from "../src/schemas";

const yamlPath = join(dirname(fileURLToPath(import.meta.url)), "../../config/regulatory_schemas.yaml");
const yamlSchemas = parse(readFileSync(yamlPath, "utf8")).schemas as Record<string, any>;

describe("SCHEMAS mirrors config/regulatory_schemas.yaml", () => {
  it("has the same schema types", () => {
    expect(Object.keys(SCHEMAS).sort()).toEqual(Object.keys(yamlSchemas).sort());
  });

  for (const [type, ySchema] of Object.entries(yamlSchemas)) {
    it(`${type}: metadata and every item match`, () => {
      const ts = SCHEMAS[type];
      expect(ts.display_name).toBe(ySchema.display_name);
      expect(ts.display_name_zh).toBe(ySchema.display_name_zh);
      expect(ts.deadline_default_days).toBe(ySchema.deadline_default_days);
      // action_zh / criteria live in YAML only for newer schemas; compare them when present.
      expect(ts.items.map((i, n) => ({
        key: i.key, label: i.label, category: i.category, required: i.required,
        risk_rules: i.risk_rules, action: i.action,
        ...("action_zh" in ySchema.items[n] ? { action_zh: i.action_zh } : {}),
        ...("criteria" in ySchema.items[n] ? { criteria: i.criteria } : {}),
      }))).toEqual(ySchema.items);
    });
  }

  it("new drug registration items all carry review thresholds", () => {
    const nda = SCHEMAS.new_drug_registration;
    expect(nda.items.length).toBeGreaterThanOrEqual(30);
    for (const i of nda.items) expect(i.criteria?.length, i.key).toBeGreaterThan(0);
  });

  it("every item has a Chinese action and a default risk", () => {
    for (const s of Object.values(SCHEMAS)) {
      for (const i of s.items) {
        expect(i.action_zh.length).toBeGreaterThan(0);
        expect(["low", "medium", "high"]).toContain(i.risk_rules.default);
      }
    }
  });
});

describe("riskFor", () => {
  const spec = SCHEMAS.drug_registration_extension.items.find((i) => i.key === "item3")!;
  it("uses the status-specific rule when present", () => {
    expect(riskFor(spec.risk_rules, "under_review")).toBe("medium");
    expect(riskFor(spec.risk_rules, "completed")).toBe("low");
  });
  it("falls back to the default rule", () => {
    expect(riskFor(spec.risk_rules, "blocked")).toBe("high");
    expect(riskFor(spec.risk_rules, "pending")).toBe("high");
  });
  it("completed is low risk for every template item", () => {
    for (const s of Object.values(SCHEMAS)) for (const i of s.items) expect(riskFor(i.risk_rules, "completed")).toBe("low");
  });
  it("returns a valid level for every status", () => {
    for (const s of Object.values(SCHEMAS)) {
      for (const i of s.items) for (const st of ITEM_STATUSES) expect(["low", "medium", "high"]).toContain(riskFor(i.risk_rules, st));
    }
  });
});
