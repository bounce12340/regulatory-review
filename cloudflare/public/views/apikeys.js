// API keys: the company's own programs (scripts, ERP, automation) call the REST API as one
// member. Shows how to call it, the user's keys and a form for new ones, and — for admins —
// the company switch, every key in the company and recent requests made with keys.
import { h, mount, toast, busy, field, confirmDialog, copyField } from "../lib/dom.js";
import { api, isAdmin, canEdit, twTime as when } from "../lib/api.js";

const SCOPE_LABEL = { read: "唯讀", "read write": "讀取＋修改" };

const ENDPOINTS = [
  ["GET", "/api/auth/me", "確認金鑰代表的帳號與權限"],
  ["GET", "/api/schemas", "申請類型清單（建立案件時的 schema_type）"],
  ["GET", "/api/projects", "列出案件與各檢查項目狀態（?include_archived=1 含已封存）"],
  ["GET", "/api/projects/{id}", "案件詳情：檢查項目、審查門檻、附件、審查結果"],
  ["POST", "/api/projects", "建立案件：name、schema_type，可加 deadline、description"],
  ["PATCH", "/api/items/{id}", "更新檢查項目：status、notes、risk_level"],
  ["POST", "/api/items/{id}/attachments", "上傳檔案（multipart 表單欄位 file，50 MB 以內）"],
  ["GET", "/api/attachments/{id}", "下載檔案"],
  ["PUT", "/api/attachments/{id}/text", "存入文件文字，供 AI 審查與搜尋：status、text"],
  ["POST", "/api/items/{id}/review", "以系統 AI 審查檢查項目"],
];

export async function renderApiKeys(main, _params, ctx) {
  const data = await api("GET", "/api/api-keys");
  if (!ctx.isCurrent()) return;

  const revoke = async (k) => {
    const ok = await confirmDialog(`撤銷「${k.name}」？使用這把金鑰的程式會立即無法再呼叫 API。`, { okLabel: "撤銷", danger: true });
    if (!ok) return;
    try {
      await api("DELETE", `/api/api-keys/${k.id}`);
      toast(`已撤銷「${k.name}」`);
      ctx.rerender();
    } catch (err) { toast(err.message, "error"); }
  };

  mount(main,
    h("header", { class: "page-head" },
      h("h1", {}, "API 金鑰"),
      h("p", {}, "讓公司自己的程式（排程腳本、ERP、內部系統）呼叫 RegReview 的 API，自動建立案件、上傳文件、更新檢查項目或匯出審查結果。每把金鑰代表建立它的帳號，權限不會超過該帳號在網頁上的權限。")),
    isAdmin() ? settingsSheet(data, ctx) : !data.enabled
      ? h("div", { class: "notice warn" }, "公司管理員尚未開啟 API 金鑰。需要使用時，請管理員在這一頁開啟。") : null,
    data.enabled ? usageSheet(data.base_url) : null,
    keysSheet("我的金鑰", data.keys, { onRevoke: revoke }),
    data.enabled ? createSheet(ctx) : null,
    data.admin ? keysSheet("公司所有金鑰", data.admin.keys, { onRevoke: revoke, showUser: true }) : null,
    data.admin ? auditSheet(data.admin.audit) : null,
  );
}

function settingsSheet(data, ctx) {
  const toggle = async (e) => {
    const enabled = e.target.checked;
    if (enabled && !(await confirmDialog(
      "開啟後，公司成員可以建立 API 金鑰，讓程式以他們的身分讀取或修改案件與文件。確定開啟？", { okLabel: "開啟" }))) {
      e.target.checked = false;
      return;
    }
    try {
      await api("PATCH", "/api/api-keys/settings", { enabled });
      toast(enabled ? "已開啟 API 金鑰" : "已關閉 API 金鑰，現有金鑰暫停使用");
      ctx.rerender();
    } catch (err) { toast(err.message, "error"); e.target.checked = !enabled; }
  };
  return h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, "公司設定"),
    h("label", { class: "check" }, h("input", { type: "checkbox", checked: data.enabled, onchange: toggle }), "允許成員建立 API 金鑰"),
    h("p", { class: "help", style: "margin-top:8px;max-width:72ch" },
      "金鑰不能用來登入網頁、管理成員、變更 AI 模型設定，或建立其他金鑰與連線。停用或刪除成員時，他的金鑰會一併刪除。關閉後所有金鑰立即暫停；重新開啟即恢復。下方可查看每把金鑰與最近的使用紀錄。"),
  );
}

