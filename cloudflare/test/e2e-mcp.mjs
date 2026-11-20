// End-to-end test of the MCP endpoint and its OAuth server against a running instance
// (local D1 migrated, ALLOW_REGISTRATION=true):
//   BASE_URL=http://127.0.0.1:8787 node test/e2e-mcp.mjs
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8787";
const run = Date.now().toString(36);
const MODERN = "2026-07-28";

function client() {
  let cookie = "";
  const call = async (method, path, body, headers = {}) => {
    const isForm = body instanceof FormData;
    const isParams = body instanceof URLSearchParams;
    const res = await fetch(BASE + path, {
      method, redirect: "manual",
      headers: {
        ...(body !== undefined && !isForm && !isParams ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}), ...headers,
      },
      body: body === undefined ? undefined : isForm || isParams ? body : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* HTML or empty */ }
    return { status: res.status, data, text, headers: res.headers };
  };
  return call;
}

let passed = 0;
async function step(name, fn) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

const a = client();       // company A admin
const member = client();  // company A member
const b = client();       // company B admin
let projectId, itemId, textAttachment, scanAttachment, otherItemId;
let readToken, bToken, memberToken;

/** One JSON-RPC call to /mcp. era "legacy" sends what initialize-based clients send. */
async function mcp(bearer, method, params = {}, { era = "modern", headers = {}, id = 1 } = {}) {
  const h = { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${bearer}`, ...headers };
  let body;
  if (era === "modern") {
    if (!("MCP-Protocol-Version" in h)) h["MCP-Protocol-Version"] = MODERN;
    if (!("Mcp-Method" in h)) h["Mcp-Method"] = method;
    if (method === "tools/call" && !("Mcp-Name" in h)) h["Mcp-Name"] = params.name;
    body = { jsonrpc: "2.0", id, method, params: { ...params, _meta: { "io.modelcontextprotocol/protocolVersion": MODERN, "io.modelcontextprotocol/clientInfo": { name: "e2e", version: "1" }, ...(params._meta ?? {}) } } };
  } else {
    if (method !== "initialize" && !("MCP-Protocol-Version" in h)) h["MCP-Protocol-Version"] = "2025-06-18";
    body = { jsonrpc: "2.0", id, method, params };
  }
  for (const [k, v] of Object.entries(h)) if (v === null) delete h[k];
  const res = await fetch(`${BASE}/mcp`, { method: "POST", headers: h, body: JSON.stringify(body) });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* empty */ }
  return { status: res.status, data, headers: res.headers };
}

const callText = (r) => r.data.result.content.map((c) => c.text ?? "").join("\n");
const toolJson = (r) => JSON.parse(callText(r).replace(/^[^{]*/, ""));

function fileForm(name, content) {
  const fd = new FormData();
  fd.append("file", new Blob([content]), name);
  return fd;
}

await step("set up two companies, a case with documents and a member", async () => {
  assert.equal((await a("POST", "/api/auth/register", { company_name: `MCP 製藥 ${run}`, full_name: "管理員甲", email: `mcp-a-${run}@a.test`, password: "password-123" })).status, 201);
  assert.equal((await b("POST", "/api/auth/register", { company_name: `他公司 ${run}`, full_name: "管理員乙", email: `mcp-b-${run}@b.test`, password: "password-123" })).status, 201);
  const p = await a("POST", "/api/projects", { name: "Examplin 新藥查驗登記（虛擬）", schema_type: "new_drug_registration" });
  assert.equal(p.status, 201, JSON.stringify(p.data));
  projectId = p.data.project.id;
  const item = p.data.items.find((i) => i.criteria?.length >= 2) ?? p.data.items[0];
  itemId = item.id;
  otherItemId = p.data.items.find((i) => i.id !== itemId).id;
  const up = await a("POST", `/api/items/${itemId}/attachments`, fileForm("3.2.S.4.1 規格（虛擬）.pdf", "%PDF-1.7\n% test\n%%EOF\n"));
  textAttachment = up.data.attachment_id;
  const body = `原料藥規格（虛擬示範）\n${"含量 98.0%–102.0%。".repeat(3000)}\n不純物 A 不得超過 0.15%。Related Substance B NMT 0.10%.`;
  assert.equal((await a("PUT", `/api/attachments/${textAttachment}/text`, { status: "ok", text: body })).status, 200);
  const scan = await a("POST", `/api/items/${itemId}/attachments`, fileForm("掃描 GMP（虛擬）.pdf", "%PDF-1.4\n%%EOF\n"));
  scanAttachment = scan.data.attachment_id;
  await a("PUT", `/api/attachments/${scanAttachment}/text`, { status: "scanned" });
  assert.equal((await a("POST", "/api/users", { full_name: "成員丙", email: `mcp-m-${run}@a.test`, password: "password-123", role: "member" })).status, 200);
  assert.equal((await member("POST", "/api/auth/login", { email: `mcp-m-${run}@a.test`, password: "password-123" })).status, 200);
});

await step("discovery documents", async () => {
  const pr = await a("GET", "/.well-known/oauth-protected-resource/mcp");
  assert.equal(pr.data.resource, `${BASE}/mcp`);
  assert.deepEqual(pr.data.authorization_servers, [BASE]);
  assert.equal((await a("GET", "/.well-known/oauth-protected-resource")).data.resource, `${BASE}/mcp`);
  const as = await a("GET", "/.well-known/oauth-authorization-server");
  assert.equal(as.data.issuer, BASE);
  assert.equal(as.data.client_id_metadata_document_supported, true);
  assert.ok(as.data.token_endpoint_auth_methods_supported.includes("none"));
  assert.deepEqual(as.data.code_challenge_methods_supported, ["S256"]);
  assert.equal(as.data.authorization_response_iss_parameter_supported, true);
});

await step("MCP is off until an admin turns it on", async () => {
  const r = await fetch(`${BASE}/mcp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(r.status, 401);
  assert.match(r.headers.get("www-authenticate"), /resource_metadata="[^"]+\/\.well-known\/oauth-protected-resource\/mcp"/);
  assert.equal((await a("GET", "/api/mcp")).data.enabled, false);
  assert.equal((await a("POST", "/api/mcp/tokens", { name: "x", scope: "read", days: 30 })).status, 400);
  assert.equal((await member("PATCH", "/api/mcp/settings", { enabled: true })).status, 403);
  const on = await a("PATCH", "/api/mcp/settings", { enabled: true });
  assert.equal(on.status, 200);
  assert.equal(on.data.enabled, true);
  assert.equal(on.data.server_url, `${BASE}/mcp`);
  assert.equal((await b("PATCH", "/api/mcp/settings", { enabled: true })).status, 200);
});

