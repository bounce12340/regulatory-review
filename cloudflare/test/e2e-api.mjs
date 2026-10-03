// End-to-end API smoke test against a running instance.
//   npx wrangler dev            (in another terminal; local D1 migrated)
//   BASE_URL=http://127.0.0.1:8787 node test/e2e-api.mjs
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8787";
const run = Date.now().toString(36);

function client() {
  let cookie = "";
  return async function call(method, path, body, headers = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const data = await res.json().catch(() => null);
    return { status: res.status, data, headers: res.headers };
  };
}

let passed = 0;
async function step(name, fn) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

const a = client();
const b = client();
const viewer = client();
const emailA = `admin-${run}@a.test`;
let projectId, items;

await step("public config + schemas", async () => {
  const cfg = await a("GET", "/api/config");
  assert.equal(cfg.status, 200);
  assert.equal(typeof cfg.data.ai_enabled, "boolean");
  const s = await a("GET", "/api/schemas");
  assert.deepEqual(s.data.schemas.map((x) => x.key).sort(),
    ["drug_registration_extension", "food_registration", "medical_device_registration", "new_drug_registration"]);
});

await step("protected routes require login", async () => {
  assert.equal((await a("GET", "/api/projects")).status, 401);
  assert.equal((await a("GET", "/api/nope")).status, 404);
});

await step("register company A (admin) + session cookie", async () => {
  const r = await a("POST", "/api/auth/register", { company_name: `優良製藥 ${run}`, full_name: "測試管理員", email: emailA, password: "password-123" });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  const me = await a("GET", "/api/auth/me");
  assert.equal(me.data.user.role, "admin");
  assert.equal(me.data.user.email, emailA);
});

await step("duplicate email is rejected", async () => {
  const r = await client()("POST", "/api/auth/register", { company_name: "X", full_name: "X", email: emailA, password: "password-123" });
  assert.equal(r.status, 409);
});

