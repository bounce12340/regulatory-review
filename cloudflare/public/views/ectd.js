// eCTD: package a case's PDFs into an eCTD sequence, and check any eCTD ZIP or folder
// against TFDA's validation rules before it goes to ExPress.
import { h, mount, toast, download, busy, field, confirmDialog } from "../lib/dom.js";
import { api, state, canEdit, fileSize } from "../lib/api.js";
import { PLACEABLE, NODE } from "../lib/ectd-spec.js";
import { itemNodes, nodesIn } from "../lib/ectd.js";
import { RULES, zipEntries, folderEntries, validateEntries, loadBundledUtil, summarize, readManifests } from "../lib/ectd-validate.js";
import { currentLeaves } from "../lib/ectd-lifecycle.js";
import {
  planPaths, writePackage, envelopeProblems, newUuid, UNIT_TYPES, OBJECTIVES, TIERS,
} from "../lib/ectd-build.js";

const RULE = new Map(RULES.map((r) => [r.id, r]));
const UTIL_URL = new URL("../vendor/ectd/", import.meta.url);
// Module 4/5 need study-level node extensions; not packaged yet.
const NOT_PACKAGED = new Set(["module4_nonclinical", "module5_clinical"]);
const TIER2_FOR = { new_drug_registration: "new-drugs-application" };
// What eCTD accepts as documents (TW M1 also takes XML; that is only used for tw-regional.xml).
const PACKABLE = new Set(["pdf", "jpg", "jpeg", "png", "svg", "gif"]);
const extOf = (name) => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");

let tab = "build";
let lastReport = null;

export async function renderEctd(main, params, ctx) {
  const pid = Number(params[0]) || state.currentProjectId;
  const tabs = h("div", { class: "seg no-print", role: "tablist", "aria-label": "eCTD 功能" },
    tabButton("build", "打包成 eCTD"), tabButton("validate", "驗證 eCTD 送件包"));
  const body = h("div", {});
  mount(main,
    h("header", { class: "page-head" },
      h("h1", {}, "eCTD 送件"),
      h("p", {}, "把案件裡的 PDF 依 TFDA eCTD 指引打包成送件 ZIP，或檢查已做好的 eCTD 是否符合驗證規則 A–P。全部在瀏覽器內處理，檔案不會另外上傳。")),
    tabs, body);
  await draw();

  function tabButton(key, label) {
    return h("button", {
      type: "button", role: "tab", "aria-selected": String(tab === key), class: "seg-btn",
      onclick: async (e) => {
        tab = key;
        tabs.querySelectorAll("[role=tab]").forEach((b) => b.setAttribute("aria-selected", String(b === e.currentTarget)));
        await draw();
      },
    }, label);
  }

  async function draw() {
    if (tab === "validate") { mount(body, validatePanel()); return; }
    if (!pid) {
      mount(body, h("section", { class: "sheet empty" }, h("h2", {}, "先選擇一個案件"), h("p", {}, "打包用的是案件裡各檢查項目的附件。"),
        h("div", { class: "btn-row" }, h("a", { class: "btn btn-primary", href: "#/projects" }, "前往案件管理"))));
      return;
    }
    mount(body, h("p", { class: "muted" }, "正在載入案件…"));
    const detail = await api("GET", `/api/projects/${pid}`);
    if (!ctx.isCurrent() || tab !== "build") return;
    mount(body, buildPanel(detail));
  }
}

// ── Build ───────────────────────────────────────────────────────────────────

function defaults(detail) {
  const p = detail.project;
  const tier2 = TIER2_FOR[p.schema_type] ?? (p.schema_type.startsWith("dmf") ? "active-pharmaceutical-ingredient" : "");
  return {
    envelope: {
      identifier: newUuid(), objective: "new", unitType: "initial", tier1: "", tier2, tier3: "", tier4: "", tier5: "",
      applicant: "", cca: "", phones: [""], emails: [""],
      inventedNames: [{ name: "", licenses: [""], appNo: "", codes: [""] }],
      inns: [""], sequence: "0000", relatedSequences: ["0000"], description: p.name,
    },
    product: { substance: "", manufacturer: "", product: "", dosageForm: "", productManufacturer: "", indication: "" },
  };
}

/** Where a file goes by default: what the user chose, else the item's or file name's CTD node. */
function defaultNode(item, att) {
  if (att.ectd_node !== null && att.ectd_node !== undefined) return att.ectd_node;
  // Word/Excel originals usually sit next to their PDF; only the PDF goes in.
  if (NOT_PACKAGED.has(item.category) || !PACKABLE.has(extOf(att.filename))) return "";
  for (const n of [...nodesIn(att.filename), ...itemNodes(item)]) {
    if (NODE.get(n)?.files) return n;
  }
  return "";
}