await step("personal tokens", async () => {
  const t = await a("POST", "/api/mcp/tokens", { name: "Cursor 測試", scope: "read", days: 30 });
  assert.equal(t.status, 200, JSON.stringify(t.data));
  assert.match(t.data.token, /^rrp_/);
  readToken = t.data.token;
  assert.equal((await a("POST", "/api/mcp/tokens", { name: "x", scope: "read", days: 7 })).status, 400);
  assert.equal((await a("POST", "/api/mcp/tokens", { name: "x", scope: "admin", days: 30 })).status, 400);
  bToken = (await b("POST", "/api/mcp/tokens", { name: "B", scope: "read write", days: 30 })).data.token;
  memberToken = (await member("POST", "/api/mcp/tokens", { name: "成員", scope: "read write", days: 90 })).data.token;
  const list = await a("GET", "/api/mcp");
  assert.equal(list.data.grants.length, 1);
  assert.equal(list.data.grants[0].kind, "token");
  assert.equal(list.data.grants[0].token_hint, readToken.slice(-4));
  assert.equal(list.data.admin.grants.length, 2, "admin sees the member's token too");
});

await step("initialize-based clients (2025-xx): handshake, tools, no sessions", async () => {
  const init = await mcp(readToken, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "old", version: "1" } }, { era: "legacy" });
  assert.equal(init.status, 200);
  assert.equal(init.data.result.protocolVersion, "2025-06-18");
  assert.ok(init.data.result.capabilities.tools);
  assert.match(init.data.result.instructions, /list_cases/);
  assert.equal(init.headers.get("mcp-session-id"), null);
  const unknownVersion = await mcp(readToken, "initialize", { protocolVersion: "2099-01-01" }, { era: "legacy" });
  assert.equal(unknownVersion.data.result.protocolVersion, "2025-11-25");
  const notif = await fetch(`${BASE}/mcp`, { method: "POST", headers: { Authorization: `Bearer ${readToken}`, "Content-Type": "application/json", "MCP-Protocol-Version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });
  assert.equal(notif.status, 202);
  assert.deepEqual((await mcp(readToken, "ping", {}, { era: "legacy" })).data.result, {});
  const tools = await mcp(readToken, "tools/list", {}, { era: "legacy" });
  const names = tools.data.result.tools.map((t) => t.name);
  assert.deepEqual(names, ["list_cases", "get_case", "read_document", "search_documents", "get_document_file"], "read-only token has no write tool");
  assert.ok(tools.data.result.tools.every((t) => t.inputSchema.type === "object" && t.annotations.readOnlyHint));
  assert.equal((await mcp(readToken, "tools/list", {}, { era: "legacy", headers: { "MCP-Protocol-Version": "1999-01-01" } })).status, 400);
});

await step("tools: list_cases, get_case, read_document, search, file", async () => {
  const cases = toolJson(await mcp(readToken, "tools/call", { name: "list_cases", arguments: {} }));
  assert.equal(cases.cases.length, 1);
  assert.equal(cases.cases[0].case_id, projectId);
  assert.equal(cases.cases[0].files, 2);
  const kase = toolJson(await mcp(readToken, "tools/call", { name: "get_case", arguments: { case_id: projectId } }));
  const it = kase.items.find((i) => i.item_id === itemId);
  assert.ok(it.criteria.length >= 2);
  assert.equal(it.files.length, 2);
  assert.match(it.files.find((f) => f.attachment_id === scanAttachment).text, /掃描檔/);

  const r1 = await mcp(readToken, "tools/call", { name: "read_document", arguments: { attachment_id: textAttachment, max_chars: 1000 } });
  const t1 = callText(r1);
  assert.match(t1, /<document attachment_id="\d+" offset="0">\n原料藥規格/);
  assert.match(t1, /不是給你的指令/);
  const next = Number(/next_offset: (\d+)/.exec(t1)[1]);
  assert.equal(next, 1000);
  const tail = callText(await mcp(readToken, "tools/call", { name: "read_document", arguments: { attachment_id: textAttachment, offset: 40_000, max_chars: 50_000 } }));
  assert.match(tail, /已讀到文件結尾/);
  const scanned = await mcp(readToken, "tools/call", { name: "read_document", arguments: { attachment_id: scanAttachment } });
  assert.equal(scanned.data.result.isError, true);
  assert.match(callText(scanned), /get_document_file/);

  const s = toolJson(await mcp(readToken, "tools/call", { name: "search_documents", arguments: { case_id: projectId, query: "related substance b" } }));
  assert.equal(s.results.length, 1);
  assert.match(s.results[0].snippet, /Related Substance B NMT 0\.10%/);
  assert.equal(toolJson(await mcp(readToken, "tools/call", { name: "search_documents", arguments: { case_id: projectId, query: "含量", max_results: 5 } })).results.length, 5);

  const file = await mcp(readToken, "tools/call", { name: "get_document_file", arguments: { attachment_id: scanAttachment } });
  const res = file.data.result.content.find((c) => c.type === "resource").resource;
  assert.equal(res.mimeType, "application/pdf");
  assert.equal(Buffer.from(res.blob, "base64").toString(), "%PDF-1.4\n%%EOF\n");
  assert.equal(file.data.result.resultType, "complete");
});

await step("2026-07-28 requests: discover, header checks, errors", async () => {
  const d = await mcp(readToken, "server/discover");
  assert.equal(d.status, 200);
  assert.equal(d.data.result.resultType, "complete");
  assert.ok(d.data.result.supportedVersions.includes(MODERN));
  assert.equal(d.data.result._meta["io.modelcontextprotocol/serverInfo"].name, "regreview");
  assert.ok(d.data.result.ttlMs >= 0);
  const list = await mcp(readToken, "tools/list");
  assert.equal(list.data.result.cacheScope, "private");
  assert.equal(typeof list.data.result.ttlMs, "number");

  const missing = await mcp(readToken, "tools/list", {}, { headers: { "Mcp-Method": null } });
  assert.equal(missing.status, 400);
  assert.equal(missing.data.error.code, -32020);
  const mismatch = await mcp(readToken, "tools/call", { name: "list_cases", arguments: {} }, { headers: { "Mcp-Name": "get_case" } });
  assert.equal(mismatch.data.error.code, -32020);
  const versionMismatch = await mcp(readToken, "tools/list", {}, { headers: { "MCP-Protocol-Version": "2025-11-25" } });
  assert.equal(versionMismatch.data.error.code, -32020);
  // A name sent in the base64 sentinel form is decoded before comparing.
  const b64 = await mcp(readToken, "tools/call", { name: "list_cases", arguments: {} }, { headers: { "Mcp-Name": `=?base64?${Buffer.from("list_cases").toString("base64")}?=` } });
  assert.equal(b64.status, 200);
  const unsupported = await mcp(readToken, "tools/list", { _meta: { "io.modelcontextprotocol/protocolVersion": "2030-01-01" } }, { headers: { "MCP-Protocol-Version": "2030-01-01" } });
  assert.equal(unsupported.status, 400);
  assert.equal(unsupported.data.error.code, -32022);
  assert.ok(unsupported.data.error.data.supported.includes(MODERN));
  const unknown = await mcp(readToken, "prompts/list");
  assert.equal(unknown.status, 404);
  assert.equal(unknown.data.error.code, -32601);
  const badTool = await mcp(readToken, "tools/call", { name: "drop_tables", arguments: {} });
  assert.equal(badTool.data.error.code, -32602);
  const noWrite = await mcp(readToken, "tools/call", { name: "save_item_review", arguments: { item_id: itemId, verdict: "pass", summary: "x", model: "m" } });
  assert.equal(noWrite.data.result.isError, true);
});

await step("transport rules: GET 405, batch 400, bad origin 403, CORS preflight", async () => {
  assert.equal((await fetch(`${BASE}/mcp`, { headers: { Authorization: `Bearer ${readToken}` } })).status, 405);
  const batch = await fetch(`${BASE}/mcp`, { method: "POST", headers: { Authorization: `Bearer ${readToken}`, "Content-Type": "application/json" }, body: "[]" });
  assert.equal(batch.status, 400);
  const evil = await fetch(`${BASE}/mcp`, { method: "POST", headers: { Authorization: `Bearer ${readToken}`, "Content-Type": "application/json", Origin: "http://evil.example" }, body: "{}" });
  assert.equal(evil.status, 403);
  const pre = await fetch(`${BASE}/mcp`, { method: "OPTIONS", headers: { Origin: "https://inspector.example", "Access-Control-Request-Method": "POST" } });
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get("access-control-allow-headers"), /Mcp-Method/);
  const bad = await mcp("rrp_not-a-token", "tools/list");
  assert.equal(bad.status, 401);
  assert.match(bad.headers.get("www-authenticate"), /error="invalid_token"/);
});

