// Company user management (admin) and personal account settings.
import { h, mount, toast, formData, busy, field } from "../lib/dom.js";
import { api, state, ROLE_LABEL } from "../lib/api.js";

const ROLES = ["admin", "member", "viewer"];

export async function renderUsers(main, _params, ctx) {
  const { users } = await api("GET", "/api/users");
  if (!ctx.isCurrent()) return;

  const update = async (u, patch) => {
    try {
      await api("PATCH", `/api/users/${u.id}`, patch);
      toast("已更新");
      ctx.rerender();
    } catch (err) { toast(err.message, "error"); ctx.rerender(); }
  };

  mount(main,
    h("header", { class: "page-header" },
      h("div", {}, h("span", { class: "eyebrow" }, "👥 Users"), h("h1", {}, "使用者管理"),
        h("p", { class: "page-sub" }, `${state.user.company_name} 的成員與權限`))),
    h("section", { class: "card" },
      h("div", { class: "card-title" }, `成員（${users.length}）`),
      h("p", { class: "help", style: "margin-top:-8px" }, "管理員：全部權限｜成員：編輯專案與執行 AI 分析｜檢視者：唯讀"),
      h("div", { class: "table-wrap" }, h("table", {},
        h("thead", {}, h("tr", {}, ["姓名", "Email", "角色", "狀態", "最後登入"].map((t) => h("th", {}, t)))),
        h("tbody", {}, users.map((u) => {
          const self = u.id === state.user.id;
          return h("tr", {},
            h("td", { class: "item-name" }, u.full_name, self ? h("span", { class: "muted small" }, "（你）") : null),
            h("td", {}, u.email),
            h("td", {}, self
              ? ROLE_LABEL[u.role]
              : h("select", { class: "input", "aria-label": `${u.full_name} 角色`, onchange: (e) => update(u, { role: e.target.value }) },
                ROLES.map((r) => h("option", { value: r, selected: u.role === r }, ROLE_LABEL[r])))),
            h("td", {}, self
              ? h("span", { class: "badge b-ok" }, "啟用")
              : h("label", { class: "check" },
                h("input", { type: "checkbox", checked: u.is_active, onchange: (e) => update(u, { is_active: e.target.checked }) }),
                u.is_active ? "啟用" : "停用")),
            h("td", { class: "small muted" }, u.last_login ? u.last_login.slice(0, 16).replace("T", " ") : "—"),
          );
        })),
      )),
    ),
    h("section", { class: "card" },
      h("div", { class: "card-title" }, "➕ 新增成員"),
      h("form", {
        onsubmit: async (e) => {
          e.preventDefault();
          try {
            await busy(e.submitter, () => api("POST", "/api/users", formData(e.target)));
            toast("已新增成員，請將初始密碼以安全管道告知對方");
            ctx.rerender();
          } catch (err) { toast(err.message, "error"); }
        },
      },
        h("div", { class: "form-grid" },
          field("姓名", h("input", { class: "input", name: "full_name", required: true, maxlength: 200 })),
          field("Email", h("input", { class: "input", name: "email", type: "email", required: true })),
          field("初始密碼（至少 8 字元）", h("input", { class: "input", name: "password", type: "password", required: true, minlength: 8, autocomplete: "new-password" })),
          field("角色", h("select", { class: "input", name: "role" }, ROLES.map((r) => h("option", { value: r, selected: r === "member" }, ROLE_LABEL[r])))),
        ),
        h("button", { class: "btn btn-primary", type: "submit" }, "新增成員"),
      ),
    ),
  );
}

export async function renderAccount(main) {
  const error = h("div", { class: "error-text", role: "alert" });
  mount(main,
    h("header", { class: "page-header" },
      h("div", {}, h("span", { class: "eyebrow" }, "🔑 Account"), h("h1", {}, "帳號設定"),
        h("p", { class: "page-sub" }, `${state.user.full_name} · ${state.user.email} · ${ROLE_LABEL[state.user.role]}`))),
    h("section", { class: "card", style: "max-width:520px" },
      h("div", { class: "card-title" }, "變更密碼"),
      h("form", {
        onsubmit: async (e) => {
          e.preventDefault();
          error.textContent = "";
          const data = formData(e.target);
          if (data.new_password !== data.new_password2) { error.textContent = "兩次新密碼輸入不一致。"; return; }
          try {
            await busy(e.submitter, () => api("POST", "/api/auth/password", { current_password: data.current_password, new_password: data.new_password }));
            e.target.reset();
            toast("密碼已更新，其他裝置已登出");
          } catch (err) { error.textContent = err.message; }
        },
      },
        field("目前密碼", h("input", { class: "input", name: "current_password", type: "password", required: true, autocomplete: "current-password" })),
        field("新密碼（至少 8 字元）", h("input", { class: "input", name: "new_password", type: "password", required: true, minlength: 8, autocomplete: "new-password" })),
        field("確認新密碼", h("input", { class: "input", name: "new_password2", type: "password", required: true, minlength: 8, autocomplete: "new-password" })),
        error,
        h("button", { class: "btn btn-primary", type: "submit" }, "更新密碼"),
      ),
    ),
  );
}