function defaultTitle(att) {
  return att.ectd_title ?? att.filename.replace(/\.[^.]+$/, "").replace(/^\d+[_\s-]+/, "").replace(/_/g, " ");
}

function buildPanel(detail) {
  const editable = canEdit();
  const saved = detail.ectd ?? defaults(detail);
  const data = structuredClone({ ...defaults(detail), ...saved, envelope: { ...defaults(detail).envelope, ...saved.envelope }, product: { ...defaults(detail).product, ...saved.product } });
  const env = data.envelope;
  const product = data.product;
  let history = detail.ectd_sequences ?? [];
  if (!detail.ectd && history.length) {
    // A case whose earlier sequences were imported: carry on from them.
    const last = history[history.length - 1];
    if (last.uuid) env.identifier = last.uuid;
    env.sequence = String(Number(last.sequence) + 1).padStart(4, "0");
    env.unitType = "response";
    env.relatedSequences = [last.sequence];
  }
  // Replace / delete choices belong to one sequence; a new sequence starts clean.
  if (data.lifecycle?.sequence !== env.sequence) data.lifecycle = { sequence: env.sequence, replace: {}, deletes: [] };
  const lc = data.lifecycle;
  const earlier = () => history.filter((m) => m.sequence < env.sequence);
  // Attachments packaged here before carry their ID: s0000-a12 is attachment 12 in sequence 0000.
  const submittedIn = (attId) => earlier().find((m) => m.leaves.some((l) => new RegExp(`^s\\d{4}-a${attId}$`).test(l.id)))?.sequence ?? null;
  const docs = detail.items.flatMap((item) => (item.attachments ?? []).map((a) => {
    const sent = submittedIn(a.id);
    return { att: a, item, sent, node: sent ? "" : defaultNode(item, a), title: defaultTitle(a), target: lc.replace[a.id] ?? "" };
  }));

  const planBox = h("div", {});
  const problemsBox = h("div", {});
  const resultBox = h("div", {});
  const progress = h("div", { class: "run", hidden: true });
  const buildBtn = h("button", { type: "button", class: "btn btn-primary", disabled: !editable, onclick: (e) => build(e.currentTarget) }, "產生 eCTD ZIP");

  // ── Envelope form ──
  const text = (obj, key, label, opts = {}) => field(label, h("input", {
    class: "input", value: obj[key] ?? "", maxlength: opts.max ?? 200, disabled: !editable, placeholder: opts.placeholder ?? "",
    inputmode: opts.inputmode ?? null,
    oninput: (e) => { obj[key] = e.target.value; if (opts.onInput) opts.onInput(); refresh(); },
  }), opts.help);
  const list = (obj, key, label, opts = {}) => field(label, h("input", {
    class: "input", value: (obj[key] ?? []).join("、"), maxlength: 500, disabled: !editable, placeholder: opts.placeholder ?? "",
    oninput: (e) => { obj[key] = e.target.value.split(/[、,，]/).map((s) => s.trim()); refresh(); },
  }), opts.help ?? "多個請用頓號（、）分隔");
  const select = (obj, key, label, options, opts = {}) => field(label, h("select", {
    class: "input", disabled: !editable,
    onchange: (e) => { obj[key] = e.target.value; if (opts.onChange) opts.onChange(); refresh(); },
  }, opts.optional ? h("option", { value: "" }, "（不填）") : null,
  Object.entries(options).map(([v, label2]) => h("option", { value: v, selected: obj[key] === v }, `${label2}（${v}）`))));
  const name = env.inventedNames[0];

  const envelopeForm = h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, "1. 送件資訊（tw-envelope）"),
    h("p", { class: "help", style: "margin-top:-6px" }, "對應 tw-regional.xml 的 envelope。除藥品許可證字號外都必填（依 eCTD 指引 表格 tw-envelope）。"),
    h("div", { class: "form-grid" },
      text(name, "appNo", "取號號碼", { placeholder: "2020101002", inputmode: "numeric", max: 10, help: "ExPress 系統提供；也是 ZIP 最上層資料夾名稱", onInput: syncCode }),
      text(env, "sequence", "序列", { placeholder: "0000", inputmode: "numeric", max: 4, help: "首次送件 0000，之後每次加 1，不可跳號", onInput: syncRelated }),
      select(env, "objective", "送件目的", OBJECTIVES),
      select(env, "unitType", "送件種類", UNIT_TYPES, { onChange: syncRelated }),
      list(env, "relatedSequences", "相關序列", { help: "首次送件／格式轉換＝本序列；回復時填被回復的序列" }),
      text(env, "description", "序列描述", { max: 500, help: "例：新藥查驗登記、對序列 0000 之補件回復" }),
    ),
    h("details", { class: "disclose", open: !detail.ectd },
      h("summary", {}, "案件類別（Tier 1–5）"),
      h("div", { class: "form-grid" },
        select(env, "tier1", "Tier 1", TIERS.tier1, { optional: true }),
        select(env, "tier2", "Tier 2", TIERS.tier2, { optional: true }),
        select(env, "tier3", "Tier 3", TIERS.tier3, { optional: true }),
        select(env, "tier4", "Tier 4", TIERS.tier4, { optional: true }),
        select(env, "tier5", "Tier 5", TIERS.tier5, { optional: true }))),
    h("div", { class: "form-grid" },
      text(env, "applicant", "申請者（公司名稱）"),
      text(env, "cca", "工商憑證 IC 卡號", { placeholder: "MG00000000000005" }),
      list(env, "phones", "公司電話"),
      list(env, "emails", "公司電子郵件"),
      text(name, "name", "藥品名稱（invented name）"),
      list(name, "licenses", "藥品許可證字號", { help: "變更、展延、註銷時必填" }),
      list(name, "codes", "code（取號號碼＋劑量）", { placeholder: "202010100210mg", help: "高低劑量各一個，例：202010100210mg、202010100220mg" }),
      list(env, "inns", "主成分（INN）"),
      text(env, "identifier", "UUID", { max: 36, help: "同一申請案的所有序列須使用相同 UUID；第二次以後送件請沿用" }),
    ),
    h("h3", { class: "sub-title" }, "Module 2／3 資料夾與屬性"),
    h("div", { class: "form-grid" },
      text(product, "substance", "原料藥名稱（英文）", { help: "3.2.S 資料夾與 substance 屬性" }),
      text(product, "manufacturer", "原料藥製造廠（英文）"),
      text(product, "product", "藥品名稱（英文）", { help: "3.2.P 資料夾與 product-name 屬性" }),
      text(product, "dosageForm", "劑型（英文）"),
      text(product, "productManufacturer", "成品製造廠（英文）"),
    ),
    editable ? h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn", onclick: (e) => save(e.currentTarget) }, "儲存送件資訊")) : null,
  );

  function syncRelated() {
    if (["initial", "reformat"].includes(env.unitType)) env.relatedSequences = [env.sequence];
  }
  function syncCode() {
    // A single-strength product's code is the application number itself plus its strength.
    if (!name.codes.some((c) => c.trim())) name.codes = [name.appNo];
  }

  async function save(btn) {
    try {
      await busy(btn, () => api("PUT", `/api/projects/${detail.project.id}/ectd`, { ectd: data }));
      detail.ectd = structuredClone(data);
      toast("已儲存送件資訊");
    } catch (err) { toast(err.message, "error"); }
  }

  // ── Earlier sequences (lifecycle) ──
  const historyBox = h("div", {});
  const lifecycleSection = h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, "2. 先前序列（補件時替換或刪除）"),
    h("p", { class: "help", style: "margin-top:-6px" },
      "在這裡產生的序列會自動記錄；在別處製作或實際送出的版本不同時，請匯入實際送出的 ZIP，系統以匯入的內容為準。補件序列中，已送出的文件預設不再放入；改正後的文件可選擇「替換」原文件，不再需要的文件可勾選「刪除」。"),
    historyBox);

  async function importSequences(makeEntries) {
    try {
      const found = await readManifests(await makeEntries());
      if (!found.length) { toast("找不到任何序列（需含 index.xml）。", "error"); return; }
      for (const m of found) {
        const res = await api("PUT", `/api/projects/${detail.project.id}/ectd/sequences/${m.sequence}`, { source: "imported", uuid: m.uuid, leaves: m.leaves });
        history = res.ectd_sequences;
      }
      toast(`已匯入序列 ${found.map((m) => m.sequence).join("、")}`);
      redrawLifecycle();
    } catch (err) { toast(err.message, "error"); }
  }

  /** Files already sent in an earlier sequence are left out by default; others get their usual node. */
  function syncSent() {
    for (const d of docs) {
      const sent = submittedIn(d.att.id);
      if (sent !== d.sent) {
        d.node = sent ? "" : defaultNode(d.item, d.att);
        d.target = "";
        if (d.nodeSelect) d.nodeSelect.value = d.node;
      }
      d.sent = sent;
    }
  }

  function redrawLifecycle() {
    detail.ectd_sequences = history;
    syncSent();
    drawHistory();
    refresh();
  }

  function drawHistory() {
    const live = [...currentLeaves(earlier())].map(([key, l]) => ({ key, ...l }));
    const replaced = new Set(Object.values(lc.replace));
    const zip = h("input", { type: "file", accept: ".zip,application/zip", class: "sr-only", onchange: (e) => {
      const f = e.target.files[0]; e.target.value = ""; if (f) importSequences(() => zipEntries(f));
    } });
    const folder = h("input", { type: "file", multiple: true, webkitdirectory: true, class: "sr-only", onchange: (e) => {
      const files = [...e.target.files].map((file) => ({ file, path: file.webkitRelativePath || file.name }));
      e.target.value = ""; if (files.length) importSequences(async () => folderEntries(files));
    } });
    mount(historyBox,
      history.length ? h("ul", { class: "seq-list" }, history.map((m) => h("li", {},
        h("b", {}, m.sequence),
        h("span", {}, `${m.source === "imported" ? "匯入" : "在此產生"}・${m.created_at.slice(0, 10)}・${m.leaves.length} 份文件`),
        editable ? h("button", { type: "button", class: "link-btn danger", onclick: async () => {
          if (!(await confirmDialog(`刪除序列 ${m.sequence} 的紀錄？只刪除這裡的紀錄，不影響已送出的資料。`, { okLabel: "刪除紀錄", danger: true }))) return;
          try {
            history = (await api("DELETE", `/api/projects/${detail.project.id}/ectd/sequences/${m.sequence}`)).ectd_sequences;
            redrawLifecycle();
          } catch (err) { toast(err.message, "error"); }
        } }, "刪除紀錄") : null)))
        : h("p", { class: "muted small" }, "還沒有先前序列的紀錄。首次送件（0000）不需要。"),
      history.some((m) => m.sequence === env.sequence) ? h("p", { class: "small" },
        `序列 ${env.sequence} 已有紀錄，再產生一次會覆蓋這筆紀錄。若要製作補件，請把上方「序列」改為 ${String(Number(history[history.length - 1].sequence) + 1).padStart(4, "0")}。`) : null,
      editable ? h("div", { class: "btn-row" },
        h("label", { class: "btn btn-sm" }, zip, "匯入已送出的序列 ZIP"),
        h("label", { class: "btn btn-sm hover-only" }, folder, "匯入資料夾")) : null,
      live.length ? h("details", { class: "disclose", open: env.sequence !== "0000" },
        h("summary", {}, `序列 ${env.sequence} 之前仍有效的文件（${live.length}）`),
        h("div", { class: "table-wrap" }, h("table", { class: "ectd-table live-table" },
          h("thead", {}, h("tr", {}, ["節點", "標題", "來源序列", "刪除"].map((t) => h("th", {}, t)))),
          h("tbody", {}, live.map((l) => {
            const supported = l.node && NODE.get(l.node)?.files && !l.extension;
            return h("tr", {},
              h("td", { class: "nowrap" }, l.node ?? "—"),
              h("td", { class: "e-file" }, h("div", {}, l.title), h("div", { class: "item-sub" }, l.path ?? "")),
              h("td", { class: "nowrap" }, l.sequence),
              h("td", {}, h("input", {
                type: "checkbox", "aria-label": `刪除 ${l.title}`, checked: lc.deletes.includes(l.key),
                disabled: !editable || !supported || replaced.has(l.key),
                title: !supported ? "Module 4／5 或延伸節點的文件尚不支援" : replaced.has(l.key) ? "已選擇替換這份文件" : null,
                onchange: (e) => {
                  lc.deletes = e.target.checked ? [...lc.deletes, l.key] : lc.deletes.filter((k) => k !== l.key);
                  refresh();
                },
              })));
          }))))) : null,
    );
  }

  // ── Document placement ──
  const nodeOptions = (current) => [
    h("option", { value: "" }, "（不放入 eCTD）"),
    ...[1, 2, 3].map((m) => h("optgroup", { label: `Module ${m}` },
      PLACEABLE.filter((n) => n.module === m).map((n) => h("option", { value: n.node, selected: n.node === current }, `${n.node} ${n.title}`)))),
  ];
  const persist = async (d, patch) => {
    try {
      const res = await api("PATCH", `/api/attachments/${d.att.id}`, patch);
      d.att.ectd_node = res.ectd_node;
      d.att.ectd_title = res.ectd_title;
    } catch (err) { toast(err.message, "error"); }
  };
  const docRows = docs.map((d) => {
    const pathCell = h("td", { class: "e-path" });
    d.pathCell = pathCell;
    d.opCell = h("td", { class: "e-op" });
    d.sentNote = h("div", { class: "item-sub" });
    return h("tr", {},
      h("td", { class: "e-file" }, h("div", { class: "item-name" }, d.att.filename),
        h("div", { class: "item-sub" }, `${d.item.item_name}・${fileSize(d.att.size_bytes)}`), d.sentNote),
      h("td", { class: "e-node" }, d.nodeSelect = h("select", {
        class: "input", disabled: !editable, "aria-label": `${d.att.filename} 的 CTD 節點`,
        onchange: (e) => { d.node = e.target.value; d.target = ""; delete lc.replace[d.att.id]; refresh(); persist(d, { ectd_node: d.node || "" }); },
      }, nodeOptions(d.node)),
      NOT_PACKAGED.has(d.item.category) ? h("div", { class: "item-sub" }, "Module 4／5 尚未支援打包")
        : !PACKABLE.has(extOf(d.att.filename)) ? h("div", { class: "item-sub" }, "eCTD 只收 PDF，請上傳轉好的 PDF 版") : null),
      h("td", { class: "e-title" }, h("input", {
        class: "input", value: d.title, maxlength: 300, disabled: !editable, "aria-label": `${d.att.filename} 的標題`,
        oninput: (e) => { d.title = e.target.value; },
        onchange: (e) => { d.title = e.target.value.trim() || defaultTitle({ ...d.att, ectd_title: null }); e.target.value = d.title; persist(d, { ectd_title: d.title }); refresh(); },
      })),
      d.opCell,
      pathCell,
    );
  });

  const placement = h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, "3. 文件配置", h("span", { class: "aside" }, `${docs.length} 個附件`)),
    h("p", { class: "help", style: "margin-top:-6px" },
      "每個附件放在一個 CTD 節點，標題會成為 eCTD 中的頁面標題（leaf title）。系統先依檢查項目與檔名建議，可逐一修改；檔名會依 TFDA 附件一及 ICH Appendix 4 自動命名。Word／Excel 請先轉成 PDF 再上傳到檢查項目。"),
    docs.length ? h("div", { class: "table-wrap" }, h("table", { class: "ectd-table" },
      h("thead", {}, h("tr", {}, ["檔案", "CTD 節點", "標題（leaf title）", "操作", "eCTD 路徑"].map((t) => h("th", {}, t)))),
      h("tbody", {}, docRows)))
      : h("p", { class: "muted" }, "這個案件還沒有附件。請先在案件總覽上傳文件。"),
    planBox,
  );

  const output = h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, "4. 產生並驗證"),
    problemsBox,
    h("div", { class: "btn-row" }, buildBtn,
      h("span", { class: "help" }, "Chrome 或 Edge 會直接寫入你選的位置，6 GB 以上也可以；其他瀏覽器會先放在記憶體再下載。")),
    progress,
    resultBox,
  );

  function liveMap() {
    return currentLeaves(earlier());
  }

  function current() {
    const live = liveMap();
    const chosen = docs.filter((d) => d.node);
    const targetOf = (d) => {
      const l = d.target && live.get(d.target);
      return l ? { sequence: l.sequence, xml: l.xml, id: l.id } : undefined;
    };
    const plan = planPaths(chosen.map((d) => ({ key: String(d.att.id), node: d.node, title: d.title, filename: d.att.filename, size: d.att.size_bytes, att: d.att, target: targetOf(d) })),
      product, name.appNo || "0000000000", env.sequence || "0000");
    const deletes = lc.deletes.map((k) => live.get(k)).filter(Boolean)
      .map((l) => ({ key: `${l.sequence}-${l.id}`, node: l.node, title: l.title, target: { sequence: l.sequence, xml: l.xml, id: l.id } }));
    return { ...plan, deletes };
  }

  /** Sequence-order and UUID checks against the recorded history (rules M.2, M.4, I.8). */
  function historyProblems() {
    if (!history.length || !/^\d{4}$/.test(env.sequence)) return [];
    const out = [];
    const prev = earlier();
    const last = prev[prev.length - 1];
    const expected = last ? String(Number(last.sequence) + 1).padStart(4, "0") : "0000";
    if (env.sequence > expected) out.push(`序列應為 ${expected}（前一序列 ${last?.sequence ?? "無"}），不可跳號（規則 M.4）。`);
    if (last?.uuid && env.identifier !== last.uuid) out.push(`UUID 須與序列 ${last.sequence} 相同：${last.uuid}（規則 I.8）。`);
    return out;
  }

  function refresh() {
    if (lc.sequence !== env.sequence) {
      // Choices were for another sequence number.
      Object.assign(lc, { sequence: env.sequence, replace: {}, deletes: [] });
      for (const d of docs) d.target = "";
      syncSent();
      drawHistory();
    }
    const { placed, problems, deletes } = current();
    const live = liveMap();
    const byKey = new Map(placed.map((p) => [p.key, p]));
    const taken = new Set(docs.filter((d) => d.node && d.target).map((d) => d.target));
    for (const d of docs) {
      const p = byKey.get(String(d.att.id));
      d.pathCell.replaceChildren(p?.path ?? h("span", { class: "muted" }, d.node ? "—" : "不放入"));
      d.sentNote.textContent = d.sent ? `已於序列 ${d.sent} 送出` : "";
      // Documents in the same section of earlier sequences can be replaced by this one.
      const options = d.node ? [...live].filter(([k, l]) => l.node === d.node && !l.extension && !lc.deletes.includes(k) && (k === d.target || !taken.has(k))) : [];
      if (d.target && !options.some(([k]) => k === d.target)) { d.target = ""; delete lc.replace[d.att.id]; }
      d.opCell.replaceChildren(!d.node ? h("span", { class: "muted small" }, "—") : !options.length
        ? h("span", { class: "small" }, "新增")
        : h("select", {
          class: "input", disabled: !editable, "aria-label": `${d.att.filename} 的操作`,
          onchange: (e) => {
            d.target = e.target.value;
            if (d.target) lc.replace[d.att.id] = d.target; else delete lc.replace[d.att.id];
            refresh();
            drawHistory();
          },
        }, h("option", { value: "" }, "新增"),
        options.map(([k, l]) => h("option", { value: k, selected: k === d.target }, `替換：${l.title}（序列 ${l.sequence}）`))));
    }
    const envProblems = envelopeProblems(env);
    const missingForm = !placed.some((p) => p.node === "1.1.1");
    const all = [...envProblems, ...historyProblems(), ...(missingForm ? ["1.1.1（申請書／公文／回覆函）必須至少放一個檔案（規則 O.11）。"] : []), ...problems.map((p) => p.message)];
    const replacing = placed.filter((p) => p.target).length;
    planBox.replaceChildren(h("p", { class: "small", style: "margin-top:10px" },
      `放入 eCTD：${placed.length} 個檔案，${fileSize(placed.reduce((n, p) => n + p.size, 0))}` +
      (replacing ? `；其中 ${replacing} 個替換先前文件` : "") + (deletes.length ? `；刪除先前文件 ${deletes.length} 個` : "")));
    problemsBox.replaceChildren(all.length
      ? h("div", { class: "notice warn" }, h("b", {}, "產生前需修正："), h("ul", {}, all.map((x) => h("li", {}, x))))
      : h("p", { class: "small" }, "送件資訊與文件配置都已就緒。"));
    buildBtn.disabled = !editable || all.length > 0 || running;
  }

  let running = false;
  async function build(btn) {
    const { placed, deletes } = current();
    const fileName = `${name.appNo}-${env.sequence}.zip`;
    let out;
    try {
      out = await openSink(fileName); // must run first, while the click still counts as a user action
    } catch (err) {
      if (err.name !== "AbortError") toast(err.message, "error");
      return;
    }
    running = true;
    btn.disabled = true;
    // Later sequences must reuse this UUID (rule I.8), so keep what was used.
    api("PUT", `/api/projects/${detail.project.id}/ectd`, { ectd: data })
      .then(() => { detail.ectd = structuredClone(data); })
      .catch((err) => toast(`送件資訊未儲存：${err.message}`, "error"));
    const bar = h("progress", { max: 1, value: 0 });
    const label = h("p", { class: "small" }, "準備中…");
    progress.hidden = false;
    progress.replaceChildren(bar, label);
    resultBox.replaceChildren();
    try {
      const { manifest } = await writePackage({
        env, product, placed, deletes, sink: out.sink,
        fetchDoc: async (d) => {
          const res = await fetch(`/api/attachments/${d.att.id}`, { credentials: "same-origin" });
          if (!res.ok) throw new Error(`無法下載「${d.att.filename}」（${res.status}）。`);
          return res.blob();
        },
        fetchUtil: async (n) => (await fetch(new URL(n, UTIL_URL))).blob(),
        onProgress: (done, total, what) => { bar.value = total ? done / total : 1; label.textContent = `打包中 ${fileSize(done)}／${fileSize(total)}：${what}`; },
      });
      const file = await out.close();
      if (out.memory) download(fileName, file);
      // Remember what this sequence holds so the next one can replace or delete it.
      try {
        history = (await api("PUT", `/api/projects/${detail.project.id}/ectd/sequences/${env.sequence}`, { source: "built", ...manifest })).ectd_sequences;
        redrawLifecycle();
      } catch (err) { toast(`序列紀錄未儲存：${err.message}`, "error"); }
      label.textContent = "已產生，正在驗證…";
      bar.value = 0;
      const report = await runValidation(await zipEntries(file), (d, t) => { bar.value = t ? d / t : 1; }, earlier());
      progress.hidden = true;
      resultBox.replaceChildren(h("p", { class: "small" }, `已產生 ${fileName}（${fileSize(file.size)}）${out.memory ? "，已下載" : "，已存到你選的位置"}。以下是自動驗證結果：`), reportView(report));
      toast(`已產生 ${fileName}`);
    } catch (err) {
      await out.abort?.();
      progress.hidden = true;
      toast(err.name === "AbortError" ? "已取消" : err.message, "error");
    } finally {
      running = false;
      refresh();
    }
  }

  const page = [envelopeForm, lifecycleSection, placement, output];
  queueMicrotask(() => { drawHistory(); refresh(); });
  return page;
}