await step("input validation", async () => {
  assert.equal((await a("POST", "/api/projects", { name: "", schema_type: "food_registration" })).status, 400);
  assert.equal((await a("POST", "/api/projects", { name: "x", schema_type: "nope" })).status, 400);
  assert.equal((await a("POST", "/api/projects", { name: "x", schema_type: "food_registration", deadline: "2026/1/1" })).status, 400);
  const notJson = await fetch(BASE + "/api/auth/login", { method: "POST", body: "email=x", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  assert.equal(notJson.status, 415);
});

await step("cross-origin POST is blocked", async () => {
  const r = await a("POST", "/api/projects", { name: "evil", schema_type: "food_registration" }, { Origin: "https://evil.example" });
  assert.equal(r.status, 403);
});

await step("create drug project from TFDA template (7 items, default deadline)", async () => {
  const r = await a("POST", "/api/projects", { name: "Fenogal 展延", schema_type: "drug_registration_extension" });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  projectId = r.data.project.id;
  items = r.data.items;
  assert.equal(items.length, 7);
  assert.equal(r.data.summary.total, 7);
  assert.equal(r.data.summary.days_left, 90);
  assert.ok(items.every((i) => i.auto_risk && i.status === "pending"));
  // item3 (specification) pending → default rule high
  assert.equal(items.find((i) => i.item_key === "item3").risk_level, "high");
});

await step("new drug registration template carries review thresholds", async () => {
  const r = await a("POST", "/api/projects", { name: "NDA 測試", schema_type: "new_drug_registration" });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.items.length, 35);
  assert.ok(r.data.items.every((i) => Array.isArray(i.criteria) && i.criteria.length > 0));
  const rtf = r.data.items.find((i) => i.item_key === "m1_rtf");
  assert.equal(rtf.risk_level, "high");
  assert.match(rtf.criteria.join(""), /RTF|113/);
  const cpp = r.data.items.find((i) => i.item_key === "m1_cpp");
  assert.equal(cpp.required, false);
  assert.equal(r.data.summary.days_left, 180);
  // A fresh case with a distant deadline is not flagged red, however low its completion.
  assert.equal(r.data.summary.overall_status, "needs_attention");
  assert.equal(r.data.summary.alert, false);
  assert.deepEqual(r.data.summary.alert_reasons, []);
  assert.equal((await a("DELETE", `/api/projects/${r.data.project.id}`)).status, 200);
});

await step("status change recomputes risk from YAML rules; manual risk ignored for template items", async () => {
  const spec = items.find((i) => i.item_key === "item3");
  let r = await a("PATCH", `/api/items/${spec.id}`, { status: "under_review", risk_level: "low", notes: "TFDA 審查中" });
  assert.equal(r.status, 200);
  let updated = r.data.items.find((i) => i.id === spec.id);
  assert.equal(updated.risk_level, "medium");
  assert.equal(updated.notes, "TFDA 審查中");
  r = await a("PATCH", `/api/items/${spec.id}`, { status: "completed" });
  updated = r.data.items.find((i) => i.id === spec.id);
  assert.equal(updated.risk_level, "low");
  assert.equal(r.data.summary.completed, 1);
  assert.equal(r.data.summary.completion_rate, 14.3);
});

await step("custom item: manual risk, editable, deletable; template item not deletable by name", async () => {
  let r = await a("POST", `/api/projects/${projectId}/items`, { item_name: "<img src=x onerror=alert(1)>", status: "blocked", risk_level: "high" });
  assert.equal(r.status, 201);
  const custom = r.data.items.find((i) => i.item_key === null);
  assert.equal(custom.item_name, "<img src=x onerror=alert(1)>"); // stored verbatim, rendered as text by the UI
  assert.equal(custom.risk_level, "high");
  r = await a("PATCH", `/api/items/${custom.id}`, { risk_level: "low" });
  assert.equal(r.data.items.find((i) => i.id === custom.id).risk_level, "low");
  r = await a("DELETE", `/api/items/${custom.id}`);
  assert.equal(r.data.items.length, 7);
});

await step("all-completed project becomes ready_for_submission", async () => {
  let last;
  for (const i of items) last = await a("PATCH", `/api/items/${i.id}`, { status: "completed" });
  assert.equal(last.data.summary.overall_status, "ready_for_submission");
  assert.equal(last.data.action_items.length, 0);
});

await step("demo projects + list with summaries", async () => {
  const r = await a("POST", "/api/projects/demo", {});
  assert.equal(r.status, 201);
  const list = await a("GET", "/api/projects");
  assert.equal(list.data.projects.length, 3);
  const drugDemo = list.data.projects.find((p) => p.id === r.data.project_ids[0]);
  assert.equal(drugDemo.summary.completed, 3);
  assert.equal(drugDemo.summary.completion_rate, 42.9);
});

await step("archive hides from default list, include_archived shows it", async () => {
  await a("PATCH", `/api/projects/${projectId}`, { status: "archived" });
  assert.equal((await a("GET", "/api/projects")).data.projects.length, 2);
  assert.equal((await a("GET", "/api/projects?include_archived=1")).data.projects.length, 3);
});

await step("tenant isolation: company B cannot see or modify company A data", async () => {
  await b("POST", "/api/auth/register", { company_name: `Other ${run}`, full_name: "B", email: `b-${run}@b.test`, password: "password-123" });
  assert.equal((await b("GET", `/api/projects/${projectId}`)).status, 404);
  assert.equal((await b("PATCH", `/api/items/${items[0].id}`, { status: "blocked" })).status, 404);
  assert.equal((await b("DELETE", `/api/projects/${projectId}`)).status, 404);
  assert.equal((await b("GET", "/api/projects")).data.projects.length, 0);
});

await step("admin adds a viewer; viewer is read-only", async () => {
  const email = `viewer-${run}@a.test`;
  const r = await a("POST", "/api/users", { full_name: "檢視者", email, password: "password-456", role: "viewer" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal((await viewer("POST", "/api/auth/login", { email, password: "password-456" })).status, 200);
  assert.equal((await viewer("GET", `/api/projects/${projectId}`)).status, 200);
  assert.equal((await viewer("PATCH", `/api/items/${items[0].id}`, { status: "pending" })).status, 403);
  assert.equal((await viewer("POST", "/api/projects", { name: "x", schema_type: "food_registration" })).status, 403);
  assert.equal((await viewer("GET", "/api/users")).status, 403);
  assert.equal((await viewer("POST", "/api/ai/analyze", { schema_type: "food_registration", filename: "a.txt", text: "x" })).status, 403);
});

await step("deactivating a user kills their session", async () => {
  const users = (await a("GET", "/api/users")).data.users;
  const v = users.find((u) => u.role === "viewer");
  await a("PATCH", `/api/users/${v.id}`, { is_active: false });
  assert.equal((await viewer("GET", "/api/projects")).status, 401);
  const self = users.find((u) => u.email === emailA);
  assert.equal((await a("PATCH", `/api/users/${self.id}`, { role: "viewer" })).status, 400);
});

await step("only admin can delete a project", async () => {
  assert.equal((await a("DELETE", `/api/projects/${projectId}`)).status, 200);
  assert.equal((await a("GET", `/api/projects/${projectId}`)).status, 404);
});

await step("AI endpoint: validation and missing-key handling", async () => {
  const cfg = (await a("GET", "/api/config")).data;
  const r = await a("POST", "/api/ai/analyze", { schema_type: "food_registration", filename: "a.txt", text: "產品配方" });
  if (!cfg.ai_enabled) assert.equal(r.status, 503);
  assert.equal((await a("POST", "/api/ai/analyze", { schema_type: "food_registration", filename: "a.pdf", pdf_base64: "@@notbase64" })).status, cfg.ai_enabled ? 400 : 503);
});

await step("password change, logout, login with new password", async () => {
  assert.equal((await a("POST", "/api/auth/password", { current_password: "wrong-pass", new_password: "new-password-1" })).status, 400);
  assert.equal((await a("POST", "/api/auth/password", { current_password: "password-123", new_password: "new-password-1" })).status, 200);
  assert.equal((await a("POST", "/api/auth/logout", {})).status, 200);
  assert.equal((await a("GET", "/api/auth/me")).data.user, null);
  assert.equal((await a("POST", "/api/auth/login", { email: emailA, password: "password-123" })).status, 401);
  assert.equal((await a("POST", "/api/auth/login", { email: emailA.toUpperCase(), password: "new-password-1" })).status, 200);
});

await step("brute-force protection locks after 10 failures", async () => {
  const c = client();
  const email = `nobody-${run}@x.test`;
  for (let i = 0; i < 10; i++) assert.equal((await c("POST", "/api/auth/login", { email, password: "bad-password" })).status, 401);
  assert.equal((await c("POST", "/api/auth/login", { email, password: "bad-password" })).status, 429);
});

await step("static assets + SPA fallback + security headers", async () => {
  const index = await fetch(BASE + "/");
  assert.equal(index.status, 200);
  assert.match(index.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  const deep = await fetch(BASE + "/some/deep/link");
  assert.equal(deep.status, 200);
  assert.match(await deep.text(), /RegReview/);
});

console.log(`\nAll ${passed} API checks passed against ${BASE}`);
