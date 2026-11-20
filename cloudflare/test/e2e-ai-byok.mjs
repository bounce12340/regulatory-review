// End-to-end test of companies' own AI services ("bring your own key") against a running
// instance with the mock AI server (test/mock-ollama.mjs) and, in .dev.vars,
// AI_KEY_SECRET set and AI_ALLOW_LOCAL_BASE_URL=true:
//   BASE_URL=http://127.0.0.1:8787 MOCK_OLLAMA_URL=http://127.0.0.1:8788 node test/e2e-ai-byok.mjs
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8787";
const MOCK = process.env.MOCK_OLLAMA_URL ?? "http://127.0.0.1:8788";
const run = Date.now().toString(36);

function client() {
  let cookie = "";
  return async (method, path, body) => {
    const isForm = body instanceof FormData;
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, data, text };
  };
}

let passed = 0;
async function step(name, fn) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

const lastCall = async () => (await fetch(`${MOCK}/__last`)).json();
const analyze = (who) => who("POST", "/api/ai/analyze", { schema_type: "food_registration", filename: "配方說明（虛擬）.txt", text: "產品配方與原料說明（虛擬示範）" });

const a = client();       // company A admin
const member = client();  // company A member
const b = client();       // company B admin
const ANTHROPIC = { provider: "anthropic", model: "claude-opus-5-5", base_url: MOCK, api_key: "byok-anthropic-key" };

await step("set up two companies and a member", async () => {
  assert.equal((await a("POST", "/api/auth/register", { company_name: `BYOK 製藥 ${run}`, full_name: "管理員甲", email: `byok-a-${run}@a.test`, password: "password-123" })).status, 201);
  assert.equal((await b("POST", "/api/auth/register", { company_name: `BYOK 他公司 ${run}`, full_name: "管理員乙", email: `byok-b-${run}@b.test`, password: "password-123" })).status, 201);
  assert.equal((await a("POST", "/api/users", { full_name: "成員丙", email: `byok-m-${run}@a.test`, password: "password-123", role: "member" })).status, 200);
  assert.equal((await member("POST", "/api/auth/login", { email: `byok-m-${run}@a.test`, password: "password-123" })).status, 200);
});

await step("without settings, a company uses the system's AI service", async () => {
  const s = (await a("GET", "/api/ai/settings")).data;
  assert.equal(s.byok_available, true);
  assert.equal(s.company, null);
  assert.equal(s.active.ai_source, "system");
  assert.ok(s.providers.some((p) => p.id === "anthropic" && p.default_model === "claude-opus-5-5"));
  assert.equal((await analyze(a)).status, 200);
  assert.equal((await lastCall()).url, "/api/chat");
});

await step("only admins change settings; bad keys, models and addresses are refused before saving", async () => {
  assert.equal((await member("PUT", "/api/ai/settings", ANTHROPIC)).status, 403);
  assert.match((await a("PUT", "/api/ai/settings", { ...ANTHROPIC, api_key: "short" })).data.error, /金鑰格式/);
  const badKey = await a("PUT", "/api/ai/settings", { ...ANTHROPIC, api_key: "wrong-key-0123456789" });
  assert.equal(badKey.status, 400);
  assert.match(badKey.data.error, /連線測試失敗.*金鑰無效/);
  const badModel = await a("PUT", "/api/ai/settings", { ...ANTHROPIC, model: "missing-model" });
  assert.equal(badModel.status, 400);
  assert.match(badModel.data.error, /找不到 AI 模型「missing-model」/);
  const refused = await a("PUT", "/api/ai/settings", { ...ANTHROPIC, model: "refuse-model" });
  assert.equal(refused.status, 422);
  assert.match(refused.data.error, /安全政策/);
  for (const base_url of ["http://evil.example/v1", "https://10.0.0.8/v1", "https://intranet/v1", "https://ai.corp/v1", "https://u:p@api.example.com/v1",
    "https://api.example.com/v1?", "https://api.example.com/v1#", "https://localhost./v1", "https://api.example.com:8443/v1"]) {
    assert.equal((await a("PUT", "/api/ai/settings", { ...ANTHROPIC, base_url })).status, 400, base_url);
  }
  // An endpoint that redirects is refused rather than followed, for both protocols.
  for (const body of [{ ...ANTHROPIC, base_url: `${MOCK}/redirect` },
    { provider: "openai_compatible", model: "gpt-mock", base_url: `${MOCK}/redirect/v1`, api_key: "byok-openai-key" }]) {
    const r = await a("PUT", "/api/ai/settings", body);
    assert.equal(r.status, 400, JSON.stringify(r.data));
    assert.match(r.data.error, /轉址/);
  }
  assert.equal((await a("PUT", "/api/ai/settings", { ...ANTHROPIC, provider: "nope" })).status, 400);
  assert.equal((await a("PUT", "/api/ai/settings", { ...ANTHROPIC, model: "bad model;" })).status, 400);
  assert.equal((await a("PUT", "/api/ai/settings", { provider: "openai_compatible", model: "x", api_key: "k" })).status, 400, "custom service needs an address");
  assert.equal((await a("GET", "/api/ai/settings")).data.company, null, "nothing was saved");
});

