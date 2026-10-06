// End-to-end API smoke test against a running instance.
//   npx wrangler dev            (in another terminal; local D1 migrated)
//   BASE_URL=http://127.0.0.1:8787 node test/e2e-api.mjs
// To cover the AI path offline, start test/mock-ollama.mjs, run wrangler dev with
//   --var OLLAMA_API_KEY:test-key --var AI_BASE_URL:http://127.0.0.1:8788
// and set MOCK_OLLAMA_URL=http://127.0.0.1:8788 here.
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8787";
const run = Date.now().toString(36);

const cookies = new WeakMap();
async function cookieOf(c) { return cookies.get(c)(); }

function client() {
  let cookie = "";
  const call = async function call(method, path, body, headers = {}) {
    // FormData bodies (file uploads) go as multipart; fetch sets the boundary header.
    const isForm = body instanceof FormData;
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* not JSON, e.g. a downloaded file */ }
    return { status: res.status, data, text, headers: res.headers };
  };
  cookies.set(call, () => cookie);
  return call;
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
    ["bse_application", "dmf_rtf_cep", "dmf_rtf_full", "dmf_rtf_lean", "dmf_rtf_reference", "drug_registration_extension", "food_registration",
      "gmp_onsite_inspection", "medical_device_registration", "new_drug_registration", "pmf_bio_full", "pmf_bio_simplified",
      "pmf_expansion", "pmf_nonsterile_full", "pmf_nonsterile_simplified", "pmf_quote_holder_new", "pmf_quote_nonholder_diff",
      "pmf_quote_same", "pmf_sterile_full", "pmf_sterile_simplified"]);
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
  assert.equal(r.data.items.length, 46);
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

await step("DMF RTF checklists: refuse-to-file verdict and 不適用 with a reason", async () => {
  const schemas = (await a("GET", "/api/schemas")).data.schemas;
  for (const [key, n] of [["dmf_rtf_full", 11], ["dmf_rtf_reference", 8], ["dmf_rtf_lean", 8], ["dmf_rtf_cep", 5]]) {
    assert.equal(schemas.find((s) => s.key === key)?.item_count, n, key);
  }
  let r = await a("POST", "/api/projects", { name: "DMF 查檢表一", schema_type: "dmf_rtf_full" });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const pid = r.data.project.id;
  assert.equal(r.data.rtf.verdict, "refuse");
  assert.deepEqual(r.data.rtf.rules.map((x) => [x.failures.length, x.max_failures]), [[6, 0], [5, 2]]);
  const byKey = Object.fromEntries(r.data.items.map((i) => [i.item_key, i]));

  // 不適用 needs a reason in the notes.
  assert.equal((await a("PATCH", `/api/items/${byKey.dmf1_intermediate.id}`, { status: "not_applicable" })).status, 400);
  r = await a("PATCH", `/api/items/${byKey.dmf1_intermediate.id}`, { status: "not_applicable", notes: "不適用原因：一步合成，無可分離中間體" });
  assert.equal(r.status, 200);
  assert.equal(r.data.items.find((i) => i.item_key === "dmf1_intermediate").risk_level, "low");

  // Items 1–6 done; of 7–11, two done, one N/A and two still open (「否」= 2, limit 2) → 續審.
  for (const k of ["dmf1_rtf_form", "dmf1_ctd_32s", "dmf1_language", "dmf1_single_spec", "dmf1_spec_coa", "dmf1_stability",
    "dmf1_process", "dmf1_starting_material"]) {
    r = await a("PATCH", `/api/items/${byKey[k].id}`, { status: "completed" });
  }
  assert.equal(r.data.rtf.verdict, "continue");
  assert.deepEqual(r.data.rtf.rules.map((x) => x.failures.length), [0, 2]);
  assert.equal(r.data.summary.not_applicable, 1);
  assert.equal(r.data.summary.completion_rate, 80);   // 8 of the 10 applicable items

  // A third「否」among 7–11 → 退件.
  r = await a("PATCH", `/api/items/${byKey.dmf1_process.id}`, { status: "blocked" });
  assert.equal(r.data.rtf.verdict, "refuse");
  assert.equal(r.data.rtf.rules[1].refused, true);
  r = await a("PATCH", `/api/items/${byKey.dmf1_process.id}`, { status: "completed" });
  assert.equal(r.data.rtf.verdict, "continue");

  // One gate item back to in progress → 退件.
  r = await a("PATCH", `/api/items/${byKey.dmf1_stability.id}`, { status: "in_progress" });
  assert.equal(r.data.rtf.verdict, "refuse");
  assert.deepEqual(r.data.rtf.rules[0].failures.map((f) => f.item_id), [byKey.dmf1_stability.id]);

  // Schemas without RTF rules carry no verdict.
  assert.equal((await a("GET", `/api/projects/${projectId}`)).data.rtf, null);
  assert.equal((await a("DELETE", `/api/projects/${pid}`)).status, 200);
});

