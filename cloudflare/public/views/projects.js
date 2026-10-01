// Case management: ledger of cases, create from TFDA template, edit, close, archive, delete.
import { h, mount, toast, formData, busy, confirmDialog, field } from "../lib/dom.js";
import { api, state, canEdit, isAdmin, refreshProjects, PROJECT_STATUS_LABEL, OVERALL_LABEL } from "../lib/api.js";
import { countStrip } from "../lib/charts.js";

export async function renderProjects(main, _params, ctx) {
  const [list, schemas] = await Promise.all([
    api("GET", "/api/projects?include_archived=1"),
    state.schemas.length ? { schemas: state.schemas } : api("GET", "/api/schemas"),
  ]);
  if (!ctx.isCurrent()) return;
  state.schemas = schemas.schemas;
  const projects = list.projects;
  const active = projects.filter((p) => p.status === "active");
  const closed = projects.filter((p) => p.status !== "active");

  const reload = async (focusId) => {
    await refreshProjects();
    if (focusId) state.currentProjectId = focusId;
    ctx.rerender();
  };

  mount(main,
    h("header", { class: "page-head" },
      h("h1", {}, "案件管理"),
      h("p", {}, "建立新的查驗登記案件，或調整既有案件的名稱、截止日與狀態。")),

    projects.length ? null : h("section", { class: "sheet empty" },
      h("h2", {}, "還沒有任何案件"),
      h("p", {}, "用下方表單建立第一個案件，或先載入兩個示範案件看看。"),
      canEdit() ? h("div", { class: "btn-row" }, h("button", {
        class: "btn",
        onclick: async (e) => {
          try {
            await busy(e.currentTarget, () => api("POST", "/api/projects/demo", {}));
            toast("已載入示範案件");
            await reload();
          } catch (err) { toast(err.message, "error"); }
        },
      }, "載入示範案件")) : null),

    active.length ? ledger("進行中", active, reload) : null,
    closed.length ? ledger("已結案與封存", closed, reload) : null,
    canEdit() ? createForm(reload, ctx) : null,
  );
}

function ledger(title, projects, reload) {
  return h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, title, h("span", { class: "aside" }, `${projects.length} 件`)),
    h("div", { class: "table-wrap" }, h("table", {},
      h("thead", {}, h("tr", {}, ["案件", "文件狀態", "截止日", "狀態", ""].map((t) => h("th", {}, t)))),
      h("tbody", {}, projects.map((p) => row(p, reload))),
    )),
  );
}

function row(p, reload) {
  const editable = canEdit();
  const setStatus = async (status, done) => {
    try {
      await api("PATCH", `/api/projects/${p.id}`, { status });
      toast(done);
      await reload();
    } catch (err) { toast(err.message, "error"); }
  };
  return h("tr", {},
    h("td", {},
      h("a", { href: `#/overview/${p.id}`, class: "ledger-name" }, p.name),
      h("div", { class: "item-sub" }, p.schema_name)),
    h("td", { style: "min-width:150px;vertical-align:middle" },
      countStrip(p.summary.status_counts, { mini: true }),
      h("div", { class: "item-sub" }, `${p.summary.completed} ／ ${p.summary.total} 份完成`)),
    h("td", { class: "nowrap" }, p.deadline ?? "未設定"),
    h("td", {}, p.status === "active"
      ? h("span", { class: `tag ${p.summary.overall_status}` }, OVERALL_LABEL[p.summary.overall_status])
      : h("span", { class: "tag" }, PROJECT_STATUS_LABEL[p.status])),
    h("td", {}, editable ? h("div", { class: "btn-row", style: "justify-content:flex-end" },
      h("button", { class: "btn btn-sm", onclick: () => editDialog(p, reload) }, "編輯"),
      p.status === "active"
        ? [h("button", { class: "btn btn-sm", onclick: () => setStatus("completed", "已結案") }, "結案"),
          h("button", { class: "btn btn-sm", onclick: () => setStatus("archived", "已封存") }, "封存")]
        : h("button", { class: "btn btn-sm", onclick: () => setStatus("active", "已恢復") }, "恢復"),
      isAdmin() ? h("button", {
        class: "btn btn-sm btn-danger",
        onclick: async () => {
          if (!(await confirmDialog(`永久刪除「${p.name}」與其所有文件項目？刪除後無法復原。`, { okLabel: "永久刪除", danger: true }))) return;
          try { await api("DELETE", `/api/projects/${p.id}`); toast("已刪除"); await reload(); } catch (err) { toast(err.message, "error"); }
        },
      }, "刪除") : null,
    ) : null),
  );
}

function editDialog(p, reload) {
  const error = h("div", { class: "error-text", role: "alert" });
  const dlg = h("dialog", { "aria-labelledby": "edit-title" },
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
      h("h2", { id: "edit-title" }, "編輯案件"),
      field("案件名稱", h("input", { class: "input", name: "name", value: p.name, required: true, maxlength: 200 })),
      field("截止日", h("input", { class: "input", name: "deadline", type: "date", value: p.deadline ?? "" })),
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
  const schemaSelect = h("select", { class: "input", name: "schema_type", onchange: () => updateHelp() },
    state.schemas.map((s) => h("option", { value: s.key }, `${s.name_zh}（${s.item_count} 份文件）`)));
  const deadlineField = field("截止日", h("input", { class: "input", name: "deadline", type: "date" }));
  const help = h("span", { class: "help" });
  deadlineField.appendChild(help);
  const updateHelp = () => {
    const s = state.schemas.find((x) => x.key === schemaSelect.value);
    help.textContent = s ? `留空會設為 ${s.deadline_default_days} 天後` : "";
  };
  updateHelp();

  return h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, "建立案件"),
    h("form", {
      onsubmit: async (e) => {
        e.preventDefault();
        try {
          const d = await busy(e.submitter, () => api("POST", "/api/projects", formData(e.target)));
          toast(`已建立「${d.project.name}」`);
          await reload(d.project.id);
          ctx.navigate(`#/overview/${d.project.id}`);
        } catch (err) { toast(err.message, "error"); }
      },
    },
      h("div", { class: "form-grid" },
        field("案件名稱", h("input", { class: "input", name: "name", required: true, maxlength: 200, placeholder: "例如 Fenogal 許可證展延" })),
        field("申請類型", schemaSelect),
        deadlineField,
      ),
      field("說明（選填）", h("textarea", { class: "input", name: "description", maxlength: 2000 })),
      h("label", { class: "check", style: "margin-bottom:16px" },
        h("input", { type: "checkbox", name: "use_template", checked: true }),
        "依申請類型帶入 TFDA 文件清單"),
      h("button", { class: "btn btn-primary", type: "submit" }, "建立案件"),
    ),
  );
}
