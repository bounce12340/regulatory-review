// Portfolio views: Gantt timeline across cases, and a side-by-side ledger.
import { h, mount } from "../lib/dom.js";
import { api, state, refreshProjects, timelineElapsed, overallTag, STATUS_LABEL, RISK_LABEL, OVERALL_LABEL } from "../lib/api.js";
import { gantt, countStrip, docStrip } from "../lib/charts.js";

function head(title, sub) {
  return h("header", { class: "page-head" }, h("h1", {}, title), sub ? h("p", {}, sub) : null);
}

function noProjects() {
  return h("section", { class: "sheet empty" },
    h("h2", {}, "沒有進行中的案件"),
    h("p", {}, "建立案件或恢復已封存的案件後，會顯示在這裡。"),
    h("div", { class: "btn-row" }, h("a", { class: "btn btn-primary", href: "#/projects" }, "前往案件管理")));
}

export async function renderTimeline(main, _params, ctx) {
  await refreshProjects();
  if (!ctx.isCurrent()) return;
  const projects = state.projects.filter((p) => p.status === "active");
  if (!projects.length) { mount(main, head("時程與截止日"), noProjects()); return; }

  const behind = projects.filter((p) => {
    const e = timelineElapsed(p, state.today);
    return e !== null && e > p.summary.completion_rate;
  });

  mount(main,
    head("時程與截止日", "每條橫條是一個案件，從建立日延伸到截止日；深色部分是已完成的文件比例。"),
    h("section", { class: "sheet" }, gantt(projects, state.today)),
    h("section", { class: "sheet" },
      h("h2", { class: "sheet-title" }, "進度落後的案件", h("span", { class: "aside" }, "時程消耗超過文件完成度")),
      behind.length
        ? h("div", { class: "table-wrap" }, h("table", {},
          h("thead", {}, h("tr", {}, ["案件", "文件完成", "時程已過", "差距"].map((t) => h("th", {}, t)))),
          h("tbody", {}, behind.map((p) => {
            const e = timelineElapsed(p, state.today);
            return h("tr", {},
              h("td", {}, h("a", { href: `#/overview/${p.id}`, class: "item-name" }, p.name)),
              h("td", {}, `${p.summary.completion_rate.toFixed(0)}%`),
              h("td", {}, `${e.toFixed(0)}%`),
              h("td", { class: "risk high" }, `${(e - p.summary.completion_rate).toFixed(0)} 個百分點`));
          }))))
        : h("p", { class: "muted" }, "所有案件的文件完成度都跟得上時程。"),
    ),
  );
}

export async function renderCompare(main, _params, ctx) {
  await refreshProjects();
  if (!ctx.isCurrent()) return;
  const projects = state.projects.filter((p) => p.status === "active");
  if (!projects.length) { mount(main, head("案件比較"), noProjects()); return; }

  mount(main,
    head("案件比較", "所有進行中的案件並列；點開下方明細可看每份文件的狀態。"),
    h("section", { class: "sheet" },
      h("div", { class: "table-wrap" }, h("table", { class: "compare" },
        h("thead", {}, h("tr", {}, ["案件", "文件狀態", "完成", "高風險", "截止日", "整體"].map((t) => h("th", {}, t)))),
        h("tbody", {}, projects.map((p) => h("tr", {},
          h("td", { class: "k-name" }, h("a", { href: `#/overview/${p.id}`, class: "item-name" }, p.name), h("div", { class: "item-sub" }, p.schema_name)),
          h("td", { class: "k-strip" }, countStrip(p.summary.status_counts, { mini: true })),
          h("td", { class: "nowrap k-done" }, `${p.summary.completed} ／ ${p.summary.total - (p.summary.not_applicable ?? 0)}`),
          h("td", { class: "k-risk" }, p.summary.high_risk_items
            ? h("span", { class: p.summary.alert ? "risk high" : "nowrap" }, p.summary.high_risk_items)
            : h("span", { class: "muted" }, "0")),
          h("td", { class: "nowrap k-due" }, p.deadline ?? "—",
            p.summary.days_left !== null ? h("div", {
              class: `item-sub${p.summary.alert_reasons.some((r) => r === "overdue" || r === "due_soon") ? " risk high" : ""}`,
            },
              p.summary.days_left < 0 ? `逾期 ${-p.summary.days_left} 天` : `剩 ${p.summary.days_left} 天`) : null),
          h("td", { class: "k-tag" }, h("span", overallTag(p.summary), OVERALL_LABEL[p.summary.overall_status])),
        ))),
      )),
    ),
    h("section", { class: "sheet" },
      h("h2", { class: "sheet-title" }, "明細"),
      projects.map((p) => detailsFor(p)),
    ),
  );
}

function detailsFor(p) {
  const body = h("div", { class: "gap-body", style: "max-width:none" }, h("p", { class: "muted" }, "載入中…"));
  let loaded = false;
  return h("details", {
    class: "gap",
    ontoggle: async (e) => {
      if (!e.target.open || loaded) return;
      loaded = true;
      try {
        const d = await api("GET", `/api/projects/${p.id}`);
        mount(body,
          docStrip(d.items),
          h("div", { class: "table-wrap", style: "margin-top:10px" }, h("table", { class: "doc-list" },
            h("thead", {}, h("tr", {}, ["文件", "狀態", "風險", "備註"].map((t) => h("th", {}, t)))),
            h("tbody", {}, d.items.map((i) => h("tr", {},
              h("td", { class: "d-name" }, i.item_name),
              h("td", { class: "d-status" }, h("span", { class: `status-text s-${i.status}` }, STATUS_LABEL[i.status])),
              h("td", { class: "d-risk" }, h("span", { class: `risk ${i.risk_level}` }, RISK_LABEL[i.risk_level])),
              h("td", { class: "small d-notes" }, i.notes ?? ""),
            ))))));
      } catch (err) {
        loaded = false;
        mount(body, h("p", { class: "error-text" }, err.message));
      }
    },
  }, h("summary", {}, p.name, h("span", { class: "muted small", style: "font-weight:400" }, `完成 ${p.summary.completion_rate.toFixed(0)}%`)), body);
}