await step("companies cannot see each other's data", async () => {
  const cases = toolJson(await mcp(bToken, "tools/call", { name: "list_cases", arguments: {} }));
  assert.equal(cases.cases.length, 0);
  for (const [name, args] of [["get_case", { case_id: projectId }], ["read_document", { attachment_id: textAttachment }],
    ["get_document_file", { attachment_id: scanAttachment }], ["search_documents", { case_id: projectId, query: "含量" }],
    ["save_item_review", { item_id: itemId, verdict: "pass", summary: "x", model: "m" }]]) {
    const r = await mcp(bToken, "tools/call", { name, arguments: args });
    assert.equal(r.data.result.isError, true, name);
    assert.match(callText(r), /找不到/);
  }
});

// ── OAuth ──────────────────────────────────────────────────────────────────

const REDIRECT = "http://127.0.0.1:9123/callback";
let clientId, accessToken, refreshToken;
const pkce = () => {
  const verifier = randomBytes(48).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
};

function authorizeUrl(params) {
  const q = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: REDIRECT, code_challenge_method: "S256", state: "st-1", resource: `${BASE}/mcp`, scope: "read write", ...params });
  return `/oauth/authorize?${q}`;
}

/** Signs in as `who` and approves; returns the code from the redirect. */
async function approve(who, { challenge, allowWrite = true, port = 9123 }) {
  const page = await who("GET", authorizeUrl({ code_challenge: challenge, redirect_uri: `http://127.0.0.1:${port}/callback` }));
  assert.equal(page.status, 200, page.text.slice(0, 300));
  const form = new URLSearchParams();
  for (const m of page.text.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)) form.set(m[1], m[2].replace(/&amp;/g, "&").replace(/&quot;/g, '"'));
  form.set("decision", "allow");
  if (allowWrite) form.set("allow_write", "1");
  const res = await who("POST", "/oauth/authorize", form, { "Content-Type": "application/x-www-form-urlencoded", Origin: BASE });
  assert.equal(res.status, 302, res.text.slice(0, 300));
  return new URL(res.headers.get("location"));
}

