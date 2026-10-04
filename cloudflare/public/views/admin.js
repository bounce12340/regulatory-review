// Company user management (admin) and personal account settings.
import { h, mount, toast, formData, busy, field, confirmDialog } from "../lib/dom.js";
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

  const remove = async (u) => {
    const ok = await confirmDialog(
      `要刪除「${u.full_name}」（${u.email}）嗎？帳號會永久移除，對方立即登出。只是暫時不讓對方登入的話，改用「停用」即可。`,
      { okLabel: "刪除帳號", danger: true });
    if (!ok) return;
    try {
      await api("DELETE", `/api/users/${u.id}`);
      toast(`已刪除「${u.full_name}」`);
      ctx.rerender();
    } catch (err) { toast(err.message, "error"); }
  };

  mount(main,
    h("header", { class: "page-head" },
      h("h1", {}, "使用者管理"),
      h("p", {}, `${state.user.company_name} 的成員與權限。管理員可管理所有設定；成員可編輯案件與執行 AI 分析；檢視者只能瀏覽。`)),
    h("section", { class: "sheet" },
      h("h2", { class: "sheet-title" }, "成員", h("span", { class: "aside" }, `${users.length} 位`)),
      h("div", { class: "table-wrap" }, h("table", { class: "members" },
        h("thead", {}, h("tr", {}, ["姓名", "Email", "角色", "狀態", "最後登入", ""].map((t) => h("th", {}, t)))),
        h("tbody", {}, users.map((u) => {
          const self = u.id === state.user.id;
          return h("tr", {},
            h("td", { class: "item-name" }, u.full_name, self ? h("span", { class: "muted small", style: "font-weight:400" }, "（你）") : null),
            h("td", { class: "m-email" }, u.email),
            h("td", { class: "m-role" }, self
              ? ROLE_LABEL[u.role]
              : h("select", { class: "input", "aria-label": `${u.full_name} 角色`, onchange: (e) => update(u, { role: e.target.value }) },
                ROLES.map((r) => h("option", { value: r, selected: u.role === r }, ROLE_LABEL[r])))),
            h("td", { class: "m-active" }, self
              ? "啟用中"
              : h("label", { class: "check" },
                h("input", { type: "checkbox", checked: u.is_active, onchange: (e) => update(u, { is_active: e.target.checked }) }),
                u.is_active ? "啟用中" : "已停用")),
            h("td", { class: "small muted m-login" }, u.last_login ? u.last_login.slice(0, 16).replace("T", " ") : "—"),
            h("td", { class: "m-del" }, self ? null
              : h("button", { class: "btn btn-sm btn-danger", "aria-label": `刪除 ${u.full_name}`, onclick: () => remove(u) }, "刪除")),
          );
        })),
      )),
    ),
    h("section", { class: "sheet" },
      h("h2", { class: "sheet-title" }, "新增成員"),
      h("form", {
        class: "form-narrow",
        onsubmit: async (e) => {
          e.preventDefault();
          try {
            await busy(e.submitter, () => api("POST", "/api/users", formData(e.target)));
            toast("已新增成員。請用安全的方式把初始密碼告訴對方。");
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
    h("header", { class: "page-head" },
      h("h1", {}, "帳號設定"),
      h("p", {}, `${state.user.full_name}（${state.user.email}），${state.user.company_name}的${ROLE_LABEL[state.user.role]}。`)),
    h("section", { class: "sheet", style: "max-width:520px" },
      h("h2", { class: "sheet-title" }, "變更密碼"),
      h("form", {
        onsubmit: async (e) => {
          e.preventDefault();
          error.textContent = "";
          const data = formData(e.target);
          if (data.new_password !== data.new_password2) { error.textContent = "兩次新密碼輸入不一致。"; return; }
          try {
            await busy(e.submitter, () => api("POST", "/api/auth/password", { current_password: data.current_password, new_password: data.new_password }));
            e.target.reset();
            toast("已更新密碼，其他裝置上的登入已失效。");
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
