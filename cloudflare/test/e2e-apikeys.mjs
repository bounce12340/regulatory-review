// End-to-end test of REST API keys against a running instance (local D1 migrated,
// ALLOW_REGISTRATION=true):
//   BASE_URL=http://127.0.0.1:8787 node test/e2e-apikeys.mjs
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8787";
const run = Date.now().toString(36);

/** A browser-like client that keeps its session cookie. */
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
    return { status: res.status, data, text, headers: res.headers };
  };
}

/** A program calling with an API key (no cookies). */
async function withKey(key, method, path, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}) },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, data, text, headers: res.headers };
}

let passed = 0;
async function step(name, fn) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

/** Audit rows are written after the response; wait for them briefly. */
async function eventually(fn, tries = 20) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (err) { if (i >= tries) throw err; await new Promise((r) => setTimeout(r, 100)); }
  }
}

const a = client();       // company A admin
const member = client();  // company A member
const viewer = client();  // company A viewer
const b = client();       // company B admin
let projectId, itemId, adminRead, adminWrite, memberWrite, viewerRead, bKey, memberId;

await step("set up two companies, a case, a member and a viewer", async () => {
  assert.equal((await a("POST", "/api/auth/register", { company_name: `API 製藥 ${run}`, full_name: "管理員甲", email: `api-a-${run}@a.test`, password: "password-123" })).status, 201);
  assert.equal((await b("POST", "/api/auth/register", { company_name: `API 他公司 ${run}`, full_name: "管理員乙", email: `api-b-${run}@b.test`, password: "password-123" })).status, 201);
  const p = await a("POST", "/api/projects", { name: "Examplin 新藥查驗登記（虛擬）", schema_type: "new_drug_registration" });
  assert.equal(p.status, 201);
  projectId = p.data.project.id;
  itemId = p.data.items[0].id;
  for (const [who, role] of [[member, "member"], [viewer, "viewer"]]) {
    assert.equal((await a("POST", "/api/users", { full_name: `${role}丙`, email: `api-${role}-${run}@a.test`, password: "password-123", role })).status, 200);
    assert.equal((await who("POST", "/api/auth/login", { email: `api-${role}-${run}@a.test`, password: "password-123" })).status, 200);
  }
  memberId = (await a("GET", "/api/users")).data.users.find((u) => u.role === "member").id;
});

await step("API keys are off until an admin turns them on", async () => {
  const o = await a("GET", "/api/api-keys");
  assert.equal(o.data.enabled, false);
  assert.equal(o.data.base_url, `${BASE}/api`);
  assert.equal((await a("POST", "/api/api-keys", { name: "x", scope: "read", days: 30 })).status, 400);
  assert.equal((await member("PATCH", "/api/api-keys/settings", { enabled: true })).status, 403);
  const on = await a("PATCH", "/api/api-keys/settings", { enabled: true });
  assert.equal(on.status, 200);
  assert.equal(on.data.enabled, true);
  assert.equal((await b("PATCH", "/api/api-keys/settings", { enabled: true })).status, 200);
});

await step("create keys within each role", async () => {
  const create = async (who, body) => {
    const r = await who("POST", "/api/api-keys", body);
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.match(r.data.key, /^rrk_[\w-]{40,}$/);
    return r.data.key;
  };
  adminRead = await create(a, { name: "報表腳本", scope: "read", days: 30 });
  adminWrite = await create(a, { name: "ERP 同步", scope: "read write", days: 365 });
  memberWrite = await create(member, { name: "成員自動化", scope: "read write", days: 90 });
  viewerRead = await create(viewer, { name: "檢視者唯讀", scope: "read" });
  bKey = await create(b, { name: "B", scope: "read write", days: 30 });
  assert.equal((await viewer("POST", "/api/api-keys", { name: "x", scope: "read write", days: 30 })).status, 403);
  assert.equal((await a("POST", "/api/api-keys", { name: "x", scope: "read", days: 7 })).status, 400);
  assert.equal((await a("POST", "/api/api-keys", { name: "x", scope: "admin", days: 30 })).status, 400);
  assert.equal((await a("POST", "/api/api-keys", { scope: "read", days: 30 })).status, 400);
  const mine = (await member("GET", "/api/api-keys")).data;
  assert.equal(mine.keys.length, 1);
  assert.equal(mine.keys[0].key_hint, memberWrite.slice(-4));
  assert.equal(mine.admin, null);
  assert.ok(!JSON.stringify(mine).includes(memberWrite), "the key itself is never shown again");
});

await step("a read-only key reads, and cannot change anything", async () => {
  const me = await withKey(adminRead, "GET", "/api/auth/me");
  assert.equal(me.status, 200);
  assert.equal(me.data.user.full_name, "管理員甲");
  assert.deepEqual(me.data.api_key, { name: "報表腳本", scope: "read" });
  const list = await withKey(adminRead, "GET", "/api/projects");
  assert.equal(list.status, 200);
  assert.ok(list.data.projects.some((p) => p.id === projectId));
  assert.equal((await withKey(adminRead, "GET", `/api/projects/${projectId}`)).status, 200);
  const post = await withKey(adminRead, "POST", "/api/projects", { name: "x", schema_type: "new_drug_registration" });
  assert.equal(post.status, 403);
  assert.match(post.data.error, /唯讀/);
  assert.equal((await withKey(viewerRead, "PATCH", `/api/items/${itemId}`, { status: "completed" })).status, 403);
});