function usageSheet(baseUrl) {
  const code = (text) => h("pre", { class: "code-block" }, text);
  const guide = (title, ...body) => h("details", { class: "disclose" }, h("summary", {}, title), h("div", { class: "guide-body" }, ...body));
  const origin = baseUrl.replace(/\/api$/, "");
  return h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, "使用方式"),
    copyField(baseUrl, "API 網址"),
    h("p", { class: "help", style: "margin:8px 0 14px;max-width:72ch" },
      "每個請求都在 Authorization 標頭帶上金鑰：Authorization: Bearer <API 金鑰>。請把金鑰放在環境變數或密鑰管理工具，不要寫進程式碼或版本庫。回應一律是 JSON；錯誤時 error 欄位會說明原因。"),
    guide("範例：列出案件、更新檢查項目（curl）",
      code(`export REGREVIEW_API_KEY="rrk_…"   # 從環境變數或密鑰管理工具讀取

# 列出案件
curl -s ${origin}/api/projects \\
  -H "Authorization: Bearer $REGREVIEW_API_KEY"

# 把檢查項目 42 標為進行中，並加上備註
curl -s -X PATCH ${origin}/api/items/42 \\
  -H "Authorization: Bearer $REGREVIEW_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "in_progress", "notes": "已收到廠商文件"}'`)),
    guide("範例：上傳文件（curl）",
      code(`curl -s -X POST ${origin}/api/items/42/attachments \\
  -H "Authorization: Bearer $REGREVIEW_API_KEY" \\
  -F "file=@./規格書.pdf"`),
      h("p", {}, "超過 50 MB 的檔案請用網頁上傳。API 上傳的檔案不會自動擷取文字；要讓 AI 審查或搜尋讀到內容，請另以 PUT /api/attachments/{id}/text 存入文字（status 為 ok）。")),
    guide("範例：Python",
      code(`import os, requests

API = "${baseUrl}"
headers = {"Authorization": f"Bearer {os.environ['REGREVIEW_API_KEY']}"}

projects = requests.get(f"{API}/projects", headers=headers, timeout=30).json()["projects"]
for p in projects:
    print(p["id"], p["name"], p["deadline"])`)),
    guide("常用端點",
      h("div", { class: "table-wrap" }, h("table", { class: "endpoints" },
        h("thead", {}, h("tr", {}, ["方法", "路徑", "用途"].map((t) => h("th", {}, t)))),
        h("tbody", {}, ENDPOINTS.map(([m, path, what]) => h("tr", {},
          h("td", { class: "mono small" }, m), h("td", { class: "mono small" }, path), h("td", { class: "small" }, what)))))),
      h("p", {}, "唯讀金鑰只能用 GET。讀取＋修改金鑰可以做到建立者在網頁上能做的事，但仍不能管理成員、密碼、AI 模型設定或金鑰與連線設定。")),
  );
}

