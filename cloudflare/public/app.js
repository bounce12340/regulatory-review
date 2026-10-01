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
  { route: "overview", label: "案件總覽", render: renderOverview },
  { route: "timeline", label: "時程與截止日", render: renderTimeline },
  { route: "compare", label: "案件比較", render: renderCompare },
  { route: "projects", label: "案件管理", render: renderProjects },
  { route: "ai", label: "AI 文件分析", render: renderAi },
  { route: "users", label: "使用者管理", render: renderUsers, admin: true },
  { route: "account", label: "帳號設定", render: renderAccount, hidden: true },
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
  const register = mode === "register" && registration;
  const error = h("div", { class: "error-text", role: "alert" });

  const loginForm = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      error.textContent = "";
      const data = formData(e.target);
      try {
        await busy(e.submitter, () => api("POST", "/api/auth/login", data), "登入中");
        await boot();
      } catch (err) {
        error.textContent = err.message;
      }
    },
  },
    field("電子郵件", h("input", { class: "input", name: "email", type: "email", autocomplete: "username", required: true })),
    field("密碼", h("input", { class: "input", name: "password", type: "password", autocomplete: "current-password", required: true })),
    error,
    h("button", { class: "btn btn-primary btn-block", type: "submit" }, "登入"),
  );

  const registerForm = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      error.textContent = "";
      const data = formData(e.target);
      if (data.password !== data.password2) { error.textContent = "兩次輸入的密碼不一致。"; return; }
      delete data.password2;
      try {
        await busy(e.submitter, () => api("POST", "/api/auth/register", data), "建立中");
        await boot();
        toast("已建立公司帳號");
      } catch (err) {
        error.textContent = err.message;
      }
    },
  },
    field("公司名稱", h("input", { class: "input", name: "company_name", required: true, maxlength: 200, autocomplete: "organization" })),
    field("你的姓名", h("input", { class: "input", name: "full_name", required: true, maxlength: 200, autocomplete: "name" })),
    field("電子郵件", h("input", { class: "input", name: "email", type: "email", required: true, autocomplete: "email" })),
    field("密碼（至少 8 個字元）", h("input", { class: "input", name: "password", type: "password", required: true, minlength: 8, autocomplete: "new-password" })),
    field("再輸入一次密碼", h("input", { class: "input", name: "password2", type: "password", required: true, minlength: 8, autocomplete: "new-password" })),
    error,
    h("button", { class: "btn btn-primary btn-block", type: "submit" }, "建立公司帳號"),
  );

  const sample = [
    ["換發新證申請書", "已完成", "ok"],
    ["藥典／廠規檢驗規格變更備查", "審查中", "rv"],
    ["原料藥製造廠 GMP 證明文件", "受阻", "bk"],
  ];

  mount(app, h("div", { class: "auth" },
    h("section", { class: "auth-cover" },
      h("div", { class: "seal-mark", "aria-hidden": "true" }, "審"),
      h("div", {},
        h("h1", {}, "TFDA 查驗登記文件，", h("br"), "一份一份追到可以送件。"),
        h("p", { style: "margin-top:14px" }, "依申請類型帶入文件清單，追蹤每份文件的狀態、風險與截止日；送件前也能先讓 AI 比對缺口。"),
      ),
      h("div", { class: "auth-sample", "aria-hidden": "true" },
        sample.map(([name, status, cls]) => h("div", { class: "row" }, h("span", {}, name), h("span", { class: cls }, status)))),
    ),
    h("section", { class: "auth-form" },
      h("div", { class: "inner" },
        h("h2", {}, register ? "建立公司帳號" : "登入 RegReview"),
        h("p", { class: "lead" }, register ? "第一位註冊的人會成為公司的管理員，之後可以邀請同事。" : "使用公司帳號登入。"),
        register ? registerForm : loginForm,
        registration ? h("p", { class: "auth-switch" },
          register ? "已經有帳號？" : "公司還沒有帳號？",
          h("button", { class: "link-btn", type: "button", onclick: () => renderAuth(register ? "login" : "register") },
            register ? "改為登入" : "建立公司帳號")) : null,
      ),
    ),
  ));
}

// ── Shell ───────────────────────────────────────────────────────────────────

function renderShell(active) {
  const shell = h("div", { class: "shell" });
  const closeNav = () => shell.classList.remove("nav-open");

  const projectSelect = h("select", {
    id: "case-switch",
    onchange: (e) => {
      state.currentProjectId = Number(e.target.value);
      navigate(`#/overview/${state.currentProjectId}`);
    },
  }, state.projects.length
    ? state.projects.map((p) => h("option", { value: p.id, selected: p.id === state.currentProjectId }, p.name))
    : h("option", { value: "" }, "尚無案件"));

  const sidebar = h("aside", { class: "sidebar", "aria-label": "主選單" },
    h("a", { class: "brand", href: state.currentProjectId ? `#/overview/${state.currentProjectId}` : "#/overview", onclick: closeNav },
      h("div", { class: "seal-mark", "aria-hidden": "true" }, "審"),
      h("div", {}, h("div", { class: "brand-name" }, "RegReview"), h("div", { class: "brand-sub" }, "法規審查管理")),
    ),
    h("nav", { class: "nav" },
      NAV.filter((n) => !n.hidden && (!n.admin || isAdmin())).map((n) =>
        h("a", {
          href: n.route === "overview" && state.currentProjectId ? `#/overview/${state.currentProjectId}` : `#/${n.route}`,
          "aria-current": n.route === active ? "page" : null,
          onclick: closeNav,
        }, n.label)),
    ),
    h("div", { class: "side-block" }, h("label", { class: "side-label", for: "case-switch" }, "目前案件"), projectSelect),
    h("div", { class: "sidebar-foot" },
      h("div", {},
        h("strong", {}, state.user.full_name),
        state.user.company_name, `（${ROLE_LABEL[state.user.role]}）`),
      h("div", { class: "link-row" },
        h("a", { href: "#/account", onclick: closeNav, class: "small" }, "帳號設定"),
        h("button", { class: "link-btn", onclick: toggleTheme }, currentTheme() === "dark" ? "淺色模式" : "深色模式"),
        h("button", { class: "link-btn", onclick: logout }, "登出"),
      ),
    ),
  );

  const main = h("main", { class: "main", id: "main", tabindex: "-1" });
  const topbar = h("div", { class: "topbar" },
    h("button", { class: "menu-btn", "aria-label": "開啟選單", onclick: () => shell.classList.toggle("nav-open") }, "選單"),
    h("div", { class: "seal-mark", "aria-hidden": "true" }, "審"),
    h("b", { style: "font-family:var(--kai)" }, "RegReview"),
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
    mount(main, h("div", { class: "notice error" }, `無法載入這個頁面：${err.message}`));
  }
  if (document.activeElement === document.body) main.focus({ preventScroll: true });
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