await step("a read-write key works like its member: edit an item, upload and download a file", async () => {
  const patch = await withKey(memberWrite, "PATCH", `/api/items/${itemId}`, { status: "in_progress", notes: "由自動化腳本更新（測試）" });
  assert.equal(patch.status, 200, JSON.stringify(patch.data));
  const fd = new FormData();
  fd.append("file", new Blob(["%PDF-1.7\n% api key test\n%%EOF\n"]), "API 上傳（虛擬）.pdf");
  const up = await withKey(memberWrite, "POST", `/api/items/${itemId}/attachments`, fd);
  assert.equal(up.status, 201, JSON.stringify(up.data));
  const dl = await withKey(adminRead, "GET", `/api/attachments/${up.data.attachment_id}`);
  assert.equal(dl.status, 200);
  assert.match(dl.text, /api key test/);
  // The member's role still applies: deleting a case is for admins only.
  assert.equal((await withKey(memberWrite, "DELETE", `/api/projects/${projectId}`)).status, 403);
});

await step("keys never reach sign-in, members or access settings", async () => {
  for (const [m, path, body] of [
    ["GET", "/api/users"], ["POST", "/api/users", { full_name: "x", email: `x-${run}@a.test`, password: "password-123" }],
    ["POST", "/api/api-keys", { name: "x", scope: "read", days: 30 }], ["GET", "/api/api-keys"],
    ["PATCH", "/api/api-keys/settings", { enabled: false }], ["POST", "/api/mcp/tokens", { name: "x", scope: "read", days: 30 }],
    ["POST", "/api/auth/password", { current_password: "password-123", new_password: "password-456" }],
    ["POST", "/api/auth/logout", {}],
    ["GET", "/api/ai/settings"], ["PUT", "/api/ai/settings", { provider: "openai_compatible", model: "x", base_url: "https://attacker.example/v1", api_key: "k" }],
    ["DELETE", "/api/ai/settings"],
  ]) {
    const r = await withKey(adminWrite, m, path, body);
    assert.equal(r.status, 403, `${m} ${path}`);
  }
});

await step("bad keys get a 401; other companies' data stays invisible", async () => {
  for (const bad of ["rrk_not-a-real-key", "rrp_some-mcp-token", "garbage"]) {
    const r = await withKey(bad, "GET", "/api/projects");
    assert.equal(r.status, 401, bad);
    assert.match(r.headers.get("www-authenticate"), /error="invalid_token"/);
  }
  const basic = await fetch(`${BASE}/api/projects`, { headers: { Authorization: "Basic dXNlcjpwYXNz" } });
  assert.equal(basic.status, 401);
  assert.equal((await withKey(bKey, "GET", `/api/projects/${projectId}`)).status, 404);
  assert.ok(!(await withKey(bKey, "GET", "/api/projects")).data.projects.some((p) => p.id === projectId));
  assert.equal((await withKey(bKey, "PATCH", `/api/items/${itemId}`, { status: "completed" })).status, 404);
  // Public endpoints and cookie sessions are unaffected.
  assert.equal((await fetch(`${BASE}/api/health`)).status, 200);
  assert.equal((await a("GET", "/api/projects")).status, 200);
});

await step("admins see every key and its activity; members only their own", async () => {
  const o = await eventually(async () => {
    const d = (await a("GET", "/api/api-keys")).data;
    assert.ok(d.admin.audit.some((r) => r.key_name === "成員自動化" && r.method === "POST" && r.path === `/api/items/${itemId}/attachments` && r.status === 201));
    return d;
  });
  assert.equal(o.admin.keys.length, 4);
  assert.ok(o.admin.audit.some((r) => r.key_name === "報表腳本" && r.method === "POST" && r.status === 403), "refused attempts are logged");
  assert.ok(o.admin.audit.some((r) => r.key_name === "ERP 同步" && r.path === "/api/users" && r.status === 403));
  assert.ok(o.admin.keys.find((k) => k.name === "成員自動化").last_used_at, "last use is recorded");
  assert.ok(o.admin.audit.every((r) => r.key_name !== "B"), "other companies' activity is not shown");
});

await step("switch off, revoke and deactivate stop keys at once", async () => {
  await a("PATCH", "/api/api-keys/settings", { enabled: false });
  const off = await withKey(memberWrite, "GET", "/api/projects");
  assert.equal(off.status, 403);
  assert.match(off.data.error, /關閉/);
  assert.equal((await member("POST", "/api/api-keys", { name: "x", scope: "read", days: 30 })).status, 400);
  await a("PATCH", "/api/api-keys/settings", { enabled: true });
  assert.equal((await withKey(memberWrite, "GET", "/api/projects")).status, 200);

  const keys = (await a("GET", "/api/api-keys")).data.admin.keys;
  const adminReadRow = keys.find((k) => k.name === "報表腳本");
  const memberRow = keys.find((k) => k.name === "成員自動化");
  assert.equal((await member("DELETE", `/api/api-keys/${adminReadRow.id}`)).status, 404, "members cannot revoke others' keys");
  assert.equal((await b("DELETE", `/api/api-keys/${memberRow.id}`)).status, 404, "other companies cannot revoke");
  assert.equal((await a("DELETE", `/api/api-keys/${adminReadRow.id}`)).status, 200);
  assert.equal((await withKey(adminRead, "GET", "/api/projects")).status, 401);

  await a("PATCH", `/api/users/${memberId}`, { is_active: false });
  assert.equal((await withKey(memberWrite, "GET", "/api/projects")).status, 401);
  assert.ok(!(await a("GET", "/api/api-keys")).data.admin.keys.some((k) => k.name === "成員自動化"), "the member's keys are removed");
  assert.equal((await withKey(adminWrite, "GET", "/api/projects")).status, 200, "other keys keep working");
});

console.log(`\n${passed} API key end-to-end checks passed.`);
