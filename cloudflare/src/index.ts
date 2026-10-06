/**
 * RegReview API — Cloudflare Worker.
 *
 * Static front-end files in public/ are served by Workers Static Assets; only /api/*
 * reaches this code (see wrangler.jsonc → assets.run_worker_first).
 */

import {
  clearSessionCookie, hashIterations, hashPassword, MAX_PBKDF2_ITERATIONS, MIN_PBKDF2_ITERATIONS, hashToken, newSessionToken, normalizeEmail,
  readSessionCookie, sessionCookie, slugify, validatePassword, verifyPassword,
} from "./auth";
import { AnalysisError, analyzeDocument, MAX_TEXT_CHARS, reviewItem, type AiConfig } from "./ai";
import { actionItems, rtfVerdict, summarize, todayTaipei, type ItemRow, type ProjectRow } from "./report";
import {
  ATTACHMENT_TYPES, DEFAULT_CASE_QUOTA_GB, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_ITEM, MAX_STORED_TEXT_CHARS,
  SINGLE_UPLOAD_MAX_BYTES, TEXT_STATUSES, UPLOAD_PART_BYTES, cleanFilename, contentDisposition, extensionOf,
} from "./attachments";
import {
  findTemplateItem, isSchemaType, ITEM_STATUSES, RISK_LEVELS, riskFor, SCHEMAS,
  type ItemStatus, type RiskLevel,
} from "./schemas";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** R2 bucket holding files attached to checklist items. */
  FILES: R2Bucket;
  /** Storage allowed per case, in GB (default 20). */
  CASE_QUOTA_GB?: string;
  /** Secret: Ollama API key (https://ollama.com/settings/keys). AI analysis is off without it. */
  OLLAMA_API_KEY?: string;
  /** Ollama API base URL; defaults to Ollama's cloud (https://ollama.com). */
  AI_BASE_URL?: string;
  /** Ollama cloud model name, as listed by https://ollama.com/api/tags. */
  AI_MODEL?: string;
  ALLOW_REGISTRATION?: string;
  SESSION_TTL_HOURS?: string;
  /** PBKDF2 iterations for new password hashes (10 000–100 000). See README for the CPU trade-off. */
  PBKDF2_ITERATIONS?: string;
}

interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: "admin" | "member" | "viewer";
  company_id: number;
  company_name: string;
  company_slug: string;
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const MAX_JSON_BYTES = 64 * 1024;
const MAX_AI_BYTES = MAX_TEXT_CHARS * 4 + 64 * 1024; // UTF-8 (≤4 bytes/char) + envelope
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_MAX_FAILURES = 10;

// ── Response helpers ─────────────────────────────────────────────────────────

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

async function readJson<T = Record<string, unknown>>(request: Request, maxBytes = MAX_JSON_BYTES): Promise<T> {
  const type = request.headers.get("Content-Type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Content-Type 必須為 application/json。");
  }
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > maxBytes) throw new HttpError(413, "請求內容過大。");
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "請求內容過大。");
  try {
    const value = JSON.parse(text);
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as T;
  } catch {
    throw new HttpError(400, "JSON 格式錯誤。");
  }
}

function str(value: unknown, field: string, { max = 500, required = true } = {}): string {
  if (value === undefined || value === null || value === "") {
    if (required) throw new HttpError(400, `缺少欄位：${field}`);
    return "";
  }
  if (typeof value !== "string") throw new HttpError(400, `欄位格式錯誤：${field}`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new HttpError(400, `缺少欄位：${field}`);
  if (trimmed.length > max) throw new HttpError(400, `${field} 超過 ${max} 字元上限。`);
  return trimmed;
}

function optionalDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, `${field} 必須為 YYYY-MM-DD 格式。`);
  }
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new HttpError(400, `${field} 必須為 ${allowed.join(" / ")} 之一。`);
  }
  return value as T;
}

function idParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(404, "找不到資源。");
  return id;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── Auth / session ───────────────────────────────────────────────────────────

let dummyHash: Promise<string> | null = null;

function iterations(env: Env): number {
  const n = Number(env.PBKDF2_ITERATIONS ?? MAX_PBKDF2_ITERATIONS);
  if (!Number.isFinite(n)) return MAX_PBKDF2_ITERATIONS;
  return Math.min(MAX_PBKDF2_ITERATIONS, Math.max(MIN_PBKDF2_ITERATIONS, Math.round(n)));
}