/** Where the ZIP is written: straight to disk when the browser allows it, else into memory. */
async function openSink(suggestedName) {
  if (typeof window.showSaveFilePicker === "function") {
    const handle = await window.showSaveFilePicker({ suggestedName, types: [{ description: "ZIP", accept: { "application/zip": [".zip"] } }] });
    const w = await handle.createWritable();
    return {
      sink: { write: (chunk) => w.write(chunk) },
      close: async () => { await w.close(); return handle.getFile(); },
      abort: () => w.abort().catch(() => {}),
    };
  }
  const parts = [];
  return {
    memory: true,
    sink: { write: async (chunk) => { parts.push(chunk); } },
    close: async () => new Blob(parts, { type: "application/zip" }),
  };
}

// ── Validate ────────────────────────────────────────────────────────────────

async function runValidation(entries, onProgress, history = []) {
  await loadBundledUtil(async (n) => (await fetch(new URL(n, UTIL_URL))).text());
  return validateEntries(entries, { onProgress: (d, t) => onProgress(d, t), history });
}

function validatePanel() {
  const result = h("div", {}, lastReport ? reportView(lastReport) : null);
  const bar = h("progress", { max: 1, value: 0 });
  const label = h("p", { class: "small" });
  const progress = h("div", { class: "run", hidden: true }, bar, label);

  const run = async (makeEntries, what) => {
    progress.hidden = false;
    label.textContent = `讀取 ${what}…`;
    result.replaceChildren();
    try {
      const entries = await makeEntries();
      lastReport = await runValidation(entries, (d, t) => { bar.value = t ? d / t : 1; label.textContent = `驗證中 ${fileSize(d)}／${fileSize(t)}`; });
      result.replaceChildren(reportView(lastReport));
    } catch (err) {
      toast(err.message, "error");
    } finally {
      progress.hidden = true;
    }
  };
  const zipInput = h("input", { type: "file", accept: ".zip,application/zip", class: "sr-only", onchange: (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (f) run(() => zipEntries(f), f.name);
  } });
  const folderInput = h("input", { type: "file", multiple: true, webkitdirectory: true, class: "sr-only", onchange: (e) => {
    const files = [...e.target.files].map((file) => ({ file, path: file.webkitRelativePath || file.name }));
    e.target.value = "";
    if (files.length) run(async () => folderEntries(files), "資料夾");
  } });
  const drop = h("div", {
    class: "dropzone",
    ondragover: (e) => { e.preventDefault(); drop.classList.add("drag"); },
    ondragleave: () => drop.classList.remove("drag"),
    ondrop: async (e) => {
      e.preventDefault();
      drop.classList.remove("drag");
      const items = [...e.dataTransfer.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
      const file = e.dataTransfer.files[0];
      if (items.length === 1 && items[0].isFile && /\.zip$/i.test(file?.name ?? "")) run(() => zipEntries(file), file.name);
      else run(async () => folderEntries(await walkDrop(items)), "資料夾");
    },
  },
  h("strong", {}, h("span", { class: "hover-only" }, "拖曳 eCTD 的 ZIP 或資料夾到這裡"), h("span", { class: "touch-only" }, "選擇 eCTD 的 ZIP 檔")),
  h("div", { class: "btn-row", style: "justify-content:center;margin-top:10px" },
    h("label", { class: "btn btn-sm" }, zipInput, "選擇 ZIP"),
    h("label", { class: "btn btn-sm hover-only" }, folderInput, "選擇資料夾")),
  h("div", { class: "small", style: "margin-top:8px" }, "可放取號號碼資料夾（含一或多個序列）或單一序列資料夾。檔案只在你的瀏覽器內讀取。"));

  return [h("section", { class: "sheet" }, drop, progress), result];
}

async function walkDrop(entries) {
  const out = [];
  const walk = async (entry, prefix) => {
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ file, path: prefix + file.name });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      for (;;) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const e of batch) await walk(e, `${prefix}${entry.name}/`);
      }
    }
  };
  for (const e of entries) await walk(e, "");
  return out;
}

