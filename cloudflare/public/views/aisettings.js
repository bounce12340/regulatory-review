// AI model settings: which AI service the company's document analysis and item reviews run
// on. Admins can set the company's own service with its own API key ("bring your own
// key"); everyone sees which service and model are in use.
import { h, mount, toast, busy, field, confirmDialog } from "../lib/dom.js";
import { api, isAdmin, state, twTime as when } from "../lib/api.js";

export async function renderAiSettings(main, _params, ctx) {
  const data = await api("GET", "/api/ai/settings");
  if (!ctx.isCurrent()) return;
  // Other pages read the service in use from state.config.
  state.config = { ...state.config, ...data.active };

  mount(main,
    h("header", { class: "page-head" },
      h("h1", {}, "AI 模型設定"),
      h("p", {}, "設定「AI 文件分析」與「AI 全案審查」使用哪個 AI 服務與模型。公司可以使用自己的 API 金鑰，費用與資料處理依公司與該服務的合約；未設定時使用系統預設的服務。")),
    currentSheet(data),
    isAdmin() ? (data.byok_available ? formSheet(data, ctx)
      : h("div", { class: "notice warn" }, "系統尚未設定加密用的 AI_KEY_SECRET，目前無法儲存公司自己的 API 金鑰。請聯絡系統管理者。"))
      : h("p", { class: "muted small" }, "只有公司管理員可以變更 AI 服務。"),
  );
}

function currentSheet(data) {
  const a = data.active;
  const c = data.company;
  return h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, "目前使用"),
    a.ai_enabled ? h("dl", { class: "kv" },
      h("dt", {}, "AI 服務"), h("dd", {}, a.ai_provider),
      h("dt", {}, "模型"), h("dd", { class: "mono" }, a.ai_model),
      h("dt", {}, "金鑰"), h("dd", {}, a.ai_source === "company" ? `公司自己的金鑰（…${c.key_hint}）` : "系統預設"),
      c?.base_url ? [h("dt", {}, "API 網址"), h("dd", { class: "mono" }, c.base_url)] : null,
      c ? [h("dt", {}, "最後變更"), h("dd", {}, `${when(c.updated_at)}${c.updated_by_name ? `，${c.updated_by_name}` : ""}`)] : null,
    ) : h("p", {}, "目前沒有可用的 AI 服務，AI 分析功能暫停。"),
  );
}

function formSheet(data, ctx) {
  const providers = data.providers;
  const saved = data.company;
  const byId = Object.fromEntries(providers.map((p) => [p.id, p]));

  const providerSel = h("select", { class: "input", name: "provider", required: true },
    h("option", { value: "" }, "請選擇"),
    providers.map((p) => h("option", { value: p.id, selected: saved?.provider === p.id }, p.label)));
  const modelInput = h("input", { class: "input mono", name: "model", required: true, maxlength: 200, list: "ai-model-list", autocomplete: "off", spellcheck: "false" });
  const modelList = h("datalist", { id: "ai-model-list" });
  const baseInput = h("input", { class: "input mono", name: "base_url", type: "url", maxlength: 300, autocomplete: "off", spellcheck: "false" });
  const keyInput = h("input", { class: "input mono", name: "api_key", type: "password", maxlength: 500, autocomplete: "off", spellcheck: "false" });
  const keyHelp = h("p", { class: "help" });
  const baseHelp = h("p", { class: "help" });

  // Fills the form for the chosen service: its models, address and key hint.
  const sync = (initial = false) => {
    const p = byId[providerSel.value];
    const same = saved && p && saved.provider === p.id;
    mount(modelList, (p?.suggested_models ?? []).map((m) => h("option", { value: m })));
    if (initial && same) modelInput.value = saved.model;
    else if (!initial) modelInput.value = p?.default_model ?? "";
    modelInput.placeholder = p?.suggested_models?.length ? p.suggested_models.join("、") : "請輸入服務提供的模型名稱";
    baseInput.required = Boolean(p && p.base_url === null);
    baseInput.placeholder = p?.base_url ?? "https://…/v1";
    if (initial && same) baseInput.value = saved.base_url ?? "";
    else if (!initial) baseInput.value = "";
    baseHelp.textContent = p?.base_url === null
      ? "必填，需為 https:// 開頭的公開網址。"
      : "通常留空，使用官方網址；公司有自己的 API 閘道時才填寫（https:// 開頭）。";
    keyInput.required = !same;
    keyInput.placeholder = same ? `已儲存（…${saved.key_hint}），留空沿用` : "貼上 API 金鑰";
    keyHelp.textContent = p?.key_help ?? "";
  };
  providerSel.addEventListener("change", () => sync());
  sync(true);

  const form = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      const body = { provider: providerSel.value, model: modelInput.value.trim(), base_url: baseInput.value.trim() || undefined, api_key: keyInput.value.trim() || undefined };
      try {
        const res = await busy(e.submitter, () => api("PUT", "/api/ai/settings", body), "測試連線中…");
        keyInput.value = "";
        state.config = { ...state.config, ...res.active };
        toast(`已儲存。連線測試成功（回應模型：${res.tested_model}）`);
        ctx.rerender();
      } catch (err) { toast(err.message, "error"); }
    },
  },
    h("div", { class: "form-grid" },
      field("AI 服務", providerSel),
      h("div", {}, field("模型", modelInput), modelList),
    ),
    h("div", { class: "form-grid" },
      h("div", {}, field("API 金鑰", keyInput), keyHelp),
      h("div", {}, field("API 網址", baseInput), baseHelp),
    ),
    h("div", { class: "notice", style: "margin:4px 0 14px" },
      "儲存前會先送一個很短的測試請求確認金鑰與模型可用。之後分析時，文件文字會傳到所選的 AI 服務處理；請先確認符合公司保密規範、客戶合約與該服務的資料使用條款。金鑰加密儲存，儲存後不會再顯示。"),
    h("div", { class: "btn-row" },
      h("button", { class: "btn btn-primary", type: "submit" }, "測試並儲存"),
      saved ? h("button", {
        type: "button", class: "btn btn-danger",
        onclick: async (e) => {
          const button = e.currentTarget; // currentTarget is null once the handler awaits
          const msg = data.system
            ? `改回系統預設的 AI 服務（${data.system.provider}，${data.system.model}）？公司的金鑰會被刪除。`
            : "移除公司的 AI 服務設定？系統目前沒有預設服務，AI 分析功能會暫停。";
          if (!(await confirmDialog(msg, { okLabel: "移除公司設定", danger: true }))) return;
          try {
            const res = await busy(button, () => api("DELETE", "/api/ai/settings"));
            state.config = { ...state.config, ...res.active };
            toast("已移除公司的 AI 服務設定");
            ctx.rerender();
          } catch (err) { toast(err.message, "error"); }
        },
      }, data.system ? "改回系統預設" : "移除公司設定") : null,
    ),
  );

  return h("section", { class: "sheet" },
    h("h2", { class: "sheet-title" }, saved ? "變更公司的 AI 服務" : "使用公司自己的 AI 服務"),
    form,
  );
}