async function currentUser(request: Request, env: Env): Promise<AuthUser | null> {
  const token = readSessionCookie(request);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.full_name, u.role, u.company_id,
            c.name AS company_name, c.slug AS company_slug
       FROM session s
       JOIN user u    ON u.id = s.user_id
       JOIN company c ON c.id = u.company_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1 AND c.is_active = 1`,
  ).bind(await hashToken(token), nowIso()).first<AuthUser>();
  return row ?? null;
}

function requireRole(user: AuthUser, ...roles: AuthUser["role"][]) {
  if (!roles.includes(user.role)) throw new HttpError(403, "您的角色沒有此操作權限。");
}

async function startSession(env: Env, request: Request, userId: number): Promise<string> {
  const ttlHours = Math.max(1, Number(env.SESSION_TTL_HOURS ?? "168") || 168);
  const token = newSessionToken();
  const expires = new Date(Date.now() + ttlHours * 3600_000).toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM session WHERE user_id = ? AND expires_at <= ?").bind(userId, nowIso()),
    env.DB.prepare("INSERT INTO session (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(await hashToken(token), userId, expires),
    env.DB.prepare("UPDATE user SET last_login = ? WHERE id = ?").bind(nowIso(), userId),
  ]);
  return sessionCookie(token, ttlHours * 3600, new URL(request.url).protocol === "https:");
}

async function uniqueSlug(env: Env, base: string, table: "company" | "project", companyId?: number): Promise<string> {
  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? base : `${base.slice(0, 95)}-${n}`;
    const exists = table === "company"
      ? await env.DB.prepare("SELECT 1 FROM company WHERE slug = ?").bind(candidate).first()
      : await env.DB.prepare("SELECT 1 FROM project WHERE company_id = ? AND slug = ?").bind(companyId, candidate).first();
    if (!exists) return candidate;
  }
  throw new HttpError(409, "名稱重複過多，請換一個名稱。");
}

async function register(request: Request, env: Env): Promise<Response> {
  if ((env.ALLOW_REGISTRATION ?? "true") !== "true") throw new HttpError(403, "此站台未開放自行註冊，請聯絡管理員。");
  const body = await readJson(request);
  const companyName = str(body.company_name, "公司名稱", { max: 200 });
  const fullName = str(body.full_name, "姓名", { max: 200 });
  const email = normalizeEmail(body.email);
  if (!email) throw new HttpError(400, "電子郵件格式不正確。");
  const pwError = validatePassword(body.password);
  if (pwError) throw new HttpError(400, pwError);

  if (await env.DB.prepare("SELECT 1 FROM user WHERE email = ?").bind(email).first()) {
    throw new HttpError(409, "此電子郵件已註冊。");
  }
  const slug = await uniqueSlug(env, slugify(companyName, "company"), "company");
  const passwordHash = await hashPassword(body.password as string, iterations(env));

  // One batch = one transaction, so a failed user insert never leaves an orphan company.
  let userId: number;
  try {
    const [, inserted] = await env.DB.batch<{ id: number }>([
      env.DB.prepare("INSERT INTO company (name, slug) VALUES (?, ?)").bind(companyName, slug),
      env.DB.prepare(
        `INSERT INTO user (company_id, email, password_hash, full_name, role)
         VALUES ((SELECT id FROM company WHERE slug = ?), ?, ?, ?, 'admin') RETURNING id`,
      ).bind(slug, email, passwordHash, fullName),
    ]);
    userId = inserted.results[0].id;
  } catch (err) {
    if (String(err).includes("UNIQUE")) throw new HttpError(409, "此電子郵件或公司名稱已註冊，請重試。");
    throw err;
  }

  const cookie = await startSession(env, request, userId);
  return json({ ok: true }, 201, { "Set-Cookie": cookie });
}

async function login(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) throw new HttpError(400, "請輸入電子郵件與密碼。");

  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000).toISOString();
  const failures = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_attempt WHERE email = ? AND created_at > ?")
    .bind(email, since).first<{ n: number }>();
  if ((failures?.n ?? 0) >= LOGIN_MAX_FAILURES) {
    throw new HttpError(429, `登入失敗次數過多，請 ${LOGIN_WINDOW_MINUTES} 分鐘後再試。`);
  }

  const user = await env.DB.prepare(
    `SELECT u.id, u.password_hash FROM user u JOIN company c ON c.id = u.company_id
      WHERE u.email = ? AND u.is_active = 1 AND c.is_active = 1`,
  ).bind(email).first<{ id: number; password_hash: string }>();

  // Hash even for unknown emails so response time doesn't reveal which emails exist.
  dummyHash ??= hashPassword("not-a-real-password", iterations(env));
  const ok = await verifyPassword(password, user?.password_hash ?? (await dummyHash));
  if (!user || !ok) {
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO login_attempt (email, ip, created_at) VALUES (?, ?, ?)")
        .bind(email, request.headers.get("CF-Connecting-IP"), nowIso()),
      env.DB.prepare("DELETE FROM login_attempt WHERE created_at < ?").bind(dayAgo),
    ]);
    throw new HttpError(401, "電子郵件或密碼錯誤。");
  }

  await env.DB.prepare("DELETE FROM login_attempt WHERE email = ?").bind(email).run();
  // Re-hash when PBKDF2_ITERATIONS changed (e.g. raised after moving to the Paid plan).
  if (hashIterations(user.password_hash) !== iterations(env)) {
    await env.DB.prepare("UPDATE user SET password_hash = ? WHERE id = ?")
      .bind(await hashPassword(password, iterations(env)), user.id).run();
  }
  const cookie = await startSession(env, request, user.id);
  return json({ ok: true }, 200, { "Set-Cookie": cookie });
}

async function logout(request: Request, env: Env): Promise<Response> {
  const token = readSessionCookie(request);
  if (token) await env.DB.prepare("DELETE FROM session WHERE token_hash = ?").bind(await hashToken(token)).run();
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(new URL(request.url).protocol === "https:") });
}

async function changePassword(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = await readJson(request);
  const row = await env.DB.prepare("SELECT password_hash FROM user WHERE id = ?").bind(user.id).first<{ password_hash: string }>();
  if (!row || !(await verifyPassword(String(body.current_password ?? ""), row.password_hash))) {
    throw new HttpError(400, "目前密碼不正確。");
  }
  const pwError = validatePassword(body.new_password);
  if (pwError) throw new HttpError(400, pwError);
  const token = readSessionCookie(request)!;
  await env.DB.batch([
    env.DB.prepare("UPDATE user SET password_hash = ? WHERE id = ?").bind(await hashPassword(body.new_password as string, iterations(env)), user.id),
    // Sign out every other device.
    env.DB.prepare("DELETE FROM session WHERE user_id = ? AND token_hash != ?").bind(user.id, await hashToken(token)),
  ]);
  return json({ ok: true });
}

// ── Projects ─────────────────────────────────────────────────────────────────

async function getProject(env: Env, user: AuthUser, id: number): Promise<ProjectRow> {
  const project = await env.DB.prepare(
    `SELECT id, name, slug, schema_type, deadline, description, status, created_at, updated_at
       FROM project WHERE id = ? AND company_id = ?`,
  ).bind(id, user.company_id).first<ProjectRow>();
  if (!project) throw new HttpError(404, "找不到此專案。");
  return project;
}

async function projectItems(env: Env, projectId: number): Promise<ItemRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, item_key, item_name, category, required, status, risk_level, notes, sort_order, updated_at
       FROM checklist_item WHERE project_id = ? ORDER BY sort_order, id`,
  ).bind(projectId).all<ItemRow>();
  return results;
}

function decorateItems(schemaType: string, items: ItemRow[]) {
  return items.map((i) => {
    const tpl = findTemplateItem(schemaType, i.item_key);
    return {
      ...i, required: Boolean(i.required), auto_risk: Boolean(tpl),
      action: tpl?.action_zh ?? null, criteria: tpl?.criteria ?? [],
    };
  });
}

interface AttachmentInfo {
  id: number; item_id: number; filename: string; size_bytes: number; created_at: string; uploaded_by_name: string | null;
  text_status: string; text_chars: number;
}

/**
 * Whole-case AI review covers Module 1, Module 3, DMF and PMF items. Module 4/5 and the
 * new-drug-type items stay out of the default run (they can still be reviewed one by one).
 */
const AI_REVIEW_SKIP_CATEGORIES = new Set(["module4_nonclinical", "module5_clinical", "nda_type"]);

/** Identifies the set of files (and their extracted text) an item was reviewed with. */
function filesFingerprint(files: Pick<AttachmentInfo, "id" | "text_status" | "text_chars">[]): string {
  const raw = files.map((f) => `${f.id}:${f.text_status}:${f.text_chars}`).sort().join("|");
  let h = 0x811c9dc5; // FNV-1a, enough to tell "same files" from "changed files"
  for (let i = 0; i < raw.length; i++) h = Math.imul(h ^ raw.charCodeAt(i), 0x01000193);
  return `${files.length}-${(h >>> 0).toString(16)}`;
}

interface ReviewRow {
  item_id: number; verdict: string; summary: string; findings: string; fixes: string;
  fingerprint: string; model: string | null; reviewed_at: string;
}

async function projectReviews(env: Env, projectId: number): Promise<Map<number, ReviewRow>> {
  const { results } = await env.DB.prepare(
    "SELECT item_id, verdict, summary, findings, fixes, fingerprint, model, reviewed_at FROM item_review WHERE project_id = ?",
  ).bind(projectId).all<ReviewRow>();
  return new Map(results.map((r) => [r.item_id, r]));
}

