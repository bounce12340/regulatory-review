// JSON API client + shared app state and display labels.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(method, path, body) {
  const init = { method, headers: {}, credentials: "same-origin" };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError(0, "無法連線至伺服器，請檢查網路。");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    if (res.status === 401 && state.user && !path.startsWith("/api/auth/")) {
      state.user = null;
      window.dispatchEvent(new Event("rr:logged-out"));
    }
    throw new ApiError(res.status, data?.error ?? `請求失敗（${res.status}）`);
  }
  return data;
}

export const state = {
  user: null,
  config: null,
  schemas: [],
  projects: [],
  today: null,
  currentProjectId: null,
};

export const canEdit = () => state.user && state.user.role !== "viewer";
export const isAdmin = () => state.user?.role === "admin";

export const STATUS_LABEL = {
  pending: "待處理",
  in_progress: "進行中",
  under_review: "審查中",
  blocked: "受阻",
  completed: "已完成",
};
export const STATUS_ICON = { pending: "○", in_progress: "◐", under_review: "◉", blocked: "✕", completed: "✓" };
export const STATUS_COLOR = {
  completed: "#10b981", in_progress: "#f59e0b", under_review: "#3b82f6", blocked: "#ef4444", pending: "#94a3b8",
};
export const RISK_LABEL = { low: "低", medium: "中", high: "高" };
export const RISK_COLOR = { low: "#10b981", medium: "#f59e0b", high: "#ef4444" };
export const OVERALL_LABEL = {
  ready_for_submission: "可送件",
  in_progress: "接近完成",
  needs_attention: "待加強",
};
export const OVERALL_CLASS = { ready_for_submission: "b-ok", in_progress: "b-info", needs_attention: "b-danger" };
export const PROJECT_STATUS_LABEL = { active: "進行中", archived: "已封存", completed: "已結案" };
export const ROLE_LABEL = { admin: "管理員", member: "成員", viewer: "檢視者" };

export async function refreshProjects() {
  const data = await api("GET", "/api/projects");
  state.projects = data.projects;
  state.today = data.today;
  if (!state.projects.some((p) => p.id === state.currentProjectId)) {
    state.currentProjectId = state.projects[0]?.id ?? null;
  }
  return state.projects;
}

/** Urgency bucket used by the original dashboard: <30 days red, <90 amber, else green. */
export function urgency(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return { cls: "b-neutral", k: "k-violet", label: "未設定" };
  if (daysLeft < 0) return { cls: "b-danger", k: "k-red", label: `已逾期 ${-daysLeft} 天` };
  if (daysLeft < 30) return { cls: "b-danger", k: "k-red", label: "截止日緊迫" };
  if (daysLeft < 90) return { cls: "b-warn", k: "k-amber", label: "截止日將近" };
  return { cls: "b-ok", k: "k-green", label: "時程充裕" };
}

export function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/** % of the window from project creation to deadline that has elapsed. */
export function timelineElapsed(project, today) {
  if (!project.deadline) return null;
  const start = project.created_at.slice(0, 10);
  const total = daysBetween(start, project.deadline);
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, (daysBetween(start, today) / total) * 100));
}
