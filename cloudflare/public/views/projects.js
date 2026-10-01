// Project CRUD: create from TFDA template, edit, archive/restore, delete (admin).
import { h, mount, toast, formData, busy, confirmDialog, field } from "../lib/dom.js";
import { api, state, canEdit, isAdmin, refreshProjects, PROJECT_STATUS_LABEL, OVERALL_LABEL, OVERALL_CLASS } from "../lib/api.js";

export async function renderProjects(main, _params, ctx) {
  const [list, schemas] = await Promise.all([
    api("GET", "/api/projects?include_archived=1"),
    state.schemas.length ? { schemas: state.schemas } : api("GET", "/api/schemas"),
  ]);
  if (!ctx.isCurrent()) return;
  state.schemas = schemas.schemas;
  const projects = list.projects;

  const reload = async (focusId) => {
    await refreshProjects();
    if (focusId) state.currentProjectId = focusId;
    ctx.rerender();
  };

  mount(main,
    h("header", { class: "page-header" },
      h("div", {}, h("span", { class: "eyebrow" }, "📁 Projects"), h("h1", {}, "專案管理"),
        h("p", { class: "page-sub" }, "建立、編輯、封存法規審查專案"))),

    h("section", { class: "card" },
      h("div", { class: "card-title" }, `現有專案（${projects.length}）`,
        canEdit() && !projects.length ? h("button", {
          class: "btn btn-sm",
          onclick: async (e) => {
            try {
              await busy(e.currentTarget, () => api("POST", "/api/projects/demo", {}));
              toast("已建立示範專案");
              await reload();
            } catch (err) { toast(err.message, "error"); }
          },
        }, "載入示範專案") : null),
      projects.length
        ? projects.map((p) => projectRow(p, reload))
        : h("p", { class: "muted" }, "尚無專案。請使用下方表單建立第一個專案。"),
    ),

    canEdit() ? createForm(reload, ctx) : null,
  );
}

function projectRow(p, reload) {
  const editable = canEdit();
  const setStatus = async (status) => {
    try {
      await api("PATCH", `/api/projects/${p.id}`, { status });
      toast(status === "archived" ? "已封存" : status === "completed" ? "已標記結案" : "已恢復");
      await reload();
    } catch (err) { toast(err.message, "error"); }
  };
  return h("div", { class: "project-row" },
    h("div", { style: "min-width:0" },
      h("a", { href: `#/overview/${p.id}`, class: "item-name" }, p.name),
      h("div", { class: "project-meta" },
        h("span", {}, p.schema_name),
        h("span", {}, `截止：${p.deadline ?? "未設定"}`),
        h("span", {}, `完成 ${p.summary.completion_rate.toFixed(0)}%`),
        h("span", { class: `badge ${p.status === "active" ? "b-info" : "b-neutral"}` }, PROJECT_STATUS_LABEL[p.status]),
        p.status === "active" ? h("span", { class: `badge ${OVERALL_CLASS[p.summary.overall_status]}` }, OVERALL_LABEL[p.summary.overall_status]) : null,
      ),
    ),
    editable ? h("div", { class: "btn-row" },
      h("button", { class: "btn btn-sm", onclick: () => editDialog(p, reload) }, "編輯"),
      p.status === "active"
        ? [h("button", { class: "btn btn-sm", onclick: () => setStatus("completed") }, "結案"),
          h("button", { class: "btn btn-sm", onclick: () => setStatus("archived") }, "封存")]
        : h("button", { class: "btn btn-sm", onclick: () => setStatus("active") }, "恢復"),
      isAdmin() ? h("button", {
        class: "btn btn-sm btn-danger",
        onclick: async () => {
          if (!(await confirmDialog(`永久刪除「${p.name}」及其所有檢查項目？此動作無法復原。`, { okLabel: "永久刪除", danger: true }))) return;
          try { await api("DELETE", `/api/projects/${p.id}`); toast("已刪除"); await reload(); } catch (err) { toast(err.message, "error"); }
        },
      }, "刪除") : null,
    ) : null,
  );
}

function editDialog(p, reload) {
  const error = h("div", { class: "error-text", role: "alert" });
  const dlg = h("dialog", { "aria-label": "編輯專案" },
    h("form", {
      onsubmit: async (e) => {
        e.preventDefault();
        try {
          await busy(e.submitter, () => api("PATCH", `/api/projects/${p.id}`, formData(e.target)));
          dlg.close();
          toast("已儲存");
          await reload();
        } catch (err) { error.textContent = err.message; }
      },
    },
      h("h2", { style: "font-size:1.15rem;margin-bottom:14px" }, "編輯專案"),
      field("專案名稱", h("input", { class: "input", name: "name", value: p.name, required: true, maxlength: 200 })),
      field("截止日期", h("input", { class: "input", name: "deadline", type: "date", value: p.deadline ?? "" })),
      field("說明", h("textarea", { class: "input", name: "description", maxlength: 2000 }, p.description ?? "")),
      error,
      h("div", { class: "btn-row", style: "justify-content:flex-end" },
        h("button", { class: "btn", type: "button", onclick: () => dlg.close() }, "取消"),
        h("button", { class: "btn btn-primary", type: "submit" }, "儲存"),
      ),
    ),
  );
  dlg.addEventListener("close", () => dlg.remove());
  document.body.appendChild(dlg);
  dlg.showModal();
}

function createForm(reload, ctx) {
  const deadline = h("input", { class: "input", name: "deadline", type: "date" });
  const schemaSelect = h("select", { class: "input", name: "schema_type", onchange: () => updateHelp() },
    state.schemas.map((s) => h("option", { value: s.key }, `${s.name_zh}（${s.item_count} 項）`)));
  const help = h("span", { class: "help" });
  const updateHelp = () => {
    const s = state.schemas.find((x) => x.key === schemaSelect.value);
    help.textContent = s ? `留空則預設為 ${s.deadline_default_days} 天後` : "";
  };
  updateHelp();

  return h("section", { class: "card" },
    h("div", { class: "card-title" }, "➕ 建立新專案"),
    h("form", {
      onsubmit: async (e) => {
        e.preventDefault();
        try {
          const d = await busy(e.submitter, () => api("POST", "/api/projects", formData(e.target)));
          toast(`專案「${d.project.name}」建立成功`);
          await reload(d.project.id);
          ctx.navigate(`#/overview/${d.project.id}`);
        } catch (err) { toast(err.message, "error"); }
      },
    },
      h("div", { class: "form-grid" },
        field("專案名稱", h("input", { class: "input", name: "name", required: true, maxlength: 200, placeholder: "例如：Fenogal 許可證展延" })),
        field("申請類型", schemaSelect),
        h("div", { class: "field" }, h("label", { for: "new-deadline" }, "截止日期"), Object.assign(deadline, { id: "new-deadline" }), help),
      ),
      field("說明（選填）", h("textarea", { class: "input", name: "description", maxlength: 2000 })),
      h("label", { class: "check", style: "margin-bottom:14px" },
        h("input", { type: "checkbox", name: "use_template", checked: true }),
        "自動建立該申請類型的 TFDA 標準檢查項目"),
      h("button", { class: "btn btn-primary", type: "submit" }, "建立專案"),
    ),
  );
}