function reviewJson(r: ReviewRow | undefined) {
  if (!r) return null;
  return {
    verdict: r.verdict, summary: r.summary, findings: JSON.parse(r.findings), fixes: JSON.parse(r.fixes),
    fingerprint: r.fingerprint, model: r.model, reviewed_at: r.reviewed_at,
  };
}

async function projectAttachments(env: Env, projectId: number): Promise<Map<number, AttachmentInfo[]>> {
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.item_id, a.filename, a.size_bytes, a.created_at, u.full_name AS uploaded_by_name,
            a.text_status, a.text_chars
       FROM attachment a LEFT JOIN user u ON u.id = a.uploaded_by
      WHERE a.project_id = ? ORDER BY a.created_at, a.id`,
  ).bind(projectId).all<AttachmentInfo>();
  const byItem = new Map<number, AttachmentInfo[]>();
  for (const a of results) {
    const list = byItem.get(a.item_id) ?? [];
    list.push(a);
    byItem.set(a.item_id, list);
  }
  return byItem;
}

async function projectDetail(env: Env, project: ProjectRow) {
  const [items, files, reviews, used] = await Promise.all([
    projectItems(env, project.id), projectAttachments(env, project.id), projectReviews(env, project.id),
    caseUsageBytes(env, project.id),
  ]);
  return {
    project: {
      ...project, schema_name: SCHEMAS[project.schema_type]?.display_name_zh ?? project.schema_type,
      storage: { used_bytes: used, quota_bytes: caseQuotaBytes(env) },
    },
    items: decorateItems(project.schema_type, items).map((i) => {
      const attachments = files.get(i.id) ?? [];
      return {
        ...i, attachments,
        files_fingerprint: filesFingerprint(attachments),
        ai_scope: !AI_REVIEW_SKIP_CATEGORIES.has(i.category ?? ""),
        review: reviewJson(reviews.get(i.id)),
      };
    }),
    summary: summarize(items, project.deadline, undefined, project.status === "active"),
    action_items: actionItems(project.schema_type, items),
    rtf: rtfVerdict(project.schema_type, items),
  };
}

async function listProjects(url: URL, env: Env, user: AuthUser): Promise<Response> {
  const includeArchived = url.searchParams.get("include_archived") === "1";
  const { results: projects } = await env.DB.prepare(
    `SELECT id, name, slug, schema_type, deadline, description, status, created_at, updated_at
       FROM project WHERE company_id = ? ${includeArchived ? "" : "AND status != 'archived'"}
      ORDER BY (deadline IS NULL), deadline, name`,
  ).bind(user.company_id).all<ProjectRow>();
  const { results: items } = await env.DB.prepare(
    `SELECT ci.id, ci.project_id, ci.item_key, ci.item_name, ci.category, ci.required, ci.status,
            ci.risk_level, ci.notes, ci.sort_order, ci.updated_at
       FROM checklist_item ci JOIN project p ON p.id = ci.project_id
      WHERE p.company_id = ?`,
  ).bind(user.company_id).all<ItemRow & { project_id: number }>();

  const byProject = new Map<number, ItemRow[]>();
  for (const i of items) {
    const list = byProject.get(i.project_id) ?? [];
    list.push(i);
    byProject.set(i.project_id, list);
  }
  const today = todayTaipei();
  return json({
    today,
    projects: projects.map((p) => ({
      ...p,
      schema_name: SCHEMAS[p.schema_type]?.display_name_zh ?? p.schema_type,
      summary: summarize(byProject.get(p.id) ?? [], p.deadline, today, p.status === "active"),
    })),
  });
}

async function insertTemplateItems(env: Env, projectId: number, schemaType: string, userId: number,
  overrides: Record<string, { status: ItemStatus; notes?: string }> = {}) {
  const stmts = SCHEMAS[schemaType].items.map((tpl, idx) => {
    const status = overrides[tpl.key]?.status ?? "pending";
    return env.DB.prepare(
      `INSERT INTO checklist_item (project_id, item_key, item_name, category, required, status, risk_level, notes, sort_order, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(projectId, tpl.key, tpl.label, tpl.category, tpl.required ? 1 : 0, status,
      riskFor(tpl.risk_rules, status), overrides[tpl.key]?.notes ?? null, idx + 1, userId);
  });
  if (stmts.length) await env.DB.batch(stmts);
}

