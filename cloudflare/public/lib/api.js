// JSON API client + shared app state and display labels.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Uploads one file as multipart form data; errors surface like api(). */
export async function upload(path, file) {
  const body = new FormData();
  body.append("file", file);
  let res;
  try {
    res = await fetch(path, { method: "POST", body, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "無法連線至伺服器，請檢查網路。");
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `上傳失敗（${res.status}）`);
  return data;
}

export function fileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const prefetched = new Map();

/** Starts a GET early; the next api("GET", path) uses the result instead of asking again. */
export function prefetch(path) {
  const pending = api("GET", path);
  pending.catch(() => {}); // a failed prefetch is retried by the real request
  prefetched.set(path, { pending, at: Date.now() });
}

export async function api(method, path, body) {
  if (method === "GET" && prefetched.has(path)) {
    const { pending, at } = prefetched.get(path);
    prefetched.delete(path);
    // Only reuse it during start-up; anything older may be out of date.
    if (Date.now() - at < 10_000) {
      try { return await pending; } catch { /* fall through and ask again */ }
    }
  }
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
  not_applicable: "不適用",
};
export const STATUS_ICON = { pending: "○", in_progress: "◐", under_review: "◉", blocked: "✕", completed: "✓" };
export const STATUS_COLOR = {
  completed: "#10b981", in_progress: "#f59e0b", under_review: "#3b82f6", blocked: "#ef4444", pending: "#94a3b8",
};
export const RISK_LABEL = { low: "低", medium: "中", high: "高" };
export const OVERALL_LABEL = {
  ready_for_submission: "可以送件",
  in_progress: "接近完成",
  needs_attention: "尚待補齊",
};
/** Why a case is flagged red, e.g. 「距截止日 12 天、2 項受阻」; empty when nothing is urgent. */
export function alertText(summary) {
  const label = {
    overdue: () => `已逾期 ${-summary.days_left} 天`,
    due_soon: () => `距截止日 ${summary.days_left} 天`,
    blocked: () => `${summary.blocked_items} 項受阻`,
  };
  return (summary.alert_reasons ?? []).map((r) => label[r]()).join("、");
}

/** Status tag for the case lists: red only when the case needs action now. */
export function overallTag(summary) {
  return { class: `tag ${summary.overall_status}${summary.alert ? " alert" : ""}` };
}

/** Text of that tag. A flagged case states its reason, so the red is not the only cue. */
export function overallTagText(summary) {
  const label = OVERALL_LABEL[summary.overall_status];
  const why = summary.alert ? alertText(summary) : "";
  return why ? `${label}：${why}` : label;
}

/** Application types grouped for <select> menus, in this order. */
export function groupSchemas(schemas) {
  const family = (key) => key.startsWith("dmf_") ? "原料藥／DMF（RTF 查檢表）"
    : key.startsWith("pmf_") || key.startsWith("gmp_") ? "國外藥廠 GMP（PMF／實地查核）" : "藥品查驗登記";
  const groups = new Map();
  for (const s of schemas) {
    const f = family(s.key);
    if (!groups.has(f)) groups.set(f, []);
    groups.get(f).push(s);
  }
  return [...groups].map(([label, items]) => ({ label, items }));
}

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
