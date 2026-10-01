// RegReview front-end entry: session bootstrap, hash router, app shell, login/register.
import { h, mount, toast, formData, busy, field } from "./lib/dom.js";
import { api, state, isAdmin, refreshProjects, ROLE_LABEL } from "./lib/api.js";
import { renderOverview } from "./views/overview.js";
import { renderTimeline, renderCompare } from "./views/portfolio.js";
import { renderProjects } from "./views/projects.js";
import { renderAi } from "./views/ai.js";
import { renderUsers, renderAccount } from "./views/admin.js";

const app = document.getElementById("app");

const NAV = [
  { route: "overview", icon: "📋", label: "專案總覽", render: renderOverview },
  { route: "timeline", icon: "📅", label: "時程與截止日", render: renderTimeline },
  { route: "compare", icon: "📊", label: "多專案比較", render: renderCompare },
  { route: "projects", icon: "📁", label: "專案管理", render: renderProjects },
  { route: "ai", icon: "🤖", label: "AI 文件分析", render: renderAi },
  { route: "users", icon: "👥", label: "使用者管理", render: renderUsers, admin: true },
  { route: "account", icon: "🔑", label: "帳號設定", render: renderAccount, hidden: true },
];

function parseRoute() {
  const [route = "overview", ...params] = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return { route, params };
}

export function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// ── Theme ───────────────────────────────────────────────────────────────────

function currentTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit) return explicit;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("rr-theme", next); } catch { /* ignore */ }
  render();
}

// ── Auth screen ─────────────────────────────────────────────────────────────

function renderAuth(mode = "login") {
  const registration = state.config?.registration_enabled;
  const error = h("div", { class: "error-text", role: "alert" });

  const loginForm = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      error.textContent = "";
      const data = formData(e.target);
      try {
        await busy(e.submitter, () => api("POST", "/api/auth/login", data), "登入中…");
        await boot();
      } catch (err) {
        error.textContent = err.message;
      }
    },
  },
    field("電子郵件 Email", h("input", { class: "input", name: "email", type: "email", autocomplete: "username", required: true, placeholder: "you@company.com" })),
    field("密碼 Password", h("input", { class: "input", name: "password", type: "password", autocomplete: "current-password", required: true })),
    error,
    h("button", { class: "btn btn-primary btn-block", type: "submit" }, "登入"),
  );

  const registerForm = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      error.textContent = "";
      const data = formData(e.target);
      if (data.password !== data.password2) { error.textContent = "兩次密碼輸入不一致。"; return; }
      delete data.password2;
      try {
        await busy(e.submitter, () => api("POST", "/api/auth/register", data), "建立中…");
        await boot();
        toast("帳號建立成功，歡迎使用！");
      } catch (err) {
        error.textContent = err.message;
      }
    },
  },
    h("p", { class: "help", style: "margin-top:0" }, "建立新公司帳號（第一位使用者自動成為管理員）"),
    field("公司名稱 Company", h("input", { class: "input", name: "company_name", required: true, maxlength: 200 })),
    field("姓名 Full name", h("input", { class: "input", name: "full_name", required: true, maxlength: 200, autocomplete: "name" })),
    field("電子郵件 Email", h("input", { class: "input", name: "email", type: "email", required: true, autocomplete: "email" })),
    field("密碼（至少 8 字元）", h("input", { class: "input", name: "password", type: "password", required: true, minlength: 8, autocomplete: "new-password" })),
    field("確認密碼", h("input", { class: "input", name: "password2", type: "password", required: true, minlength: 8, autocomplete: "new-password" })),
    error,
    h("button", { class: "btn btn-primary btn-block", type: "submit" }, "建立帳號"),
  );

  const tab = (id, label) => h("button", {
    type: "button", role: "tab", "aria-selected": String(mode === id),
    onclick: () => renderAuth(id),
  }, label);

  mount(app, h("div", { class: "auth-wrap" },
    h("div", { class: "card auth-card" },
      h("div", { class: "auth-head" },
        h("div", { class: "brand-icon" }, "⚕"),
        h("h1", { style: "font-size:1.5rem" }, "RegReview"),
        h("p", { class: "muted small", style: "margin:4px 0 0" }, "法規審查管理系統 · TFDA Regulatory Review"),
      ),
      registration ? h("div", { class: "tabs", role: "tablist" }, tab("login", "登入"), tab("register", "註冊")) : null,
      mode === "register" && registration ? registerForm : loginForm,
    ),
  ));
}

