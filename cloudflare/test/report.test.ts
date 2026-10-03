import { describe, expect, it } from "vitest";
import { actionItems, alertReasons, daysBetween, overallStatus, summarize, todayTaipei, type ItemRow } from "../src/report";

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
    expect(s.status_counts).toEqual({ pending: 1, in_progress: 1, under_review: 1, blocked: 1, completed: 3 });
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