await step("PMF template: 確效替代 replaces Form C-5 through 不適用", async () => {
  let r = await a("POST", "/api/projects", { name: "PMF 生物簡化", schema_type: "pmf_bio_simplified" });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.items.length, 26);
  assert.equal(r.data.rtf, null);
  const c5 = r.data.items.find((i) => i.item_key === "pmf_c5");
  const alt = r.data.items.find((i) => i.item_key === "val_alternative");
  assert.equal(alt.required, false);
  r = await a("PATCH", `/api/items/${c5.id}`, { status: "not_applicable", notes: "不適用原因：採確效替代" });
  assert.equal(r.status, 200);
  r = await a("PATCH", `/api/items/${alt.id}`, { status: "completed" });
  assert.equal(r.data.summary.not_applicable, 1);
  assert.equal(r.data.summary.completed, 1);
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

function fileForm(name, content) {
  const form = new FormData();
  form.append("file", new Blob([content]), name);
  return form;
}

await step("attachments: upload, download, tenant isolation, delete", async () => {
  const cfg = (await a("GET", "/api/config")).data;
  assert.ok(cfg.attachments.extensions.includes("pdf") && cfg.attachments.max_bytes > 0);
  const name = "申請書 (v2).txt";
  const up = await a("POST", `/api/items/${items[0].id}/attachments`, fileForm(name, "附件內容 ABC"));
  assert.equal(up.status, 201, JSON.stringify(up.data));
  const att = up.data.items.find((i) => i.id === items[0].id).attachments;
  assert.equal(att.length, 1);
  assert.equal(att[0].filename, name);
  const id = att[0].id;

  const dl = await viewer("GET", `/api/attachments/${id}`);
  assert.equal(dl.status, 200);
  assert.equal(dl.text, "附件內容 ABC");
  assert.match(dl.headers.get("content-disposition"), /^attachment; .*filename\*=UTF-8''%E7%94%B3/);
  assert.match(dl.headers.get("content-security-policy"), /sandbox/);
  assert.equal(dl.headers.get("x-content-type-options"), "nosniff");

  assert.equal((await viewer("POST", `/api/items/${items[0].id}/attachments`, fileForm("x.pdf", "x"))).status, 403);
  assert.equal((await viewer("DELETE", `/api/attachments/${id}`)).status, 403);
  assert.equal((await b("GET", `/api/attachments/${id}`)).status, 404);
  assert.equal((await b("DELETE", `/api/attachments/${id}`)).status, 404);
  assert.equal((await b("POST", `/api/items/${items[0].id}/attachments`, fileForm("x.pdf", "x"))).status, 404);
  assert.equal((await a("POST", `/api/items/${items[0].id}/attachments`, fileForm("page.html", "<script>1</script>"))).status, 400);
  assert.equal((await a("POST", `/api/items/${items[0].id}/attachments`, fileForm("empty.pdf", ""))).status, 400);

  const del = await a("DELETE", `/api/attachments/${id}`);
  assert.equal(del.status, 200);
  assert.equal(del.data.items.find((i) => i.id === items[0].id).attachments.length, 0);
  assert.equal((await viewer("GET", `/api/attachments/${id}`)).status, 404);

  // Deleting a custom item removes its files too.
  const custom = (await a("POST", `/api/projects/${projectId}/items`, { item_name: `自訂附件項目 ${run}` })).data.items
    .find((i) => i.item_name === `自訂附件項目 ${run}`);
  const up2 = await a("POST", `/api/items/${custom.id}/attachments`, fileForm("memo.pdf", "%PDF-1.4"));
  const id2 = up2.data.items.find((i) => i.id === custom.id).attachments[0].id;
  assert.equal((await a("DELETE", `/api/items/${custom.id}`)).status, 200);
  assert.equal((await a("GET", `/api/attachments/${id2}`)).status, 404);
});

await step("eCTD: node and title per attachment, envelope per case", async () => {
  const up = await a("POST", `/api/items/${items[0].id}/attachments`, fileForm("form.pdf", "%PDF-1.7 x %%EOF"));
  const id = up.data.attachment_id;
  const p1 = await a("PATCH", `/api/attachments/${id}`, { ectd_node: "1.1.1", ectd_title: "藥品查驗登記申請書" });
  assert.equal(p1.status, 200, JSON.stringify(p1.data));
  assert.deepEqual([p1.data.ectd_node, p1.data.ectd_title], ["1.1.1", "藥品查驗登記申請書"]);
  assert.equal((await a("PATCH", `/api/attachments/${id}`, { ectd_node: "../etc" })).status, 400);
  assert.equal((await viewer("PATCH", `/api/attachments/${id}`, { ectd_node: "1.1.4" })).status, 403);
  assert.equal((await b("PATCH", `/api/attachments/${id}`, { ectd_node: "1.1.4" })).status, 404);
  // Clearing the node keeps the title.
  const p2 = await a("PATCH", `/api/attachments/${id}`, { ectd_node: "" });
  assert.deepEqual([p2.data.ectd_node, p2.data.ectd_title], [null, "藥品查驗登記申請書"]);

  const ectd = { envelope: { identifier: "550e8400-e29b-41d4-a716-446655442895", sequence: "0000" }, product: { substance: "Examplin" } };
  const put = await a("PUT", `/api/projects/${projectId}/ectd`, { ectd });
  assert.equal(put.status, 200, JSON.stringify(put.data));
  const detail = (await viewer("GET", `/api/projects/${projectId}`)).data;
  assert.deepEqual(detail.ectd, ectd);
  assert.equal(detail.items[0].attachments.find((x) => x.id === id).ectd_title, "藥品查驗登記申請書");
  assert.equal((await a("PUT", `/api/projects/${projectId}/ectd`, { ectd: [1] })).status, 400);
  assert.equal((await a("PUT", `/api/projects/${projectId}/ectd`, { ectd: { x: "y".repeat(40000) } })).status, 413);
  assert.equal((await viewer("PUT", `/api/projects/${projectId}/ectd`, { ectd })).status, 403);
  assert.equal((await b("PUT", `/api/projects/${projectId}/ectd`, { ectd })).status, 404);
  await a("DELETE", `/api/attachments/${id}`);
});

await step("large files go up in parts; text and AI review per item; quota", async () => {
  const cfg = (await a("GET", "/api/config")).data.attachments;
  assert.equal(cfg.max_bytes, 500 * 1024 * 1024);
  const part = cfg.part_bytes;
  const itemId = items[2].id;

  // Start a two-part upload (one full part + 1 MiB).
  const size = part + 1024 * 1024;
  assert.equal((await viewer("POST", `/api/items/${itemId}/uploads`, { filename: "big.pdf", size })).status, 403);
  assert.equal((await a("POST", `/api/items/${itemId}/uploads`, { filename: "page.html", size })).status, 400);
  assert.equal((await a("POST", `/api/items/${itemId}/uploads`, { filename: "huge.pdf", size: 501 * 1024 * 1024 })).status, 413);
  const start = await a("POST", `/api/items/${itemId}/uploads`, { filename: "3.2.S.7 安定性 長期.pdf", size });
  assert.equal(start.status, 201, JSON.stringify(start.data));
  assert.equal(start.data.parts, 2);
  const uid = encodeURIComponent(start.data.upload_id);
  const bytes = new Uint8Array(size);
  bytes.set(new TextEncoder().encode("%PDF-1.7 big test"), 0);
  bytes[size - 1] = 0x42;
  // A part of the wrong size is refused; another company cannot touch the upload.
  const wrong = await fetch(`${BASE}/api/uploads/${uid}/parts/2`, { method: "PUT", body: bytes.subarray(0, 10), headers: { Cookie: await cookieOf(a) } });
  assert.equal(wrong.status, 400);
  assert.equal((await b("DELETE", `/api/uploads/${uid}`)).status, 404);
  const etags = [];
  for (const [n, from, to] of [[1, 0, part], [2, part, size]]) {
    const r = await fetch(`${BASE}/api/uploads/${uid}/parts/${n}`, { method: "PUT", body: bytes.subarray(from, to), headers: { Cookie: await cookieOf(a) } });
    const body = await r.text();
    assert.equal(r.status, 200, body);
    etags.push({ part_number: n, etag: JSON.parse(body).etag });
  }
  assert.equal((await a("POST", `/api/uploads/${uid}/complete`, { parts: etags.slice(0, 1) })).status, 400);
  const done = await a("POST", `/api/uploads/${uid}/complete`, { parts: etags });
  assert.equal(done.status, 201, JSON.stringify(done.data));
  const bigId = done.data.attachment_id;
  const it = done.data.items.find((i) => i.id === itemId);
  assert.equal(it.attachments.find((x) => x.id === bigId).size_bytes, size);
  assert.ok(done.data.project.storage.used_bytes >= size);
  const dl = await fetch(`${BASE}/api/attachments/${bigId}`, { headers: { Cookie: await cookieOf(a) } });
  assert.equal(Number(dl.headers.get("content-length")), size);
  await dl.body.cancel();

  // Over the case quota (CASE_QUOTA_GB in .dev.vars is set small for this test).
  assert.equal((await a("POST", `/api/items/${itemId}/uploads`, { filename: "more.pdf", size: 40 * 1024 * 1024 })).status, 413);

  // Extracted text, then an AI review that reads it.
  assert.equal((await viewer("PUT", `/api/attachments/${bigId}/text`, { status: "ok", text: "x" })).status, 403);
  assert.equal((await a("PUT", `/api/attachments/${bigId}/text`, { status: "bogus" })).status, 400);
  const t = await a("PUT", `/api/attachments/${bigId}/text`, { status: "ok", text: "長期試驗 25°C/60% RH：0、3 個月。" });
  assert.equal(t.status, 200);
  assert.equal((await viewer("POST", `/api/items/${itemId}/review`)).status, 403);
  const rv = await a("POST", `/api/items/${itemId}/review`);
  assert.equal(rv.status, 200, JSON.stringify(rv.data));
  if (process.env.MOCK_OLLAMA_URL) {
    assert.equal(rv.data.review.verdict, "insufficient");
    assert.equal(rv.data.review.findings[0].status, "not_met");
    const sent = await (await fetch(`${process.env.MOCK_OLLAMA_URL}/__last`)).json();
    const userMsg = sent.body.messages.find((m) => m.role === "user").content;
    assert.ok(userMsg.includes("長期試驗 25°C/60% RH") && userMsg.includes("## 審查門檻"));
  }
  const detail = (await a("GET", `/api/projects/${projectId}`)).data.items.find((i) => i.id === itemId);
  assert.equal(detail.review.fingerprint, detail.files_fingerprint);

  // An item with no files is "missing"; files without text are "unreadable" (no model call).
  const empty = await a("POST", `/api/items/${items[3].id}/review`);
  assert.equal(empty.data.review.verdict, "missing");
  const scanned = await a("POST", `/api/items/${items[3].id}/attachments`, fileForm("scan.pdf", "%PDF-1.4"));
  await a("PUT", `/api/attachments/${scanned.data.attachment_id}/text`, { status: "scanned" });
  assert.equal((await a("POST", `/api/items/${items[3].id}/review`)).data.review.verdict, "unreadable");

  // Abort frees the reservation.
  const s2 = await a("POST", `/api/items/${items[4].id}/uploads`, { filename: "x.pdf", size: 1024 });
  assert.equal((await a("DELETE", `/api/uploads/${encodeURIComponent(s2.data.upload_id)}`)).status, 200);
  assert.equal((await a("DELETE", `/api/attachments/${bigId}`)).status, 200);
});

await step("deactivating a user kills their session", async () => {
  const users = (await a("GET", "/api/users")).data.users;
  const v = users.find((u) => u.role === "viewer");
  await a("PATCH", `/api/users/${v.id}`, { is_active: false });
  assert.equal((await viewer("GET", "/api/projects")).status, 401);
  const self = users.find((u) => u.email === emailA);
  assert.equal((await a("PATCH", `/api/users/${self.id}`, { role: "viewer" })).status, 400);
});

await step("admin deletes a member; their edits stay", async () => {
  const member = client();
  const email = `member-${run}@a.test`;
  assert.equal((await a("POST", "/api/users", { full_name: "將刪除", email, password: "password-789", role: "member" })).status, 200);
  assert.equal((await member("POST", "/api/auth/login", { email, password: "password-789" })).status, 200);
  assert.equal((await member("PATCH", `/api/items/${items[1].id}`, { status: "in_progress" })).status, 200);
  const users = (await a("GET", "/api/users")).data.users;
  const m = users.find((u) => u.email === email);
  const self = users.find((u) => u.email === emailA);
  assert.equal((await a("DELETE", `/api/users/${self.id}`)).status, 400);
  assert.equal((await member("DELETE", `/api/users/${self.id}`)).status, 403);
  assert.equal((await b("DELETE", `/api/users/${m.id}`)).status, 404);
  const r = await a("DELETE", `/api/users/${m.id}`);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(!r.data.users.some((u) => u.email === email));
  assert.equal((await member("GET", "/api/projects")).status, 401);
  const item = (await a("GET", `/api/projects/${projectId}`)).data.items.find((i) => i.id === items[1].id);
  assert.equal(item.status, "in_progress");
  assert.equal((await a("DELETE", `/api/users/${m.id}`)).status, 404);
  assert.equal((await a("POST", "/api/users", { full_name: "重新建立", email, password: "password-789" })).status, 200);
});

await step("only admin can delete a project", async () => {
  assert.equal((await a("DELETE", `/api/projects/${projectId}`)).status, 200);
  assert.equal((await a("GET", `/api/projects/${projectId}`)).status, 404);
});

await step("AI endpoint: validation and missing-key handling", async () => {
  const cfg = (await a("GET", "/api/config")).data;
  const r = await a("POST", "/api/ai/analyze", { schema_type: "food_registration", filename: "a.txt", text: "產品配方" });
  if (!cfg.ai_enabled) {
    assert.equal(r.status, 503);
  } else {
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.completeness_score, 62);
    assert.equal(r.data.gaps.length, 2);
    assert.deepEqual(r.data.compliant_items, ["item1", "item2"]);
    assert.equal(r.data.token_usage.input_tokens, 12000);
  }
  // PDFs are converted to text in the browser; a request without text is rejected.
  assert.equal((await a("POST", "/api/ai/analyze", { schema_type: "food_registration", filename: "a.pdf", pdf_base64: "JVBERi0=" })).status, cfg.ai_enabled ? 400 : 503);
});

// Needs the mock Ollama server (test/mock-ollama.mjs); skipped against a real deployment.
const mockUrl = process.env.MOCK_OLLAMA_URL;
if (mockUrl) {
  await step("AI request goes to Ollama /api/chat with a bearer key and the checklist", async () => {
    const r = await a("POST", "/api/ai/analyze", { schema_type: "new_drug_registration", filename: "nda.txt", text: "3.2.S.4.1 規格" });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const last = await (await fetch(`${mockUrl}/__last`)).json();
    assert.equal(last.url, "/api/chat");
    assert.equal(last.headers.authorization, "Bearer test-key");
    assert.equal(last.headers["x-api-key"], undefined);
    assert.equal(last.body.stream, true);
    const [system, user] = last.body.messages;
    assert.equal(system.role, "system");
    assert.match(user.content, /<document filename="nda.txt">/);
    assert.ok((user.content.match(/審查門檻：/g) ?? []).length > 100);
    assert.match(user.content, /"completeness_score"/);
  });
}

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
