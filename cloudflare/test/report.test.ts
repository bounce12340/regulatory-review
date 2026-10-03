import { describe, expect, it } from "vitest";
import { actionItems, alertReasons, daysBetween, overallStatus, rtfVerdict, summarize, todayTaipei, type ItemRow } from "../src/report";
import { SCHEMAS } from "../src/schemas";

let nextId = 1;
function item(status: ItemRow["status"], risk: ItemRow["risk_level"], key: string | null = null): ItemRow {
  return {
    id: nextId++, item_key: key, item_name: `item ${nextId}`, category: null, required: 1,
    status, risk_level: risk, notes: null, sort_order: nextId, updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("overallStatus (same thresholds as scripts/review.py)", () => {
  it.each([
    [100, "ready_for_submission"],
    [70, "in_progress"],
    [85.7, "in_progress"],
    [69.9, "needs_attention"],
    [0, "needs_attention"],
  ])("%s%% → %s", (rate, expected) => expect(overallStatus(rate)).toBe(expected));
});

describe("summarize", () => {
  it("handles an empty checklist", () => {
    const s = summarize([], null, "2026-10-01");
    expect(s).toMatchObject({ total: 0, completed: 0, completion_rate: 0, high_risk_items: 0, days_left: null });
  });

  it("matches the Fenogal default data from review.py (3/7 → 42.9%)", () => {
    const items = [
      item("in_progress", "high"), item("completed", "low"), item("under_review", "medium"),
      item("completed", "low"), item("blocked", "high"), item("completed", "low"), item("pending", "medium"),
    ];
    const s = summarize(items, "2026-10-31", "2026-10-01");
    expect(s.completed).toBe(3);
    expect(s.total).toBe(7);
    expect(s.completion_rate).toBe(42.9);
    expect(s.high_risk_items).toBe(2);
    expect(s.overall_status).toBe("needs_attention");
    expect(s.days_left).toBe(30);
    expect(s.blocked_items).toBe(1);
    expect(s.alert_reasons).toEqual(["blocked"]);
    expect(s.status_counts).toEqual({ pending: 1, in_progress: 1, under_review: 1, blocked: 1, completed: 3, not_applicable: 0 });
    expect(s.risk_counts).toEqual({ low: 3, medium: 2, high: 2 });
  });

  it("reports overdue deadlines as negative days", () => {
    expect(summarize([], "2026-09-25", "2026-10-01").days_left).toBe(-6);
  });
});

describe("alert (red only when action is needed now)", () => {
  it("does not flag a fresh case with low completion and a distant deadline", () => {
    const s = summarize([item("pending", "high"), item("pending", "high")], "2027-04-01", "2026-10-01");
    expect(s.overall_status).toBe("needs_attention");
    expect(s.alert).toBe(false);
    expect(s.alert_reasons).toEqual([]);
  });
  it("never flags a closed or archived case", () => {
    const s = summarize([item("blocked", "high")], "2026-09-01", "2026-10-01", false);
    expect(s.alert).toBe(false);
  });
  it.each([
    [0, 5, 0, -3, ["overdue"]],
    [0, 5, 0, 29, ["due_soon"]],
    [0, 5, 0, 30, []],
    [0, 5, 2, 200, ["blocked"]],
    [1, 5, 1, -1, ["overdue", "blocked"]],
    [5, 5, 0, -10, []],
    [0, 0, 0, -10, []],
    [0, 5, 0, null, []],
  ])("completed %i/%i, blocked %i, days left %s → %j", (done, total, blocked, days, expected) => {
    expect(alertReasons(done, total, blocked, days)).toEqual(expected);
  });
});

describe("actionItems", () => {
  it("lists only non-completed items, high priority when high risk", () => {
    const items = [item("completed", "low", "item1"), item("blocked", "high", "item5"), item("pending", "medium", null)];
    const actions = actionItems("drug_registration_extension", items);
    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({ priority: "high", action: "排除 QR code 驗證問題並上傳文件" });
    expect(actions[1]).toMatchObject({ priority: "medium", action: "完成所需文件並更新狀態" });
  });
});

describe("dates", () => {
  it("daysBetween counts calendar days", () => {
    expect(daysBetween("2026-02-27", "2026-03-01")).toBe(2);
    expect(daysBetween("2026-10-01", "2026-10-01")).toBe(0);
  });
  it("todayTaipei uses UTC+8", () => {
    expect(todayTaipei(new Date("2026-09-30T16:30:00Z"))).toBe("2026-10-01");
    expect(todayTaipei(new Date("2026-09-30T15:59:00Z"))).toBe("2026-09-30");
  });
});

describe("not applicable (不適用)", () => {
  it("leaves N/A items out of the completion rate and the to-do list", () => {
    const items = [item("completed", "low"), item("not_applicable", "low"), item("pending", "high")];
    const s = summarize(items, "2027-04-01", "2026-10-01");
    expect(s.not_applicable).toBe(1);
    expect(s.completion_rate).toBe(50);
    expect(actionItems("food_registration", items)).toHaveLength(1);
  });
  it("counts a case whose open items are all N/A as complete", () => {
    const s = summarize([item("completed", "low"), item("not_applicable", "low")], "2026-10-05", "2026-10-01");
    expect(s.completion_rate).toBe(100);
    expect(s.overall_status).toBe("ready_for_submission");
    expect(s.alert).toBe(false);
  });
});

describe("rtfVerdict (原料藥／DMF 退件判定)", () => {
  const caseFor = (schema: string, status: (key: string, n: number) => ItemRow["status"]) =>
    SCHEMAS[schema].items.map((t, n) => ({ ...item(status(t.key, n), "low", t.key), item_name: t.label }));

  it("returns null for schemas without RTF rules", () => {
    expect(rtfVerdict("food_registration", [])).toBeNull();
  });

  it("查檢表一: all of items 1–6 done and two of 7–11 missing → 續審", () => {
    const v = rtfVerdict("dmf_rtf_full", caseFor("dmf_rtf_full", (_, n) => (n === 8 || n === 9 ? "pending" : "completed")))!;
    expect(v.verdict).toBe("continue");
    expect(v.rules.map((r) => [r.failures.length, r.refused])).toEqual([[0, false], [2, false]]);
  });

  it("查檢表一: three of items 7–11 missing → 退件", () => {
    const v = rtfVerdict("dmf_rtf_full", caseFor("dmf_rtf_full", (_, n) => (n >= 8 ? "in_progress" : "completed")))!;
    expect(v.verdict).toBe("refuse");
    expect(v.rules[1]).toMatchObject({ refused: true, max_failures: 2 });
    expect(v.rules[1].failures).toHaveLength(3);
  });

  it("查檢表一: a single missing item among 1–6 → 退件", () => {
    const v = rtfVerdict("dmf_rtf_full", caseFor("dmf_rtf_full", (k) => (k === "dmf1_stability" ? "under_review" : "completed")))!;
    expect(v.verdict).toBe("refuse");
    expect(v.rules[0].failures.map((f) => f.item)).toEqual([SCHEMAS.dmf_rtf_full.items[5].label]);
  });

  it("treats 不適用 as「是」and a template item missing from the case as「否」", () => {
    const items = caseFor("dmf_rtf_cep", (k) => (k === "dmf4_language" ? "not_applicable" : "completed"));
    expect(rtfVerdict("dmf_rtf_cep", items)!.verdict).toBe("continue");
    const v = rtfVerdict("dmf_rtf_cep", items.filter((i) => i.item_key !== "dmf4_coa"))!;
    expect(v.verdict).toBe("refuse");
    expect(v.rules[0].failures).toEqual([{ item_id: null, item: SCHEMAS.dmf_rtf_cep.items[3].label }]);
  });
});