async function tokenCall(params) {
  const res = await fetch(`${BASE}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
  return { status: res.status, data: await res.json(), headers: res.headers };
}

await step("dynamic client registration", async () => {
  const bad = await a("POST", "/oauth/register", { redirect_uris: ["http://evil.example/cb"] });
  assert.equal(bad.status, 400);
  assert.equal((await a("POST", "/oauth/register", { redirect_uris: ["javascript:alert(1)"] })).status, 400);
  assert.equal((await a("POST", "/oauth/register", { redirect_uris: [REDIRECT], token_endpoint_auth_method: "client_secret_basic" })).status, 400);
  const r = await a("POST", "/oauth/register", { client_name: "測試 AI 代理", redirect_uris: [REDIRECT, "cursor://anysphere.cursor/oauth/callback"], application_type: "native" });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.match(r.data.client_id, /^rrc_/);
  assert.equal(r.data.token_endpoint_auth_method, "none");
  clientId = r.data.client_id;
});

await step("authorize: login first, and nothing leaves the site before the user decides", async () => {
  const anon = client();
  const login = await anon("GET", authorizeUrl({ code_challenge: pkce().challenge }));
  assert.equal(login.status, 302);
  assert.match(login.headers.get("location"), /^\/\?next=%2Foauth%2Fauthorize%3F/);
  // Anyone can register a client that returns to their own site. A crafted link must not
  // bounce visitors there: anonymous visitors go to sign-in, signed-in ones see an error page.
  const lure = (await anon("POST", "/oauth/register", { client_name: "Phish", redirect_uris: ["https://evil.example/landing"] })).data.client_id;
  const crafted = authorizeUrl({ client_id: lure, redirect_uri: "https://evil.example/landing", response_type: "x", code_challenge: "" });
  const anonLure = await anon("GET", crafted);
  assert.equal(anonLure.status, 302);
  assert.match(anonLure.headers.get("location"), /^\/\?next=/);
  const signedLure = await a("GET", crafted);
  assert.equal(signedLure.status, 400);
  assert.equal(signedLure.headers.get("location"), null);
  // Unknown redirect URI or client: an error page, no redirect.
  assert.equal((await a("GET", authorizeUrl({ code_challenge: pkce().challenge, redirect_uri: "https://evil.example/cb" }))).status, 400);
  assert.equal((await a("GET", authorizeUrl({ code_challenge: pkce().challenge, client_id: "rrc_nope" }))).status, 400);
  // Missing PKCE or a foreign resource: also an error page, never a redirect.
  const noPkce = await a("GET", authorizeUrl({ code_challenge: "" }));
  assert.equal(noPkce.status, 400);
  assert.equal(noPkce.headers.get("location"), null);
  assert.match(noPkce.text, /PKCE/);
  const wrongResource = await a("GET", authorizeUrl({ code_challenge: pkce().challenge, resource: "https://other.example/mcp" }));
  assert.equal(wrongResource.status, 400);
  assert.equal(wrongResource.headers.get("location"), null);
  // The consent page names the client and where it returns to, and cannot be framed.
  const page = await a("GET", authorizeUrl({ code_challenge: pkce().challenge }));
  assert.match(page.text, /測試 AI 代理/);
  assert.match(page.text, /127\.0\.0\.1:9123/);
  assert.equal(page.headers.get("x-frame-options"), "DENY");
  // A forged POST (no CSRF token from the page) is refused.
  const forged = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: REDIRECT, code_challenge: pkce().challenge, code_challenge_method: "S256", decision: "allow", csrf: "x" });
  assert.equal((await a("POST", "/oauth/authorize", forged, { "Content-Type": "application/x-www-form-urlencoded" })).status, 403);
  // Deny sends access_denied back.
  const p = pkce();
  const deny = await a("GET", authorizeUrl({ code_challenge: p.challenge }));
  const form = new URLSearchParams();
  for (const m of deny.text.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)) form.set(m[1], m[2].replace(/&amp;/g, "&"));
  form.set("decision", "deny");
  const denied = await a("POST", "/oauth/authorize", form, { "Content-Type": "application/x-www-form-urlencoded", Origin: BASE });
  assert.equal(new URL(denied.headers.get("location")).searchParams.get("error"), "access_denied");
});

await step("code exchange with PKCE, single-use codes, iss in the redirect", async () => {
  const p = pkce();
  const cb = await approve(a, { challenge: p.challenge, port: 40567 });
  assert.equal(cb.origin + cb.pathname, "http://127.0.0.1:40567/callback", "loopback port is not compared");
  assert.equal(cb.searchParams.get("state"), "st-1");
  assert.equal(cb.searchParams.get("iss"), BASE);
  const code = cb.searchParams.get("code");
  const base = { grant_type: "authorization_code", code, client_id: clientId, redirect_uri: "http://127.0.0.1:40567/callback", resource: `${BASE}/mcp` };
  const wrong = await tokenCall({ ...base, code_verifier: pkce().verifier });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.data.error, "invalid_grant");
  // The failed attempt used the code up.
  assert.equal((await tokenCall({ ...base, code_verifier: p.verifier })).data.error, "invalid_grant");

  const p2 = pkce();
  const cb2 = await approve(a, { challenge: p2.challenge });
  const ok = await tokenCall({ grant_type: "authorization_code", code: cb2.searchParams.get("code"), client_id: clientId, redirect_uri: REDIRECT, code_verifier: p2.verifier, resource: `${BASE}/mcp` });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.match(ok.data.access_token, /^rra_/);
  assert.match(ok.data.refresh_token, /^rrr_/);
  assert.equal(ok.data.token_type, "Bearer");
  assert.equal(ok.data.scope, "read write");
  assert.equal(ok.headers.get("cache-control"), "no-store");
  accessToken = ok.data.access_token;
  refreshToken = ok.data.refresh_token;
  assert.equal((await tokenCall({ grant_type: "authorization_code", code: cb2.searchParams.get("code"), client_id: clientId, redirect_uri: REDIRECT, code_verifier: p2.verifier })).data.error, "invalid_grant");
  assert.equal((await tokenCall({ grant_type: "password", client_id: clientId })).data.error, "unsupported_grant_type");
});

await step("an OAuth connection with write permission saves a review the team can see", async () => {
  const tools = await mcp(accessToken, "tools/list");
  assert.ok(tools.data.result.tools.some((t) => t.name === "save_item_review"));
  const saved = await mcp(accessToken, "tools/call", { name: "save_item_review", arguments: {
    item_id: itemId, verdict: "pass", summary: "規格表列出含量與不純物限度，但未附檢驗方法確效。",
    findings: [{ criterion: 1, status: "met", note: "含量限度 98.0–102.0%" }, { criterion: 2, status: "not_met", note: "缺分析方法確效" }],
    fixes: ["補附分析方法確效報告"], model: "claude-opus-5-5",
  } });
  assert.equal(saved.data.result.isError, undefined, callText(saved));
  assert.match(callText(saved), /改為需修改/);
  const detail = (await a("GET", `/api/projects/${projectId}`)).data.items.find((i) => i.id === itemId);
  assert.equal(detail.review.verdict, "revise");
  assert.equal(detail.review.model, "claude-opus-5-5（MCP：測試 AI 代理）");
  assert.equal(detail.review.fingerprint, detail.files_fingerprint);
  assert.equal(detail.review.findings.length, 2);
  const bad = await mcp(accessToken, "tools/call", { name: "save_item_review", arguments: { item_id: itemId, verdict: "great", summary: "x", model: "m" } });
  assert.equal(bad.data.result.isError, true);
});

await step("refresh tokens rotate; revocation ends the connection", async () => {
  const r = await tokenCall({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.notEqual(r.data.refresh_token, refreshToken);
  assert.equal((await tokenCall({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId })).data.error, "invalid_grant");
  assert.equal((await tokenCall({ grant_type: "refresh_token", refresh_token: r.data.refresh_token, client_id: "rrc_other" })).data.error, "invalid_grant");
  refreshToken = r.data.refresh_token;
  accessToken = r.data.access_token;
  assert.equal((await mcp(accessToken, "tools/list")).status, 200);

  // Reconnecting the same client replaces the old connection instead of adding one.
  const before = (await a("GET", "/api/mcp")).data.grants.filter((g) => g.kind === "oauth").length;
  const p = pkce();
  const cb = await approve(a, { challenge: p.challenge, allowWrite: false });
  const t = await tokenCall({ grant_type: "authorization_code", code: cb.searchParams.get("code"), client_id: clientId, redirect_uri: REDIRECT, code_verifier: p.verifier });
  assert.equal(t.data.scope, "read");
  assert.equal((await a("GET", "/api/mcp")).data.grants.filter((g) => g.kind === "oauth").length, before);
  assert.equal((await mcp(accessToken, "tools/list")).status, 401, "the replaced connection's token stopped working");

  const rev = await fetch(`${BASE}/oauth/revoke`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: t.data.access_token }) });
  assert.equal(rev.status, 200);
  assert.equal((await mcp(t.data.access_token, "tools/list")).status, 401);
  assert.equal((await tokenCall({ grant_type: "refresh_token", refresh_token: t.data.refresh_token, client_id: clientId })).data.error, "invalid_grant");
});

await step("admin controls: switch off, revoke, deactivate; activity log", async () => {
  // The member's own token works, and their write scope follows their role.
  assert.ok((await mcp(memberToken, "tools/list")).data.result.tools.some((t) => t.name === "save_item_review"));
  const off = await a("PATCH", "/api/mcp/settings", { enabled: false });
  assert.equal(off.data.enabled, false);
  assert.equal((await mcp(memberToken, "tools/list")).status, 403);
  await a("PATCH", "/api/mcp/settings", { enabled: true });
  assert.equal((await mcp(memberToken, "tools/list")).status, 200);

  const overview = (await a("GET", "/api/mcp")).data;
  const memberGrant = overview.admin.grants.find((g) => g.user_name === "成員丙");
  assert.equal((await b("DELETE", `/api/mcp/grants/${memberGrant.id}`)).status, 404, "other companies cannot revoke");
  assert.equal((await a("DELETE", `/api/mcp/grants/${memberGrant.id}`)).status, 200);
  assert.equal((await mcp(memberToken, "tools/list")).status, 401);

  const again = (await member("POST", "/api/mcp/tokens", { name: "成員 2", scope: "read", days: 30 })).data.token;
  assert.equal((await mcp(again, "tools/list")).status, 200);
  const users = (await a("GET", "/api/users")).data.users;
  const m = users.find((u) => u.full_name === "成員丙");
  await a("PATCH", `/api/users/${m.id}`, { is_active: false });
  assert.equal((await mcp(again, "tools/list")).status, 401);
  assert.equal((await a("GET", "/api/mcp")).data.admin.grants.filter((g) => g.user_name === "成員丙").length, 0);

  const audit = (await a("GET", "/api/mcp")).data.admin.audit;
  assert.ok(audit.some((r) => r.tool === "read_document" && r.target === `attachment:${textAttachment}` && r.ok));
  assert.ok(audit.some((r) => r.tool === "save_item_review" && r.agent === "測試 AI 代理"));
  assert.ok(audit.some((r) => r.tool === "read_document" && !r.ok), "a failed call is logged too");
  assert.equal((await member("GET", "/api/mcp")).status, 401, "deactivated member is logged out");
  assert.equal((await b("GET", "/api/mcp")).data.admin.audit.every((r) => r.agent === "B"), true);
});

await step("personal token revoked from the page stops working", async () => {
  const grants = (await a("GET", "/api/mcp")).data.grants;
  const tokenGrant = grants.find((g) => g.kind === "token");
  assert.equal((await a("DELETE", `/api/mcp/grants/${tokenGrant.id}`)).status, 200);
  assert.equal((await mcp(readToken, "tools/list")).status, 401);
});

console.log(`\nAll ${passed} MCP checks passed against ${BASE}`);
