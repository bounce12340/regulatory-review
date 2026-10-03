/**
 * Review-report logic — same rules as scripts/review.py generate_report():
 *   completion = completed / total
 *   overall    = 100% → ready_for_submission, ≥70% → in_progress, else needs_attention
 *   action items = every non-completed item (priority high if its risk is high)
 *
 * The web version adds an alert flag on top of that (not in review.py): a case is
 * flagged only when something needs action now — it is overdue, due within
 * DUE_SOON_DAYS, or has blocked items — so low completion alone on a fresh case
 * doesn't turn everything red.
 */

import { findTemplateItem, type ItemStatus, type RiskLevel } from "./schemas";

export interface ItemRow {
  id: number;
  item_key: string | null;
  item_name: string;
  category: string | null;
  required: number;
  status: ItemStatus;
  risk_level: RiskLevel;
  notes: string | null;
  sort_order: number;
  updated_at: string;
}

export interface ProjectRow {
  id: number;
  name: string;
  slug: string;
  schema_type: string;
  deadline: string | null;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export type OverallStatus = "ready_for_submission" | "in_progress" | "needs_attention";
export type AlertReason = "overdue" | "due_soon" | "blocked";

export const DUE_SOON_DAYS = 30;

export interface ActionItem {
  item_id: number;
  item: string;
  priority: "high" | "medium";
  action: string;
}

export interface ReportSummary {
  total: number;
  completed: number;
  high_risk_items: number;
  blocked_items: number;
  completion_rate: number; // 0–100, one decimal
  overall_status: OverallStatus;
  days_left: number | null;
  /** True when the case needs action now; alert_reasons says why. */
  alert: boolean;
  alert_reasons: AlertReason[];
  status_counts: Record<ItemStatus, number>;
  risk_counts: Record<RiskLevel, number>;
}

export function alertReasons(completed: number, total: number, blocked: number, daysLeft: number | null): AlertReason[] {
  if (total === 0 || completed === total) return [];
  const reasons: AlertReason[] = [];
  if (daysLeft !== null && daysLeft < 0) reasons.push("overdue");
  else if (daysLeft !== null && daysLeft < DUE_SOON_DAYS) reasons.push("due_soon");
  if (blocked > 0) reasons.push("blocked");
  return reasons;
}

export function overallStatus(rate: number): OverallStatus {
  if (rate >= 100) return "ready_for_submission";
  if (rate >= 70) return "in_progress";
  return "needs_attention";
}

/** Today's date (YYYY-MM-DD) in Taiwan time — deadlines are Taiwan calendar dates. */
export function todayTaipei(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export function summarize(
  items: ItemRow[], deadline: string | null, today: string = todayTaipei(), active = true,
): ReportSummary {
  const status_counts: Record<ItemStatus, number> = {
    pending: 0, in_progress: 0, under_review: 0, blocked: 0, completed: 0,
  };
  const risk_counts: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0 };
  for (const i of items) {
    status_counts[i.status] += 1;
    risk_counts[i.risk_level] += 1;
  }
  const total = items.length;
  const completed = status_counts.completed;
  const rate = total ? Math.round((completed / total) * 1000) / 10 : 0;
  const days_left = deadline ? daysBetween(today, deadline) : null;
  // Closed and archived cases are no longer being worked on, so they never raise an alert.
  const alert_reasons = active ? alertReasons(completed, total, status_counts.blocked, days_left) : [];
  return {
    total,
    completed,
    high_risk_items: risk_counts.high,
    blocked_items: status_counts.blocked,
    completion_rate: rate,
    overall_status: overallStatus(rate),
    days_left,
    alert: alert_reasons.length > 0,
    alert_reasons,
    status_counts,
    risk_counts,
  };
}

export function actionItems(schemaType: string, items: ItemRow[]): ActionItem[] {
  return items
    .filter((i) => i.status !== "completed")
    .map((i) => ({
      item_id: i.id,
      item: i.item_name,
      priority: i.risk_level === "high" ? "high" : "medium",
      action: findTemplateItem(schemaType, i.item_key)?.action_zh ?? "完成所需文件並更新狀態",
    }));
}