// ── Shell ───────────────────────────────────────────────────────────────────

function renderShell(active) {
  const shell = h("div", { class: "shell" });
  const closeNav = () => shell.classList.remove("nav-open");

  const projectSelect = h("select", {
    "aria-label": "目前專案",
    onchange: (e) => {
      state.currentProjectId = Number(e.target.value);
      navigate(`#/overview/${state.currentProjectId}`);
    },
  }, state.projects.length
    ? state.projects.map((p) => h("option", { value: p.id, selected: p.id === state.currentProjectId }, p.name))
    : h("option", { value: "" }, "（尚無專案）"));

  const sidebar = h("aside", { class: "sidebar", "aria-label": "主選單" },
    h("div", { class: "brand" },
      h("div", { class: "brand-icon" }, "⚕"),
      h("div", {}, h("div", { class: "brand-name" }, "RegReview"), h("div", { class: "brand-sub" }, "Regulatory Dashboard")),
    ),
    h("div", {},
      h("div", { class: "nav-label" }, "Navigation"),
      h("nav", { class: "nav" },
        NAV.filter((n) => !n.hidden && (!n.admin || isAdmin())).map((n) =>
          h("a", {
            href: n.route === "overview" && state.currentProjectId ? `#/overview/${state.currentProjectId}` : `#/${n.route}`,
            "aria-current": n.route === active ? "page" : null,
            onclick: closeNav,
          }, h("span", { "aria-hidden": "true" }, n.icon), n.label)),
      ),
    ),
    h("div", {}, h("div", { class: "nav-label" }, "Project"), projectSelect),
    h("div", { class: "sidebar-foot" },
      h("button", { class: "btn btn-ghost btn-sm", onclick: toggleTheme }, currentTheme() === "dark" ? "☀️ 淺色模式" : "🌙 深色模式"),
      h("div", {},
        h("b", {}, state.user.full_name), h("br"),
        state.user.email, h("br"),
        h("span", { class: "small" }, `${state.user.company_name} · ${ROLE_LABEL[state.user.role]}`),
      ),
      h("div", { class: "btn-row" },
        h("a", { class: "btn btn-ghost btn-sm", href: "#/account", onclick: closeNav }, "帳號設定"),
        h("button", { class: "btn btn-ghost btn-sm", onclick: logout }, "登出"),
      ),
      h("div", { class: "small", style: "opacity:.6" }, `v4.0 · ${state.today ?? ""}`),
    ),
  );

  const main = h("main", { class: "main", id: "main" });
  const topbar = h("div", { class: "topbar" },
    h("button", { "aria-label": "開啟選單", onclick: () => shell.classList.toggle("nav-open") }, "☰"),
    h("b", {}, "RegReview"),
  );
  shell.addEventListener("click", (e) => { if (e.target === shell) closeNav(); });
  mount(shell, sidebar, h("div", {}, topbar, main));
  mount(app, shell);
  return main;
}

async function logout() {
  try { await api("POST", "/api/auth/logout", {}); } catch { /* ignore */ }
  state.user = null;
  renderAuth();
}

// ── Router ──────────────────────────────────────────────────────────────────

let renderSeq = 0;

async function render() {
  if (!state.user) { renderAuth(); return; }
  const { route, params } = parseRoute();
  const entry = NAV.find((n) => n.route === route && (!n.admin || isAdmin())) ?? NAV[0];
  const seq = ++renderSeq;
  const main = renderShell(entry.route);
  try {
    await entry.render(main, params, { navigate, rerender: render, isCurrent: () => seq === renderSeq });
  } catch (err) {
    if (seq !== renderSeq) return;
    mount(main, h("div", { class: "notice error" }, `載入失敗：${err.message}`));
  }
  main.focus?.();
}

async function boot() {
  try {
    state.config = await api("GET", "/api/config");
  } catch (err) {
    mount(app, h("div", { class: "auth-wrap" }, h("div", { class: "notice error" }, `無法連線至伺服器：${err.message}`)));
    return;
  }
  try {
    state.user = (await api("GET", "/api/auth/me")).user;
  } catch {
    state.user = null;
  }
  if (state.user) {
    await refreshProjects();
    if (!location.hash && state.currentProjectId) location.replace(`#/overview/${state.currentProjectId}`);
  }
  render();
}

window.addEventListener("hashchange", render);
window.addEventListener("rr:logged-out", () => { toast("登入已逾時，請重新登入。", "error"); renderAuth(); });
boot();