async function createProjectRow(env: Env, user: AuthUser, name: string, schemaType: string,
  deadline: string | null, description: string | null): Promise<number> {
  const slug = await uniqueSlug(env, slugify(name, "project"), "project", user.company_id);
  const row = await env.DB.prepare(
    `INSERT INTO project (company_id, created_by, name, slug, schema_type, deadline, description)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  ).bind(user.company_id, user.id, name, slug, schemaType, deadline, description).first<{ id: number }>();
  return row!.id;
}

async function createProject(request: Request, env: Env, user: AuthUser): Promise<Response> {
  requireRole(user, "admin", "member");
  const body = await readJson(request);
  const name = str(body.name, "專案名稱", { max: 200 });
  if (!isSchemaType(body.schema_type)) throw new HttpError(400, "不支援的申請類型。");
  const schemaType = body.schema_type;
  const deadline = optionalDate(body.deadline, "截止日期")
    ?? addDays(todayTaipei(), SCHEMAS[schemaType].deadline_default_days);
  const description = str(body.description, "說明", { max: 2000, required: false }) || null;

  const id = await createProjectRow(env, user, name, schemaType, deadline, description);
  if (body.use_template !== false) await insertTemplateItems(env, id, schemaType, user.id);
  return json(await projectDetail(env, await getProject(env, user, id)), 201);
}

async function createDemoProjects(env: Env, user: AuthUser): Promise<Response> {
  requireRole(user, "admin", "member");
  const today = todayTaipei();
  const drugId = await createProjectRow(env, user, "示範－藥品許可證展延", "drug_registration_extension",
    addDays(today, 45), "系統示範資料，可自由修改或封存。");
  await insertTemplateItems(env, drugId, "drug_registration_extension", user.id, {
    item1: { status: "in_progress", notes: "申請書填寫中" },
    item2: { status: "completed", notes: "GMP 展延已完成" },
    item3: { status: "under_review", notes: "TFDA 審查中" },
    item4: { status: "completed", notes: "附 QR code GMP 證書" },
    item5: { status: "blocked", notes: "QR code 驗證失敗，等待原廠回覆" },
    item6: { status: "completed", notes: "風險評估已核准" },
    item7: { status: "pending", notes: "等待所有文件就緒" },
  });
  const foodId = await createProjectRow(env, user, "示範－食品查驗登記", "food_registration",
    addDays(today, 120), "系統示範資料，可自由修改或封存。");
  await insertTemplateItems(env, foodId, "food_registration", user.id, {
    item1: { status: "completed", notes: "已完成登錄" },
    item2: { status: "in_progress", notes: "配方修訂中" },
    item3: { status: "pending", notes: "等待供應商文件" },
    item4: { status: "under_review", notes: "實驗室審查中" },
    item5: { status: "pending", notes: "尚未開始" },
  });
  return json({ ok: true, project_ids: [drugId, foodId] }, 201);
}

async function updateProject(request: Request, env: Env, user: AuthUser, id: number): Promise<Response> {
  requireRole(user, "admin", "member");
  const project = await getProject(env, user, id);
  const body = await readJson(request);
  const name = body.name !== undefined ? str(body.name, "專案名稱", { max: 200 }) : project.name;
  const deadline = body.deadline !== undefined ? optionalDate(body.deadline, "截止日期") : project.deadline;
  const description = body.description !== undefined
    ? str(body.description, "說明", { max: 2000, required: false }) || null
    : project.description;
  const status = body.status !== undefined
    ? oneOf(body.status, ["active", "archived", "completed"] as const, "狀態")
    : project.status;
  await env.DB.prepare(
    "UPDATE project SET name = ?, deadline = ?, description = ?, status = ?, updated_at = ? WHERE id = ? AND company_id = ?",
  ).bind(name, deadline, description, status, nowIso(), id, user.company_id).run();
  return json(await projectDetail(env, await getProject(env, user, id)));
}

async function deleteProject(env: Env, user: AuthUser, id: number): Promise<Response> {
  requireRole(user, "admin");
  await getProject(env, user, id);
  const keys = await attachmentKeys(env, "project_id", id);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM attachment WHERE project_id = ?").bind(id),
    env.DB.prepare("DELETE FROM item_review WHERE project_id = ?").bind(id),
    env.DB.prepare("DELETE FROM upload_session WHERE project_id = ?").bind(id),
    env.DB.prepare("DELETE FROM checklist_item WHERE project_id = ?").bind(id),
    env.DB.prepare("DELETE FROM project WHERE id = ? AND company_id = ?").bind(id, user.company_id),
  ]);
  await deleteObjects(env, keys);
  return json({ ok: true });
}

// ── Checklist items ──────────────────────────────────────────────────────────

/** RTF checklists ask for a reason next to every「不適用」; the reason lives in the notes. */
function requireReasonIfNotApplicable(status: ItemStatus, notes: string | null) {
  if (status === "not_applicable" && !notes?.trim()) throw new HttpError(400, "標記「不適用」時，請在備註寫明原因。");
}

async function createItem(request: Request, env: Env, user: AuthUser, projectId: number): Promise<Response> {
  requireRole(user, "admin", "member");
  const project = await getProject(env, user, projectId);
  const body = await readJson(request);
  const itemName = str(body.item_name, "項目名稱", { max: 500 });
  const category = str(body.category, "類別", { max: 100, required: false }) || "other";
  const status = body.status !== undefined ? oneOf(body.status, ITEM_STATUSES, "狀態") : "pending";
  const risk = body.risk_level !== undefined ? oneOf(body.risk_level, RISK_LEVELS, "風險等級") : "medium";
  const notes = str(body.notes, "備註", { max: 2000, required: false }) || null;
  requireReasonIfNotApplicable(status, notes);
  const order = await env.DB.prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM checklist_item WHERE project_id = ?")
    .bind(project.id).first<{ n: number }>();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO checklist_item (project_id, item_key, item_name, category, required, status, risk_level, notes, sort_order, updated_by)
       VALUES (?, NULL, ?, ?, 1, ?, ?, ?, ?, ?)`,
    ).bind(project.id, itemName, category, status, risk, notes, order?.n ?? 1, user.id),
    env.DB.prepare("UPDATE project SET updated_at = ? WHERE id = ?").bind(nowIso(), project.id),
  ]);
  return json(await projectDetail(env, project), 201);
}

async function itemWithProject(env: Env, user: AuthUser, itemId: number) {
  const row = await env.DB.prepare(
    `SELECT ci.id, ci.project_id, ci.item_key, ci.item_name, ci.status, ci.risk_level, ci.notes, p.schema_type
       FROM checklist_item ci JOIN project p ON p.id = ci.project_id
      WHERE ci.id = ? AND p.company_id = ?`,
  ).bind(itemId, user.company_id).first<{
    id: number; project_id: number; item_key: string | null; item_name: string; status: ItemStatus;
    risk_level: RiskLevel; notes: string | null; schema_type: string;
  }>();
  if (!row) throw new HttpError(404, "找不到此檢查項目。");
  return row;
}

async function updateItem(request: Request, env: Env, user: AuthUser, itemId: number): Promise<Response> {
  requireRole(user, "admin", "member");
  const item = await itemWithProject(env, user, itemId);
  const body = await readJson(request);
  const tpl = findTemplateItem(item.schema_type, item.item_key);

  const status = body.status !== undefined ? oneOf(body.status, ITEM_STATUSES, "狀態") : item.status;
  const notes = body.notes !== undefined ? str(body.notes, "備註", { max: 2000, required: false }) || null : item.notes;
  requireReasonIfNotApplicable(status, notes);
  // Template items name/risk come from the TFDA schema; only custom items are free-form.
  const itemName = !tpl && body.item_name !== undefined ? str(body.item_name, "項目名稱", { max: 500 }) : item.item_name;
  const risk: RiskLevel = tpl
    ? riskFor(tpl.risk_rules, status)
    : body.risk_level !== undefined ? oneOf(body.risk_level, RISK_LEVELS, "風險等級") : item.risk_level;

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE checklist_item SET item_name = ?, status = ?, risk_level = ?, notes = ?, updated_at = ?, updated_by = ? WHERE id = ?",
    ).bind(itemName, status, risk, notes, nowIso(), user.id, item.id),
    env.DB.prepare("UPDATE project SET updated_at = ? WHERE id = ?").bind(nowIso(), item.project_id),
  ]);
  return json(await projectDetail(env, await getProject(env, user, item.project_id)));
}

async function deleteItem(env: Env, user: AuthUser, itemId: number): Promise<Response> {
  requireRole(user, "admin", "member");
  const item = await itemWithProject(env, user, itemId);
  const keys = await attachmentKeys(env, "item_id", item.id);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM attachment WHERE item_id = ?").bind(item.id),
    env.DB.prepare("DELETE FROM item_review WHERE item_id = ?").bind(item.id),
    env.DB.prepare("DELETE FROM upload_session WHERE item_id = ?").bind(item.id),
    env.DB.prepare("DELETE FROM checklist_item WHERE id = ?").bind(item.id),
  ]);
  await deleteObjects(env, keys);
  return json(await projectDetail(env, await getProject(env, user, item.project_id)));
}

// ── Attachments (files on checklist items, stored in R2) ─────────────────────

