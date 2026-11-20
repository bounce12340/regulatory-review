// AI agent connections (MCP): the server URL and how to add it to each AI tool, the user's
// connections and personal access tokens, and — for admins — the company switch, every
// connection in the company and recent agent activity.
import { h, mount, toast, busy, field, confirmDialog, copyField } from "../lib/dom.js";
import { api, isAdmin, canEdit, twTime as when } from "../lib/api.js";

const SCOPE_LABEL = { read: "唯讀", "read write": "讀取＋寫回審查結果" };
const TOOL_LABEL = {
  list_cases: "列出案件", get_case: "讀取案件", read_document: "讀取文件文字", search_documents: "搜尋文件",
  get_document_file: "取得原始檔", save_item_review: "寫回審查結果",
};

export async function renderConnect(main, _params, ctx) {
  const data = await api("GET", "/api/mcp");
  if (!ctx.isCurrent()) return;

  const revoke = async (g) => {
    const ok = await confirmDialog(`撤銷「${g.name}」？使用這個連線的 AI 工具會立即無法再讀取資料。`, { okLabel: "撤銷", danger: true });
    if (!ok) return;
    try {
      await api("DELETE", `/api/mcp/grants/${g.id}`);
      toast(`已撤銷「${g.name}」`);
      ctx.rerender();
    } catch (err) { toast(err.message, "error"); }
  };

  mount(main,
    h("header", { class: "page-head" },
      h("h1", {}, "AI 代理連線"),
      h("p", {}, "讓 Claude、ChatGPT、Cursor 等 AI 工具透過 MCP 連到 RegReview，用它們自己的模型讀取案件、檢查清單與上傳文件，對照審查門檻分析。每個人以自己的帳號授權，看得到的資料與網頁版相同。")),
    isAdmin() ? settingsSheet(data, ctx) : !data.enabled
      ? h("div", { class: "notice warn" }, "公司管理員尚未開啟 AI 代理連線。需要使用時，請管理員在這一頁開啟。") : null,
    data.enabled ? setupSheet(data.server_url) : null,
    connectionsSheet("我的連線", data.grants, { onRevoke: revoke }),
    data.enabled ? tokenSheet(ctx) : null,
    data.admin ? connectionsSheet("公司所有連線", data.admin.grants, { onRevoke: revoke, showUser: true }) : null,
    data.admin ? auditSheet(data.admin.audit) : null,
  );
}

function settingsSheet(data, ctx) {
  const toggle = async (e) => {
    const enabled = e.target.checked;
    if (enabled && !(await confirmDialog(
      "開啟後，公司成員可以授權外部 AI 服務讀取案件與文件內容，這些內容會傳到該 AI 服務的模型處理。確定開啟？", { okLabel: "開啟" }))) {
      e.target.checked = false;
      return;
    }
    try {
      await api("PATCH", "/api/mcp/settings", { enabled });
      toast(enabled ? "已開啟 AI 代理連線" : "已關閉 AI 代理連線，現有連線暫停使用");
      ctx.rerender();
    } catch (err) { toast(err.message, "error"); e.target.checked = !enabled; }
  };
  return h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, "公司設定"),
    h("label", { class: "check" }, h("input", { type: "checkbox", checked: data.enabled, onchange: toggle }), "允許成員連接 AI 代理（MCP）"),
    h("p", { class: "help", style: "margin-top:8px;max-width:72ch" },
      "文件內容會傳給成員所連接的 AI 服務（例如 Anthropic、OpenAI）處理，請先確認符合公司保密規範與客戶合約。關閉後所有連線立即暫停；重新開啟即恢復。下方可查看每個連線與最近的讀取紀錄。"),
  );
}

function setupSheet(url) {
  const code = (text) => h("pre", { class: "code-block" }, text);
  const guide = (title, ...body) => h("details", { class: "disclose" }, h("summary", {}, title), h("div", { class: "guide-body" }, ...body));
  return h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, "連線網址"),
    copyField(url, "MCP 連線網址"),
    h("p", { class: "help", style: "margin:8px 0 14px" }, "在 AI 工具新增「自訂連接器／MCP 伺服器」時貼上這個網址。支援 OAuth 的工具會開啟 RegReview 登入與授權頁，按「允許」即可。"),
    guide("Claude（網頁版、桌面版、手機）",
      h("p", {}, "在 Claude 的連接器設定新增自訂連接器（custom connector），貼上上面的網址，不必填 OAuth Client ID。連線時會開啟 RegReview 授權頁。")),
    guide("ChatGPT",
      h("p", {}, "在 ChatGPT 的應用程式／連接器設定開啟開發人員模式，建立新的 MCP 連接器：網址貼上上面的網址，驗證方式選 OAuth。")),
    guide("Claude Code",
      code(`claude mcp add --transport http regreview ${url}`),
      h("p", {}, "加入後在 Claude Code 輸入 /mcp，選 regreview 完成登入。")),
    guide("Cursor、VS Code、Codex、Gemini CLI 等",
      h("p", {}, "在 MCP 設定加入下面的伺服器。工具支援 OAuth 時會自動開啟授權頁；不支援時，改用下方的個人存取權杖，放在 Authorization 標頭。"),
      code(JSON.stringify({ mcpServers: { regreview: { url } } }, null, 2)),
      code(JSON.stringify({ mcpServers: { regreview: { url, headers: { Authorization: "Bearer <個人存取權杖>" } } } }, null, 2))),
    h("p", { class: "help", style: "margin-top:12px" },
      "提供的工具：列出案件、讀取案件與檢查清單（含審查門檻）、讀取與搜尋文件文字、取得 PDF／圖片原始檔（掃描檔可交給模型辨識），以及在授權時允許後寫回審查結果。不會刪除或修改文件。"),
  );
}