// ── Report ──────────────────────────────────────────────────────────────────

function reportView(report) {
  const { refuse, remind, ok } = summarize(report);
  const byRule = (list) => {
    const groups = new Map();
    for (const x of list) groups.set(x.rule, [...(groups.get(x.rule) ?? []), x]);
    return [...groups].sort(([a], [b]) => ruleOrder(a) - ruleOrder(b));
  };
  const group = ([rule, list]) => h("details", { class: "gap", open: list.length <= 3 },
    h("summary", {}, h("span", { class: `rule-id ${RULE.get(rule)?.severity === "BP" ? "bp" : "pf"}` }, rule),
      h("span", {}, RULE.get(rule)?.text ?? ""), h("span", { class: "muted small" }, `${list.length} 項`)),
    h("ul", { class: "gap-body" }, list.slice(0, 200).map((x) => h("li", {}, x.message))),
    list.length > 200 ? h("p", { class: "small muted" }, `另有 ${list.length - 200} 項未列出。`) : null);
  const notChecked = [...new Set(report.sequences.flatMap((s) => s.notChecked ?? []))];
  return h("section", { class: "sheet ectd-report" },
    h("div", { class: `rtf-verdict ${ok ? "pass" : "refuse"}` },
      h("span", {}, ok ? "依 TFDA 驗證規則" : `${refuse.length} 項會被退件（P/F）`),
      h("b", {}, ok ? "可送件" : "不予收件")),
    report.sequences.map((s) => h("dl", { class: "seq-facts" },
      h("div", {}, h("dt", {}, "序列"), h("dd", {}, `${s.appFolder ?? "（無取號資料夾）"}／${s.seq}`)),
      s.envelope ? h("div", {}, h("dt", {}, "藥品"), h("dd", {}, s.envelope.inventedNames.map((n) => n.name).join("、") || "—")) : null,
      s.envelope ? h("div", {}, h("dt", {}, "送件種類"), h("dd", {}, `${UNIT_TYPES[s.envelope.unitType] ?? s.envelope.unitType}・${OBJECTIVES[s.envelope.objective] ?? s.envelope.objective}`)) : null,
      h("div", {}, h("dt", {}, "檔案"), h("dd", {}, `${s.stats.files} 個，${fileSize(s.stats.bytes)}，leaf ${s.stats.leaves} 個`)))),
    refuse.length ? [h("h3", { class: "sub-title" }, "會被退件（P/F）"), byRule(refuse).map(group)] : null,
    remind.length ? [h("h3", { class: "sub-title" }, "提醒（BP）"), byRule(remind).map(group)] : null,
    notChecked.length ? h("details", { class: "disclose" },
      h("summary", {}, `未自動檢查的規則（${notChecked.length}）`),
      h("ul", { class: "small" }, notChecked.map((r) => h("li", {}, `${r} ${RULE.get(r)?.text ?? ""}`))),
      h("p", { class: "help" }, "生命週期規則需要先前序列：把整個取號號碼資料夾（含先前序列）一起放進來即可檢查。PDF 連結、書籤、字型需用 PDF 軟體確認。")) : null,
    h("div", { class: "btn-row", style: "margin-top:14px" },
      h("button", { type: "button", class: "link-btn", style: "font-size:inherit", onclick: () => download(`ectd-validation-${state.today ?? "report"}.md`, reportMarkdown(report), "text/markdown") }, "下載驗證報告（Markdown）")),
    h("p", { class: "help" }, "依「藥品查驗登記電子通用技術文件驗證指引」eCTD-V-R2.1（114.06.30）自動檢查，正式結果以 TFDA ExPress 驗證為準。"),
  );
}

function ruleOrder(id) {
  const i = RULES.findIndex((r) => r.id === id);
  return i < 0 ? 999 : i;
}

function reportMarkdown(report) {
  const { refuse, remind, ok } = summarize(report);
  const lines = ["# eCTD 驗證報告", "", `- 結果：${ok ? "可送件（無 P/F）" : `不予收件（P/F ${refuse.length} 項）`}`, `- 提醒（BP）：${remind.length} 項`];
  for (const s of report.sequences) lines.push(`- 序列：${s.appFolder ?? "—"}/${s.seq}，${s.stats.files} 個檔案`);
  const section = (title, list) => {
    if (!list.length) return;
    lines.push("", `## ${title}`, "");
    for (const x of list) lines.push(`- **${x.rule}** ${RULE.get(x.rule)?.text ?? ""}：${x.message}`);
  };
  section("會被退件（P/F）", refuse);
  section("提醒（BP）", remind);
  lines.push("", "依「藥品查驗登記電子通用技術文件驗證指引」eCTD-V-R2.1 自動檢查，正式結果以 TFDA ExPress 驗證為準。");
  return lines.join("\n");
}