async function attachmentKeys(env: Env, column: "item_id" | "project_id", id: number): Promise<string[]> {
  const { results } = await env.DB.prepare(`SELECT r2_key FROM attachment WHERE ${column} = ?`).bind(id).all<{ r2_key: string }>();
  // Each file may have its extracted text stored next to it.
  return results.flatMap((r) => [r.r2_key, textKey(r.r2_key)]);
}

const textKey = (r2Key: string) => `${r2Key}.txt`;

/** Removes stored files after their rows are gone; a failure only leaves an orphan object, so it is logged, not raised. */
async function deleteObjects(env: Env, keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 1000) {
    try {
      await env.FILES.delete(keys.slice(i, i + 1000));
    } catch (err) {
      console.error("R2 delete failed", err);
    }
  }
}

async function attachmentRow(env: Env, user: AuthUser, id: number) {
  const row = await env.DB.prepare(
    "SELECT id, project_id, item_id, r2_key, filename, size_bytes FROM attachment WHERE id = ? AND company_id = ?",
  ).bind(id, user.company_id).first<{ id: number; project_id: number; item_id: number; r2_key: string; filename: string; size_bytes: number }>();
  if (!row) throw new HttpError(404, "找不到此附件。");
  return row;
}

function caseQuotaBytes(env: Env): number {
  const gb = Number(env.CASE_QUOTA_GB ?? DEFAULT_CASE_QUOTA_GB);
  return (Number.isFinite(gb) && gb > 0 ? gb : DEFAULT_CASE_QUOTA_GB) * 1024 ** 3;
}

/** Bytes a case uses: stored files plus uploads still in progress (R2 drops those after 7 days). */
async function caseUsageBytes(env: Env, projectId: number): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT (SELECT COALESCE(SUM(size_bytes), 0) FROM attachment WHERE project_id = ?1)
          + (SELECT COALESCE(SUM(size_bytes), 0) FROM upload_session
              WHERE project_id = ?1 AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days')) AS used`,
  ).bind(projectId).first<{ used: number }>();
  return row?.used ?? 0;
}

const UNSUPPORTED_TYPE = "不支援此檔案類型。可上傳 PDF、Word、Excel、PowerPoint、文字、CSV、XML、圖片（PNG／JPG／GIF／SVG）、ZIP 或 Outlook 郵件（.msg）。";

/** Checks shared by single and multipart uploads. Returns the cleaned name and served type. */
async function checkNewFile(env: Env, item: { id: number; project_id: number }, rawName: string, size: number) {
  const filename = cleanFilename(rawName);
  const contentType = ATTACHMENT_TYPES[extensionOf(filename)];
  if (!filename || !contentType) throw new HttpError(400, UNSUPPORTED_TYPE);
  if (!Number.isInteger(size) || size <= 0) throw new HttpError(400, "檔案是空的。");
  if (size > MAX_ATTACHMENT_BYTES) throw new HttpError(413, "單一檔案不得超過 500 MB（TFDA eCTD 驗證規則 O.13）。");
  const count = await env.DB.prepare(
    "SELECT (SELECT COUNT(*) FROM attachment WHERE item_id = ?1) + (SELECT COUNT(*) FROM upload_session WHERE item_id = ?1) AS n",
  ).bind(item.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_ATTACHMENTS_PER_ITEM) {
    throw new HttpError(400, `每個項目最多 ${MAX_ATTACHMENTS_PER_ITEM} 個附件，請先刪除不需要的檔案。`);
  }
  const quota = caseQuotaBytes(env);
  if ((await caseUsageBytes(env, item.project_id)) + size > quota) {
    throw new HttpError(413, `此案件的儲存空間（${Math.round(quota / 1024 ** 3)} GB）不足，請先刪除不需要的檔案，或請管理員調高上限。`);
  }
  return { filename, contentType };
}