await step("save Anthropic Claude: tested first, key never shown again", async () => {
  const r = await a("PUT", "/api/ai/settings", ANTHROPIC);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.tested_model, "claude-opus-5-5");
  assert.equal(r.data.company.provider, "anthropic");
  assert.equal(r.data.company.key_hint, "-key");
  assert.equal(r.data.company.updated_by_name, "管理員甲");
  assert.ok(!r.text.includes("byok-anthropic-key"));
  const ping = await lastCall();
  assert.equal(ping.url, "/v1/messages");
  assert.equal(ping.headers.authorization, "Bearer byok-anthropic-key");
  assert.ok(ping.headers["anthropic-version"]);
  assert.equal(ping.body.output_config.effort, "low");
  assert.equal(ping.body.temperature, undefined);
  assert.equal(ping.body.fallbacks, "default");
  assert.match(ping.headers["anthropic-beta"], /server-side-fallback-2026-07-01/);
  const memberView = await member("GET", "/api/ai/settings");
  assert.equal(memberView.status, 200);
  assert.equal(memberView.data.active.ai_provider, "Anthropic Claude");
  assert.equal(memberView.data.company.key_hint, undefined, "the key hint is for admins");
  assert.equal(memberView.data.company.base_url, undefined, "the address is for admins");
  assert.ok(!memberView.text.includes("byok-anthropic-key"));
  const cfg = (await member("GET", "/api/config")).data;
  assert.deepEqual([cfg.ai_enabled, cfg.ai_source, cfg.ai_model], [true, "company", "claude-opus-5-5"]);
  assert.equal((await fetch(`${BASE}/api/config`).then((x) => x.json())).ai_source, "system", "the sign-in page shows the system's service");
});

await step("analysis and item review run on the company's Claude", async () => {
  const r = await analyze(member);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.model, "claude-opus-5-5");
  assert.equal(r.data.completeness_score, 62);
  const sent = await lastCall();
  assert.equal(sent.url, "/v1/messages");
  assert.equal(sent.body.stream, true);
  assert.equal(sent.body.max_tokens, 32000);
  assert.equal(sent.body.output_config.effort, "high");
  assert.equal(sent.body.temperature, undefined);
  assert.equal(sent.body.messages.length, 1);
  assert.match(sent.body.system, /TFDA/);

  const p = await a("POST", "/api/projects", { name: "BYOK 審查測試（虛擬）", schema_type: "new_drug_registration" });
  const item = p.data.items.find((i) => i.criteria?.length >= 2) ?? p.data.items[0];
  const fd = new FormData();
  fd.append("file", new Blob(["%PDF-1.7\n%%EOF\n"]), "安定性（虛擬）.pdf");
  const up = await a("POST", `/api/items/${item.id}/attachments`, fd);
  await a("PUT", `/api/attachments/${up.data.attachment_id}/text`, { status: "ok", text: "長期試驗 25°C/60% RH：0、3 個月（虛擬）。" });
  const rv = await member("POST", `/api/items/${item.id}/review`);
  assert.equal(rv.status, 200, JSON.stringify(rv.data));
  assert.equal(rv.data.review.verdict, "insufficient");
  assert.equal(rv.data.review.model, "claude-opus-5-5");
  assert.equal((await lastCall()).url, "/v1/messages");
});

await step("change the model without re-entering the key; a new service needs a key", async () => {
  const r = await a("PUT", "/api/ai/settings", { provider: "anthropic", model: "claude-sonnet-5-5", base_url: MOCK });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.company.model, "claude-sonnet-5-5");
  assert.equal((await lastCall()).headers.authorization, "Bearer byok-anthropic-key", "the stored key was used");
  const noKey = await a("PUT", "/api/ai/settings", { provider: "openai_compatible", model: "gpt-mock", base_url: `${MOCK}/v1` });
  assert.equal(noKey.status, 400);
  assert.match(noKey.data.error, /請輸入 API 金鑰/);
});

await step("an OpenAI-compatible service works the same way", async () => {
  const r = await a("PUT", "/api/ai/settings", { provider: "openai_compatible", model: "gpt-mock", base_url: `${MOCK}/v1/`, api_key: "byok-openai-key" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.company.base_url, `${MOCK}/v1`);
  const res = await analyze(a);
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.model, "gpt-mock-2026");
  assert.equal(res.data.token_usage.input_tokens, 11000);
  const sent = await lastCall();
  assert.equal(sent.url, "/v1/chat/completions");
  assert.equal(sent.headers.authorization, "Bearer byok-openai-key");
  assert.equal(sent.body.temperature, undefined);
});

await step("other companies keep their own service", async () => {
  assert.equal((await b("GET", "/api/ai/settings")).data.company, null);
  assert.equal((await analyze(b)).status, 200);
  assert.equal((await lastCall()).url, "/api/chat");
});

await step("back to the system's service", async () => {
  assert.equal((await member("DELETE", "/api/ai/settings")).status, 403);
  const r = await a("DELETE", "/api/ai/settings");
  assert.equal(r.status, 200);
  assert.equal(r.data.company, null);
  assert.equal(r.data.active.ai_source, "system");
  assert.equal((await analyze(a)).status, 200);
  assert.equal((await lastCall()).url, "/api/chat");
});

console.log(`\n${passed} bring-your-own-key checks passed.`);