function keysSheet(title, keys, { onRevoke, showUser = false }) {
  return h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, title, h("span", { class: "aside" }, `${keys.length} 把`)),
    keys.length ? h("div", { class: "table-wrap" }, h("table", { class: "grants" },
      h("thead", {}, h("tr", {}, [showUser ? "成員" : null, "名稱", "金鑰", "權限", "到期", "最後使用", ""].filter(Boolean).map((t) => h("th", {}, t)))),
      h("tbody", {}, keys.map((k) => h("tr", {},
        showUser ? h("td", { class: "g-user" }, k.user_name ?? "—") : null,
        h("td", { class: "item-name g-name" }, k.name),
        h("td", { class: "g-kind small mono" }, `rrk_…${k.key_hint}`),
        h("td", { class: "g-scope small" }, SCOPE_LABEL[k.scope] ?? k.scope),
        h("td", { class: "g-expires small muted" }, k.expires_at.slice(0, 10)),
        h("td", { class: "g-used small muted" }, when(k.last_used_at)),
        h("td", { class: "g-del" }, h("button", { class: "btn btn-sm btn-danger", "aria-label": `撤銷 ${k.name}`, onclick: () => onRevoke(k) }, "撤銷")),
      ))))) : h("p", { class: "muted small" }, showUser ? "公司目前沒有任何 API 金鑰。" : "你還沒有建立 API 金鑰。"),
  );
}

function createSheet(ctx) {
  const reveal = h("div", {});
  const form = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        const res = await busy(e.submitter, () => api("POST", "/api/api-keys", {
          name: f.elements.name.value, scope: f.elements.scope.value, days: Number(f.elements.days.value),
        }));
        f.reset();
        mount(reveal, h("div", { class: "notice token-reveal" },
          h("b", {}, "請現在複製這把金鑰，離開此頁後就無法再看到。"),
          copyField(res.key, "API 金鑰"),
          h("span", { class: "small" }, `到期日：${res.expires_at.slice(0, 10)}`),
          h("button", { type: "button", class: "btn btn-sm", style: "margin-top:10px;justify-self:start", onclick: () => ctx.rerender() }, "我已複製，完成")));
      } catch (err) { toast(err.message, "error"); }
    },
  },
    h("div", { class: "form-grid" },
      field("名稱", h("input", { class: "input", name: "name", required: true, maxlength: 100, placeholder: "例：ERP 每日同步" })),
      field("權限", h("select", { class: "input", name: "scope" },
        h("option", { value: "read" }, SCOPE_LABEL.read),
        canEdit() ? h("option", { value: "read write" }, SCOPE_LABEL["read write"]) : null)),
      field("有效期限", h("select", { class: "input", name: "days" },
        [[30, "30 天"], [90, "90 天"], [365, "1 年"]].map(([v, t]) => h("option", { value: v, selected: v === 90 }, t)))),
    ),
    h("button", { class: "btn btn-primary", type: "submit" }, "建立金鑰"),
  );
  return h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, "建立 API 金鑰"),
    h("p", { class: "sheet-note" }, "金鑰等同你的帳號權限，請只給需要的權限與期限。給公司系統長期使用時，建議由管理員另建一個專用帳號來建立金鑰，避免人員異動時中斷。"),
    reveal, form,
  );
}

function auditSheet(rows) {
  return h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, "最近使用紀錄", h("span", { class: "aside" }, "最近 100 筆")),
    rows.length ? h("div", { class: "table-wrap" }, h("table", { class: "audit" },
      h("thead", {}, h("tr", {}, ["時間", "成員", "金鑰", "請求", "結果"].map((t) => h("th", {}, t)))),
      h("tbody", {}, rows.map((r) => h("tr", { class: r.status < 400 ? null : "failed" },
        h("td", { class: "small muted nowrap" }, when(r.created_at)),
        h("td", { class: "small" }, r.user_name ?? "—"),
        h("td", { class: "small" }, r.key_name),
        h("td", { class: "small mono" }, `${r.method} ${r.path}`),
        h("td", { class: "small nowrap" }, r.status < 400 ? `成功（${r.status}）` : `失敗（${r.status}）`),
      ))))) : h("p", { class: "muted small" }, "還沒有任何 API 請求。"),
  );
}
