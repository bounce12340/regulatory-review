import { describe, expect, it } from "vitest";
import { extractJson, parseReport } from "../src/ai";
import { SCHEMAS } from "../src/schemas";

const food = SCHEMAS.food_registration;
const valid = {
  completeness_score: 61.6,
  gaps: [{ requirement_key: "item5", requirement: "衛生安全性試驗報告", status: "missing", severity: "high", explanation: "未提及。", recommendation: "補試驗。" }],
  compliant_items: ["item1"],
  risk_assessment: "high",
  estimated_review_time: "8 小時",
  summary: "缺少安全性試驗。",
  action_items: ["補齊試驗報告"],
};

describe("extractJson (models without schema enforcement)", () => {
  it("reads a bare object", () => expect(extractJson('{"a":1}')).toEqual({ a: 1 }));
  it("strips prose and code fences", () => {
    expect(extractJson('以下是結果：\n```json\n{"a":{"b":2}}\n```\n希望有幫助')).toEqual({ a: { b: 2 } });
  });
  it("ignores <think> blocks that contain braces", () => {
    expect(extractJson('<think>maybe {"x":0}</think>{"a":1}')).toEqual({ a: 1 });
  });
  it("returns null for non-JSON", () => {
    expect(extractJson("抱歉，我無法完成")).toBeNull();
    expect(extractJson('{"a":')).toBeNull();
  });
});

describe("parseReport", () => {
  it("accepts a well-formed report and rounds the score", () => {
    const r = parseReport(JSON.stringify(valid), food)!;
    expect(r.completeness_score).toBe(62);
    expect(r.gaps).toHaveLength(1);
    expect(r.compliant_items).toEqual(["item1"]);
  });

  it("repairs unknown enum values, clamps the score and drops unknown keys", () => {
    const r = parseReport(JSON.stringify({
      ...valid,
      completeness_score: 140,
      gaps: [{ requirement_key: "item3", status: "absent", severity: "critical" }, "junk"],
      compliant_items: ["item1", "made_up_key"],
      risk_assessment: "severe",
    }), food)!;
    expect(r.completeness_score).toBe(100);
    expect(r.gaps).toEqual([{
      requirement_key: "item3", requirement: food.items.find((i) => i.key === "item3")!.label,
      status: "incomplete", severity: "medium", explanation: "", recommendation: "",
    }]);
    expect(r.compliant_items).toEqual(["item1"]);
    expect(r.risk_assessment).toBe("medium");
  });

  it("rejects replies without a score or a gaps array", () => {
    expect(parseReport(JSON.stringify({ ...valid, completeness_score: "很高" }), food)).toBeNull();
    expect(parseReport(JSON.stringify({ ...valid, gaps: "none" }), food)).toBeNull();
    expect(parseReport("[1,2]", food)).toBeNull();
  });
});