async function insertAttachment(
  env: Env, user: AuthUser, item: { id: number; project_id: number },
  key: string, filename: string, contentType: string, size: number,
): Promise<number> {
  const row = await env.DB.prepare(
    `INSERT INTO attachment (company_id, project_id, item_id, r2_key, filename, content_type, size_bytes, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  ).bind(user.company_id, item.project_id, item.id, key, filename, contentType, size, user.id).first<{ id: number }>();
  return row!.id;
}

// The key carries no part of the filename, so a name can never steer where it is stored.
const newObjectKey = (user: AuthUser, item: { id: number; project_id: number }) =>
  `${user.company_id}/${item.project_id}/${item.id}/${crypto.randomUUID()}`;

async function uploadAttachment(request: Request, env: Env, user: AuthUser, itemId: number): Promise<Response> {
  requireRole(user, "admin", "member");
  const item = await itemWithProject(env, user, itemId);
  // Multipart overhead is small; reject clearly oversized requests before reading them.
  if (Number(request.headers.get("Content-Length") ?? "0") > SINGLE_UPLOAD_MAX_BYTES + 64 * 1024) {
    throw new HttpError(413, "超過 50 MB 的檔案請以分段方式上傳。");
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, "請以表單方式上傳檔案。");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") throw new HttpError(400, "請選擇要上傳的檔案。");
  if (file.size > SINGLE_UPLOAD_MAX_BYTES) throw new HttpError(413, "超過 50 MB 的檔案請以分段方式上傳。");
  const { filename, contentType } = await checkNewFile(env, item, file.name, file.size);

  const key = newObjectKey(user, item);
  await env.FILES.put(key, file, { httpMetadata: { contentType } });
  let id: number;
  try {
    id = await insertAttachment(env, user, item, key, filename, contentType, file.size);
  } catch (err) {
    await deleteObjects(env, [key]);
    throw err;
  }
  return json({ attachment_id: id, ...(await projectDetail(env, await getProject(env, user, item.project_id))) }, 201);
}

// ── Multipart uploads for large files (parts of UPLOAD_PART_BYTES through the Worker) ─

async function startUpload(request: Request, env: Env, user: AuthUser, itemId: number): Promise<Response> {
  requireRole(user, "admin", "member");
  const item = await itemWithProject(env, user, itemId);
  const body = await readJson(request);
  const size = Number(body.size);
  const { filename, contentType } = await checkNewFile(env, item, String(body.filename ?? ""), size);
  const key = newObjectKey(user, item);
  const mpu = await env.FILES.createMultipartUpload(key, { httpMetadata: { contentType } });
  await env.DB.prepare(
    `INSERT INTO upload_session (id, company_id, project_id, item_id, r2_key, filename, content_type, size_bytes, part_size, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(mpu.uploadId, user.company_id, item.project_id, item.id, key, filename, contentType, size, UPLOAD_PART_BYTES, user.id).run();
  return json({ upload_id: mpu.uploadId, part_size: UPLOAD_PART_BYTES, parts: Math.ceil(size / UPLOAD_PART_BYTES), filename }, 201);
}

async function uploadSession(env: Env, user: AuthUser, uploadId: string) {
  const row = await env.DB.prepare(
    "SELECT id, project_id, item_id, r2_key, filename, content_type, size_bytes, part_size FROM upload_session WHERE id = ? AND company_id = ?",
  ).bind(uploadId, user.company_id).first<{
    id: string; project_id: number; item_id: number; r2_key: string; filename: string;
    content_type: string; size_bytes: number; part_size: number;
  }>();
  if (!row) throw new HttpError(404, "找不到此上傳作業，可能已完成、已取消或超過 7 天。");
  return row;
}

async function uploadPart(request: Request, env: Env, user: AuthUser, uploadId: string, partNumber: number): Promise<Response> {
  requireRole(user, "admin", "member");
  const s = await uploadSession(env, user, uploadId);
  const parts = Math.ceil(s.size_bytes / s.part_size);
  if (partNumber < 1 || partNumber > parts) throw new HttpError(400, "分段編號不正確。");
  // R2 requires every part except the last to be the same size.
  const expected = partNumber < parts ? s.part_size : s.size_bytes - s.part_size * (parts - 1);
  const length = Number(request.headers.get("Content-Length") ?? "-1");
  if (length !== expected || !request.body) throw new HttpError(400, `第 ${partNumber} 段大小應為 ${expected} bytes。`);
  const part = await env.FILES.resumeMultipartUpload(s.r2_key, s.id).uploadPart(partNumber, request.body);
  return json({ part_number: part.partNumber, etag: part.etag });
}

async function completeUpload(request: Request, env: Env, user: AuthUser, uploadId: string): Promise<Response> {
  requireRole(user, "admin", "member");
  const s = await uploadSession(env, user, uploadId);
  const body = await readJson(request);
  const parts = Array.isArray(body.parts) ? body.parts : [];
  const uploaded = parts.map((p: { part_number?: unknown; etag?: unknown }) => ({ partNumber: Number(p.part_number), etag: String(p.etag ?? "") }))
    .sort((a: R2UploadedPart, b: R2UploadedPart) => a.partNumber - b.partNumber);
  if (uploaded.length !== Math.ceil(s.size_bytes / s.part_size) || uploaded.some((p: R2UploadedPart, i: number) => p.partNumber !== i + 1 || !p.etag)) {
    throw new HttpError(400, "分段資料不完整，請重新上傳缺少的分段。");
  }
  const object = await env.FILES.resumeMultipartUpload(s.r2_key, s.id).complete(uploaded);
  if (object.size !== s.size_bytes) {
    await deleteObjects(env, [s.r2_key]);
    await env.DB.prepare("DELETE FROM upload_session WHERE id = ?").bind(s.id).run();
    throw new HttpError(400, "上傳完成後的檔案大小與原檔不符，請重新上傳。");
  }
  const item = { id: s.item_id, project_id: s.project_id };
  const [, inserted] = await env.DB.batch([
    env.DB.prepare("DELETE FROM upload_session WHERE id = ?").bind(s.id),
    env.DB.prepare(
      `INSERT INTO attachment (company_id, project_id, item_id, r2_key, filename, content_type, size_bytes, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    ).bind(user.company_id, item.project_id, item.id, s.r2_key, s.filename, s.content_type, s.size_bytes, user.id),
  ]);
  const id = (inserted.results[0] as { id: number }).id;
  return json({ attachment_id: id, ...(await projectDetail(env, await getProject(env, user, s.project_id))) }, 201);
}

async function abortUpload(env: Env, user: AuthUser, uploadId: string): Promise<Response> {
  requireRole(user, "admin", "member");
  const s = await uploadSession(env, user, uploadId);
  try {
    await env.FILES.resumeMultipartUpload(s.r2_key, s.id).abort();
  } catch (err) {
    console.error("R2 abort failed", err); // R2 drops it after 7 days anyway
  }
  await env.DB.prepare("DELETE FROM upload_session WHERE id = ?").bind(s.id).run();
  return json({ ok: true });
}

/** Stores the text the browser extracted from a file, for AI review. */
async function putAttachmentText(request: Request, env: Env, user: AuthUser, id: number): Promise<Response> {
  requireRole(user, "admin", "member");
  const row = await attachmentRow(env, user, id);
  const body = await readJson(request, 4 * MAX_STORED_TEXT_CHARS + 4096);
  const status = oneOf(body.status, TEXT_STATUSES, "文字擷取狀態");
  const text = typeof body.text === "string" ? body.text.slice(0, MAX_STORED_TEXT_CHARS) : "";
  if (status === "ok" && !text.trim()) throw new HttpError(400, "沒有擷取到文字。");
  if (status === "ok") {
    await env.FILES.put(textKey(row.r2_key), text, { httpMetadata: { contentType: "text/plain; charset=utf-8" } });
  }
  await env.DB.prepare("UPDATE attachment SET text_status = ?, text_chars = ? WHERE id = ?")
    .bind(status, status === "ok" ? text.length : 0, row.id).run();
  return json({ ok: true, text_status: status, text_chars: status === "ok" ? text.length : 0 });
}

async function downloadAttachment(env: Env, user: AuthUser, id: number): Promise<Response> {
  const row = await attachmentRow(env, user, id);
  const object = await env.FILES.get(row.r2_key);
  if (!object) throw new HttpError(404, "找不到此附件的檔案內容。");
  return new Response(object.body, {
    headers: {
      "Content-Type": ATTACHMENT_TYPES[extensionOf(row.filename)] ?? "application/octet-stream",
      "Content-Length": String(object.size),
      "Content-Disposition": contentDisposition(row.filename),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Uploaded content is never rendered as part of this site.
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

async function deleteAttachment(env: Env, user: AuthUser, id: number): Promise<Response> {
  requireRole(user, "admin", "member");
  const row = await attachmentRow(env, user, id);
  await env.DB.prepare("DELETE FROM attachment WHERE id = ?").bind(row.id).run();
  await deleteObjects(env, [row.r2_key, textKey(row.r2_key)]);
  return json(await projectDetail(env, await getProject(env, user, row.project_id)));
}

// ── Users (admin) ────────────────────────────────────────────────────────────

async function listUsers(env: Env, user: AuthUser): Promise<Response> {
  requireRole(user, "admin");
  const { results } = await env.DB.prepare(
    "SELECT id, email, full_name, role, is_active, created_at, last_login FROM user WHERE company_id = ? ORDER BY created_at",
  ).bind(user.company_id).all();
  return json({ users: results.map((u) => ({ ...u, is_active: Boolean(u.is_active) })) });
}

async function createUser(request: Request, env: Env, user: AuthUser): Promise<Response> {
  requireRole(user, "admin");
  const body = await readJson(request);
  const fullName = str(body.full_name, "姓名", { max: 200 });
  const email = normalizeEmail(body.email);
  if (!email) throw new HttpError(400, "電子郵件格式不正確。");
  const pwError = validatePassword(body.password);
  if (pwError) throw new HttpError(400, pwError);
  const role = oneOf(body.role ?? "member", ["admin", "member", "viewer"] as const, "角色");
  if (await env.DB.prepare("SELECT 1 FROM user WHERE email = ?").bind(email).first()) {
    throw new HttpError(409, "此電子郵件已註冊。");
  }
  await env.DB.prepare("INSERT INTO user (company_id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)")
    .bind(user.company_id, email, await hashPassword(body.password as string, iterations(env)), fullName, role).run();
  return listUsers(env, user);
}

async function updateUser(request: Request, env: Env, user: AuthUser, targetId: number): Promise<Response> {
  requireRole(user, "admin");
  if (targetId === user.id) throw new HttpError(400, "不能變更自己的角色或停用自己。");
  const target = await env.DB.prepare("SELECT id, role, is_active FROM user WHERE id = ? AND company_id = ?")
    .bind(targetId, user.company_id).first<{ id: number; role: string; is_active: number }>();
  if (!target) throw new HttpError(404, "找不到此使用者。");
  const body = await readJson(request);
  const role = body.role !== undefined ? oneOf(body.role, ["admin", "member", "viewer"] as const, "角色") : target.role;
  const active = body.is_active !== undefined ? (body.is_active ? 1 : 0) : target.is_active;
  const stmts = [env.DB.prepare("UPDATE user SET role = ?, is_active = ? WHERE id = ?").bind(role, active, target.id)];
  if (!active) stmts.push(env.DB.prepare("DELETE FROM session WHERE user_id = ?").bind(target.id));
  await env.DB.batch(stmts);
  return listUsers(env, user);
}

/** Removes a member for good. Their edit history stays, with the author left blank. */
async function deleteUser(env: Env, user: AuthUser, targetId: number): Promise<Response> {
  requireRole(user, "admin");
  if (targetId === user.id) throw new HttpError(400, "不能刪除自己的帳號。");
  const target = await env.DB.prepare("SELECT id FROM user WHERE id = ? AND company_id = ?")
    .bind(targetId, user.company_id).first<{ id: number }>();
  if (!target) throw new HttpError(404, "找不到此使用者。");
  // Clear references explicitly rather than relying on ON DELETE SET NULL being enforced.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM session WHERE user_id = ?").bind(target.id),
    env.DB.prepare("UPDATE checklist_item SET updated_by = NULL WHERE updated_by = ?").bind(target.id),
    env.DB.prepare("UPDATE project SET created_by = NULL WHERE created_by = ?").bind(target.id),
    env.DB.prepare("UPDATE attachment SET uploaded_by = NULL WHERE uploaded_by = ?").bind(target.id),
    env.DB.prepare("UPDATE item_review SET reviewed_by = NULL WHERE reviewed_by = ?").bind(target.id),
    env.DB.prepare("UPDATE upload_session SET created_by = NULL WHERE created_by = ?").bind(target.id),
    env.DB.prepare("DELETE FROM user WHERE id = ? AND company_id = ?").bind(target.id, user.company_id),
  ]);
  return listUsers(env, user);
}

// ── AI analysis ──────────────────────────────────────────────────────────────

function aiConfig(env: Env): AiConfig | null {
  if (!env.OLLAMA_API_KEY) return null;
  return {
    apiKey: env.OLLAMA_API_KEY,
    baseURL: env.AI_BASE_URL || "https://ollama.com",
    model: env.AI_MODEL || "deepseek-v4.1-flash",
  };
}

async function analyze(request: Request, env: Env, user: AuthUser): Promise<Response> {
  requireRole(user, "admin", "member");
  const cfg = aiConfig(env);
  if (!cfg) throw new HttpError(503, "AI 分析尚未啟用：管理員需設定 OLLAMA_API_KEY。");
  const body = await readJson(request, MAX_AI_BYTES);
  if (!isSchemaType(body.schema_type)) throw new HttpError(400, "不支援的申請類型。");
  const filename = str(body.filename, "檔案名稱", { max: 255 });
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) throw new HttpError(400, "文件內容為空，無法分析。");
  if (text.length > MAX_TEXT_CHARS) {
    throw new HttpError(413, `文件文字超過 ${MAX_TEXT_CHARS.toLocaleString()} 字元，請拆分後分次分析。`);
  }
  const input = { filename, text };

  try {
    return json(await analyzeDocument(cfg, body.schema_type, input));
  } catch (err) {
    if (err instanceof AnalysisError) throw new HttpError(err.status, err.message);
    throw err;
  }
}

/**
 * Reviews one checklist item: its files' stored text against the item's thresholds.
 * Items without files are recorded as "missing" and items whose files have no text as
 * "unreadable", without calling the model.
 */
async function reviewChecklistItem(env: Env, user: AuthUser, itemId: number): Promise<Response> {
  requireRole(user, "admin", "member");
  const item = await itemWithProject(env, user, itemId);
  const project = await getProject(env, user, item.project_id);
  const files = (await projectAttachments(env, project.id)).get(item.id) ?? [];
  const fingerprint = filesFingerprint(files);
  const tpl = findTemplateItem(project.schema_type, item.item_key);
  const { results: keys } = await env.DB.prepare("SELECT id, r2_key FROM attachment WHERE item_id = ?").bind(item.id).all<{ id: number; r2_key: string }>();
  const keyOf = new Map(keys.map((k) => [k.id, k.r2_key]));

  let verdict: string, summary: string, findings: unknown[] = [], fixes: string[] = [], model: string | null = null;
  let usage = { input_tokens: 0, output_tokens: 0 };
  if (!files.length) {
    verdict = "missing";
    summary = "此項目尚未附加任何文件。";
    fixes = ["上傳此項目所需的文件後再審查。"];
  } else {
    const withText = await Promise.all(files.map(async (f) => {
      const obj = f.text_status === "ok" ? await env.FILES.get(textKey(keyOf.get(f.id)!)) : null;
      return { filename: f.filename, text_status: f.text_status, text: obj ? await obj.text() : null };
    }));
    if (!withText.some((f) => f.text)) {
      verdict = "unreadable";
      summary = "此項目的文件都無法擷取文字（可能是掃描檔或不支援的格式），AI 無法審查內容。";
      fixes = ["改上傳含文字層的 PDF（或先做 OCR），再重新審查。"];
    } else {
      const cfg = aiConfig(env);
      if (!cfg) throw new HttpError(503, "AI 分析尚未啟用：管理員需設定 OLLAMA_API_KEY。");
      try {
        const r = await reviewItem(cfg, {
          schema_name: SCHEMAS[project.schema_type]?.display_name_zh ?? project.schema_type,
          label: item.item_name, required: Boolean(tpl?.required ?? true), criteria: tpl?.criteria ?? [],
          action: tpl?.action_zh ?? null, notes: item.notes, files: withText,
        });
        ({ verdict, summary, findings, fixes, model } = r);
        usage = r.token_usage;
      } catch (err) {
        if (err instanceof AnalysisError) throw new HttpError(err.status, err.message);
        throw err;
      }
    }
  }
  await env.DB.prepare(
    `INSERT INTO item_review (item_id, project_id, verdict, summary, findings, fixes, fingerprint, model, input_tokens, output_tokens, reviewed_by, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT(item_id) DO UPDATE SET verdict = excluded.verdict, summary = excluded.summary, findings = excluded.findings,
       fixes = excluded.fixes, fingerprint = excluded.fingerprint, model = excluded.model, input_tokens = excluded.input_tokens,
       output_tokens = excluded.output_tokens, reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at`,
  ).bind(item.id, project.id, verdict, summary, JSON.stringify(findings), JSON.stringify(fixes), fingerprint, model,
    usage.input_tokens, usage.output_tokens, user.id).run();
  const reviews = await projectReviews(env, project.id);
  return json({ item_id: item.id, review: reviewJson(reviews.get(item.id)) });
}

// ── Router ───────────────────────────────────────────────────────────────────

type Handler = (ctx: { request: Request; env: Env; url: URL; params: string[]; user: AuthUser }) => Promise<Response>;

const routes: Array<[string, RegExp, Handler]> = [
  ["POST", /^\/api\/auth\/password$/, ({ request, env, user }) => changePassword(request, env, user)],
  ["GET", /^\/api\/projects$/, ({ url, env, user }) => listProjects(url, env, user)],
  ["POST", /^\/api\/projects$/, ({ request, env, user }) => createProject(request, env, user)],
  ["POST", /^\/api\/projects\/demo$/, ({ env, user }) => createDemoProjects(env, user)],
  ["GET", /^\/api\/projects\/(\d+)$/, async ({ env, user, params }) =>
    json(await projectDetail(env, await getProject(env, user, idParam(params[0]))))],
  ["PATCH", /^\/api\/projects\/(\d+)$/, ({ request, env, user, params }) => updateProject(request, env, user, idParam(params[0]))],
  ["DELETE", /^\/api\/projects\/(\d+)$/, ({ env, user, params }) => deleteProject(env, user, idParam(params[0]))],
  ["POST", /^\/api\/projects\/(\d+)\/items$/, ({ request, env, user, params }) => createItem(request, env, user, idParam(params[0]))],
  ["PATCH", /^\/api\/items\/(\d+)$/, ({ request, env, user, params }) => updateItem(request, env, user, idParam(params[0]))],
  ["DELETE", /^\/api\/items\/(\d+)$/, ({ env, user, params }) => deleteItem(env, user, idParam(params[0]))],
  ["POST", /^\/api\/items\/(\d+)\/attachments$/, ({ request, env, user, params }) => uploadAttachment(request, env, user, idParam(params[0]))],
  ["GET", /^\/api\/attachments\/(\d+)$/, ({ env, user, params }) => downloadAttachment(env, user, idParam(params[0]))],
  ["DELETE", /^\/api\/attachments\/(\d+)$/, ({ env, user, params }) => deleteAttachment(env, user, idParam(params[0]))],
  ["PUT", /^\/api\/attachments\/(\d+)\/text$/, ({ request, env, user, params }) => putAttachmentText(request, env, user, idParam(params[0]))],
  ["POST", /^\/api\/items\/(\d+)\/uploads$/, ({ request, env, user, params }) => startUpload(request, env, user, idParam(params[0]))],
  ["PUT", /^\/api\/uploads\/([\w.~=+%-]{1,1024})\/parts\/(\d{1,5})$/, ({ request, env, user, params }) => uploadPart(request, env, user, decodeURIComponent(params[0]), Number(params[1]))],
  ["POST", /^\/api\/uploads\/([\w.~=+%-]{1,1024})\/complete$/, ({ request, env, user, params }) => completeUpload(request, env, user, decodeURIComponent(params[0]))],
  ["DELETE", /^\/api\/uploads\/([\w.~=+%-]{1,1024})$/, ({ env, user, params }) => abortUpload(env, user, decodeURIComponent(params[0]))],
  ["POST", /^\/api\/items\/(\d+)\/review$/, ({ env, user, params }) => reviewChecklistItem(env, user, idParam(params[0]))],
  ["GET", /^\/api\/users$/, ({ env, user }) => listUsers(env, user)],
  ["POST", /^\/api\/users$/, ({ request, env, user }) => createUser(request, env, user)],
  ["PATCH", /^\/api\/users\/(\d+)$/, ({ request, env, user, params }) => updateUser(request, env, user, idParam(params[0]))],
  ["DELETE", /^\/api\/users\/(\d+)$/, ({ env, user, params }) => deleteUser(env, user, idParam(params[0]))],
  ["POST", /^\/api\/ai\/analyze$/, ({ request, env, user }) => analyze(request, env, user)],
];

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  // CSRF defence in depth (cookies are SameSite=Lax): state-changing requests must come
  // from our own origin.
  if (method !== "GET" && method !== "HEAD") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) throw new HttpError(403, "跨來源請求被拒絕。");
  }

  // Public endpoints
  if (url.pathname === "/api/health") return json({ ok: true });
  if (url.pathname === "/api/config" && method === "GET") {
    const cfg = aiConfig(env);
    return json({
      registration_enabled: (env.ALLOW_REGISTRATION ?? "true") === "true",
      ai_enabled: Boolean(cfg),
      ai_model: cfg?.model ?? null,
      attachments: {
        max_bytes: MAX_ATTACHMENT_BYTES, single_max_bytes: SINGLE_UPLOAD_MAX_BYTES, part_bytes: UPLOAD_PART_BYTES,
        per_item: MAX_ATTACHMENTS_PER_ITEM, case_quota_bytes: caseQuotaBytes(env), extensions: Object.keys(ATTACHMENT_TYPES),
      },
      today: todayTaipei(),
    });
  }
  if (url.pathname === "/api/schemas" && method === "GET") {
    return json({
      schemas: Object.entries(SCHEMAS).map(([key, s]) => ({
        key, name: s.display_name, name_zh: s.display_name_zh,
        deadline_default_days: s.deadline_default_days, item_count: s.items.length,
      })),
    });
  }
  if (url.pathname === "/api/auth/register" && method === "POST") return register(request, env);
  if (url.pathname === "/api/auth/login" && method === "POST") return login(request, env);
  if (url.pathname === "/api/auth/logout" && method === "POST") return logout(request, env);
  if (url.pathname === "/api/auth/me" && method === "GET") return json({ user: await currentUser(request, env) });

  // Everything else requires a session
  let matchedPath = false;
  for (const [m, pattern, handler] of routes) {
    const match = url.pathname.match(pattern);
    if (!match) continue;
    matchedPath = true;
    if (m !== method) continue;
    const user = await currentUser(request, env);
    if (!user) throw new HttpError(401, "請先登入。");
    return handler({ request, env, url, params: match.slice(1), user });
  }
  throw new HttpError(matchedPath ? 405 : 404, matchedPath ? "不支援此方法。" : "找不到此 API。");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      return await handleApi(request, env);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error("Unhandled API error", err);
      return json({ error: "系統錯誤，請稍後再試。" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