function connectionsSheet(title, grants, { onRevoke, showUser = false }) {
  return h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, title, h("span", { class: "aside" }, `${grants.length} 個`)),
    grants.length ? h("div", { class: "table-wrap" }, h("table", { class: "grants" },
      h("thead", {}, h("tr", {}, [showUser ? "成員" : null, "名稱", "方式", "權限", "建立", "最後使用", ""].filter(Boolean).map((t) => h("th", {}, t)))),
      h("tbody", {}, grants.map((g) => h("tr", {},
        showUser ? h("td", { class: "g-user" }, g.user_name ?? "—") : null,
        h("td", { class: "item-name g-name" }, g.name),
        h("td", { class: "g-kind small" }, g.kind === "oauth" ? "OAuth 授權" : `個人權杖 …${g.token_hint ?? ""}${g.expires_at ? `（${g.expires_at.slice(0, 10)} 到期）` : ""}`),
        h("td", { class: "g-scope small" }, SCOPE_LABEL[g.scope] ?? g.scope),
        h("td", { class: "g-created small muted" }, when(g.created_at)),
        h("td", { class: "g-used small muted" }, when(g.last_used_at)),
        h("td", { class: "g-del" }, h("button", { class: "btn btn-sm btn-danger", "aria-label": `撤銷 ${g.name}`, onclick: () => onRevoke(g) }, "撤銷")),
      ))))) : h("p", { class: "muted small" }, showUser ? "公司目前沒有任何 AI 代理連線。" : "你還沒有連接任何 AI 工具。"),
  );
}

function tokenSheet(ctx) {
  const reveal = h("div", {});
  const form = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        const res = await busy(e.submitter, () => api("POST", "/api/mcp/tokens", {
          name: f.elements.name.value, scope: f.elements.scope.value, days: Number(f.elements.days.value),
        }));
        f.reset();
        mount(reveal, h("div", { class: "notice token-reveal" },
          h("b", {}, "請現在複製這個權杖，離開此頁後就無法再看到。"),
          copyField(res.token, "個人存取權杖"),
          h("button", { type: "button", class: "btn btn-sm", style: "margin-top:10px", onclick: () => ctx.rerender() }, "我已複製，完成")));
      } catch (err) { toast(err.message, "error"); }
    },
  },
    h("div", { class: "form-grid" },
      field("名稱", h("input", { class: "input", name: "name", required: true, maxlength: 100, placeholder: "例：Cursor 工作電腦" })),
      field("權限", h("select", { class: "input", name: "scope" },
        h("option", { value: "read" }, SCOPE_LABEL.read),
        canEdit() ? h("option", { value: "read write" }, SCOPE_LABEL["read write"]) : null)),
      field("有效期限", h("select", { class: "input", name: "days" },
        [[30, "30 天"], [90, "90 天"], [365, "1 年"]].map(([v, t]) => h("option", { value: v, selected: v === 90 }, t)))),
    ),
    h("button", { class: "btn btn-primary", type: "submit" }, "建立權杖"),
  );
  return h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, "個人存取權杖"),
    h("p", { class: "sheet-note" }, "給不支援 OAuth 登入、但可以設定固定標頭的工具使用（Authorization: Bearer <權杖>）。權杖等同你的帳號權限，請勿分享或寫進程式碼庫。"),
    reveal, form,
  );
}

function auditSheet(rows) {
  return h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, "最近活動", h("span", { class: "aside" }, "最近 100 筆")),
    rows.length ? h("div", { class: "table-wrap" }, h("table", { class: "audit" },
      h("thead", {}, h("tr", {}, ["時間", "成員", "AI 代理", "動作", "對象"].map((t) => h("th", {}, t)))),
      h("tbody", {}, rows.map((r) => h("tr", { class: r.ok ? null : "failed" },
        h("td", { class: "small muted nowrap" }, when(r.created_at)),
        h("td", { class: "small" }, r.user_name ?? "—"),
        h("td", { class: "small" }, r.agent),
        h("td", { class: "small" }, `${TOOL_LABEL[r.tool] ?? r.tool}${r.ok ? "" : "（失敗）"}`),
        h("td", { class: "small muted" }, r.target ?? "—"),
      ))))) : h("p", { class: "muted small" }, "還沒有任何 AI 代理活動。"),
  );
}
