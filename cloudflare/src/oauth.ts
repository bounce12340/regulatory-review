/**
 * OAuth 2.1 authorization server for the MCP endpoint, so agents such as claude.ai, ChatGPT,
 * Claude Code and Cursor can connect with the user's own RegReview account.
 *
 * Follows the MCP authorization spec (2026-07-28):
 * - Protected Resource Metadata (RFC 9728) and Authorization Server Metadata (RFC 8414)
 * - Client ID Metadata Documents (the client_id is an HTTPS URL) and, for older clients,
 *   Dynamic Client Registration (RFC 7591)
 * - Authorization code + PKCE (S256 only), the issuer in the redirect (RFC 9207), the
 *   resource parameter checked against this server (RFC 8707), rotating refresh tokens
 *
 * People can also create a personal access token for clients that send a fixed header.
 * Only SHA-256 hashes of codes and tokens are stored.
 */

import { hashToken, newSessionToken } from "./auth";

export const SCOPES = ["read", "write"] as const;
const ACCESS_TTL_SECONDS = 3600;
const REFRESH_TTL_DAYS = 30;
const CODE_TTL_SECONDS = 300;
const CIMD_FRESH_MS = 3600_000;
const CIMD_STALE_OK_MS = 24 * 3600_000;
const MAX_REDIRECT_URIS = 10;

/** Prefixes tell the token kinds apart without a lookup: personal, access, refresh. */
export const TOKEN_PREFIX = { personal: "rrp_", access: "rra_", refresh: "rrr_" } as const;

export interface McpPrincipal {
  grant_id: number;
  grant_kind: "oauth" | "token";
  agent: string;
  scope: string;
  user_id: number;
  email: string;
  full_name: string;
  role: "admin" | "member" | "viewer";
  company_id: number;
  company_name: string;
  mcp_enabled: number;
  last_used_at: string | null;
}

/** A logged-in user of the web app, as index.ts knows it. */
export interface SessionUser {
  id: number;
  full_name: string;
  email: string;
  role: "admin" | "member" | "viewer";
  company_id: number;
  company_name: string;
}

interface ClientInfo {
  client_id: string;
  kind: "dcr" | "cimd";
  client_name: string;
  client_uri: string | null;
  redirect_uris: string[];
}

const nowIso = () => new Date().toISOString();
const later = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

// ── URLs and metadata ────────────────────────────────────────────────────────

export const issuerOf = (url: URL) => url.origin;
/** The canonical URI of the MCP endpoint, used as the OAuth resource (RFC 8707). */
export const resourceOf = (url: URL) => `${url.origin}/mcp`;
export const resourceMetadataUrl = (url: URL) => `${url.origin}/.well-known/oauth-protected-resource/mcp`;

/** The resource parameter may name the MCP endpoint or the whole origin. */
function resourceOk(value: string | null, url: URL): boolean {
  if (!value) return true;
  const v = value.replace(/\/+$/, "");
  return v === resourceOf(url) || v === url.origin;
}

export function protectedResourceMetadata(url: URL) {
  return {
    resource: resourceOf(url),
    authorization_servers: [issuerOf(url)],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "RegReview 法規審查",
  };
}

export function authorizationServerMetadata(url: URL) {
  const o = url.origin;
  return {
    issuer: issuerOf(url),
    authorization_endpoint: `${o}/oauth/authorize`,
    token_endpoint: `${o}/oauth/token`,
    registration_endpoint: `${o}/oauth/register`,
    revocation_endpoint: `${o}/oauth/revoke`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...SCOPES],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  };
}

// ── Redirect URIs ────────────────────────────────────────────────────────────

const isLoopback = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "[::1]";
const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "file:", "blob:", "vbscript:", "about:", "ws:", "wss:", "ftp:"]);

/**
 * Where a code may be sent: HTTPS, http on a loopback address (native apps, RFC 8252 7.3),
 * or a private-use scheme such as cursor:// or vscode:// (RFC 8252 7.1).
 */
export function redirectAllowed(uri: string): boolean {
  let u: URL;
  try { u = new URL(uri); } catch { return false; }
  if (u.hash || u.username || u.password) return false;
  if (u.protocol === "https:") return Boolean(u.hostname);
  if (u.protocol === "http:") return isLoopback(u.hostname);
  if (BLOCKED_SCHEMES.has(u.protocol)) return false;
  return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol);
}

/** Exact match, except that the port of a loopback redirect is not compared (RFC 8252 7.3). */
export function redirectMatches(registered: string, requested: string): boolean {
  if (registered === requested) return true;
  let a: URL, b: URL;
  try { a = new URL(registered); b = new URL(requested); } catch { return false; }
  return a.protocol === "http:" && b.protocol === "http:" && isLoopback(a.hostname) && a.hostname === b.hostname
    && a.pathname === b.pathname && a.search === b.search;
}

// ── Clients ──────────────────────────────────────────────────────────────────

export class OAuthError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) {
    super(message);
  }
}

function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[");
}

function clientFromRow(row: { client_id: string; kind: string; client_name: string; client_uri: string | null; redirect_uris: string }): ClientInfo {
  return { ...row, kind: row.kind as ClientInfo["kind"], redirect_uris: JSON.parse(row.redirect_uris) };
}

/** A client_id that names a Client ID Metadata Document: HTTPS with a path, on a public host name. */
export function clientIdUrlProblem(clientId: string): string | null {
  let u: URL;
  try { u = new URL(clientId); } catch { return "client_id 不是有效的網址。"; }
  if (u.protocol !== "https:" || u.pathname === "/" || u.hash || u.username || u.password
    || isIpLiteral(u.hostname) || u.hostname === "localhost" || !u.hostname.includes(".")) {
    return "client_id 必須是含路徑的 HTTPS 網址。";
  }
  return null;
}

/** Checks a fetched metadata document; it must name itself as client_id. */
export function clientFromMetadataDocument(clientId: string, doc: unknown): Omit<ClientInfo, "kind"> {
  if (!doc || typeof doc !== "object" || Array.isArray(doc) || (doc as Record<string, unknown>).client_id !== clientId) {
    throw new OAuthError("invalid_client", "用戶端 metadata 文件的 client_id 與網址不符。");
  }
  const d = doc as Record<string, unknown>;
  const redirects = Array.isArray(d.redirect_uris) ? d.redirect_uris.filter((r): r is string => typeof r === "string") : [];
  if (!redirects.length || redirects.length > MAX_REDIRECT_URIS || !redirects.every(redirectAllowed)) {
    throw new OAuthError("invalid_client", "用戶端 metadata 文件的 redirect_uris 無效。");
  }
  const clientUri = typeof d.client_uri === "string" && /^https:\/\//.test(d.client_uri) ? d.client_uri.slice(0, 500) : null;
  return {
    client_id: clientId,
    client_name: typeof d.client_name === "string" && d.client_name.trim() ? d.client_name.trim().slice(0, 120) : new URL(clientId).hostname,
    client_uri: clientUri,
    redirect_uris: redirects,
  };
}

/** Fetches a Client ID Metadata Document (5 s, 64 KB, no redirects). */
async function fetchClientMetadata(clientId: string): Promise<Omit<ClientInfo, "kind">> {
  const problem = clientIdUrlProblem(clientId);
  if (problem) throw new OAuthError("invalid_client", problem);
  let res: Response;
  try {
    res = await fetch(clientId, { headers: { Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(5000) });
  } catch {
    throw new OAuthError("invalid_client", "無法取得用戶端的 metadata 文件。");
  }
  if (!res.ok || !res.body) throw new OAuthError("invalid_client", `用戶端 metadata 文件回應 ${res.status}。`);
  // Read at most 64 KB, whatever the server sends.
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 64 * 1024) {
      await reader.cancel();
      throw new OAuthError("invalid_client", "用戶端 metadata 文件過大。");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { bytes.set(c, at); at += c.length; }
  const text = new TextDecoder().decode(bytes);
  let doc: unknown;
  try { doc = JSON.parse(text); } catch { throw new OAuthError("invalid_client", "用戶端 metadata 文件不是有效的 JSON。"); }
  return clientFromMetadataDocument(clientId, doc);
}

/** A registered client, or a CIMD client fetched (and cached) on first use. */
async function resolveClient(db: D1Database, clientId: string): Promise<ClientInfo> {
  if (!clientId || clientId.length > 2000) throw new OAuthError("invalid_client", "缺少 client_id。");
  const row = await db.prepare("SELECT client_id, kind, client_name, client_uri, redirect_uris, fetched_at FROM oauth_client WHERE client_id = ?")
    .bind(clientId).first<{ client_id: string; kind: string; client_name: string; client_uri: string | null; redirect_uris: string; fetched_at: string | null }>();
  if (row?.kind === "dcr") return clientFromRow(row);
  if (!/^https:\/\//i.test(clientId)) throw new OAuthError("invalid_client", "找不到此用戶端，請重新連線。");
  const age = row?.fetched_at ? Date.now() - Date.parse(row.fetched_at) : Infinity;
  if (row && age < CIMD_FRESH_MS) return clientFromRow(row);
  try {
    const doc = await fetchClientMetadata(clientId);
    await db.prepare(
      `INSERT INTO oauth_client (client_id, kind, client_name, client_uri, redirect_uris, fetched_at) VALUES (?, 'cimd', ?, ?, ?, ?)
       ON CONFLICT(client_id) DO UPDATE SET client_name = excluded.client_name, client_uri = excluded.client_uri,
         redirect_uris = excluded.redirect_uris, fetched_at = excluded.fetched_at`,
    ).bind(clientId, doc.client_name, doc.client_uri, JSON.stringify(doc.redirect_uris), nowIso()).run();
    return { ...doc, kind: "cimd" };
  } catch (err) {
    // A document that was fine recently still works while its host has a short outage.
    if (row && age < CIMD_STALE_OK_MS) return clientFromRow(row);
    throw err;
  }
}

/** POST /oauth/register — Dynamic Client Registration (RFC 7591), public clients only. */
export async function registerClient(request: Request, db: D1Database): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 16 * 1024) throw new Error();
    body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
  } catch {
    return oauthJson({ error: "invalid_client_metadata", error_description: "請以 JSON 送出用戶端資料。" }, 400);
  }
  const redirects = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((r): r is string => typeof r === "string") : [];
  if (!redirects.length || redirects.length > MAX_REDIRECT_URIS || !redirects.every((r) => r.length <= 2000 && redirectAllowed(r))) {
    return oauthJson({ error: "invalid_redirect_uri", error_description: "redirect_uris 必須是 HTTPS、本機 loopback 或應用程式自訂 scheme 的網址。" }, 400);
  }
  const method = body.token_endpoint_auth_method ?? "none";
  if (method !== "none") {
    return oauthJson({ error: "invalid_client_metadata", error_description: "只支援公開用戶端（token_endpoint_auth_method=none，搭配 PKCE）。" }, 400);
  }
  const grantTypes = Array.isArray(body.grant_types) ? body.grant_types : ["authorization_code", "refresh_token"];
  if (!grantTypes.every((g) => g === "authorization_code" || g === "refresh_token")) {
    return oauthJson({ error: "invalid_client_metadata", error_description: "只支援 authorization_code 與 refresh_token。" }, 400);
  }
  const name = typeof body.client_name === "string" && body.client_name.trim() ? body.client_name.trim().slice(0, 120) : "未命名的 AI 代理";
  const clientUri = typeof body.client_uri === "string" && /^https:\/\//.test(body.client_uri) ? body.client_uri.slice(0, 500) : null;
  const clientId = `rrc_${newSessionToken()}`;
  await db.batch([
    // Registrations that never led to a connection are dropped after a week.
    db.prepare(`DELETE FROM oauth_client WHERE kind = 'dcr' AND created_at < ?
                AND client_id NOT IN (SELECT client_id FROM mcp_grant WHERE client_id IS NOT NULL)`)
      .bind(new Date(Date.now() - 7 * 86400_000).toISOString()),
    db.prepare("INSERT INTO oauth_client (client_id, kind, client_name, client_uri, redirect_uris) VALUES (?, 'dcr', ?, ?, ?)")
      .bind(clientId, name, clientUri, JSON.stringify(redirects)),
  ]);
  return oauthJson({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: name,
    ...(clientUri ? { client_uri: clientUri } : {}),
    redirect_uris: redirects,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  }, 201);
}

// ── Authorization endpoint ───────────────────────────────────────────────────

interface AuthorizeParams {
  response_type: string; client_id: string; redirect_uri: string; state: string | null;
  code_challenge: string; code_challenge_method: string; scope: string | null; resource: string | null;
}

function readAuthorizeParams(p: URLSearchParams): AuthorizeParams {
  return {
    response_type: p.get("response_type") ?? "",
    client_id: p.get("client_id") ?? "",
    redirect_uri: p.get("redirect_uri") ?? "",
    state: p.get("state"),
    code_challenge: p.get("code_challenge") ?? "",
    code_challenge_method: p.get("code_challenge_method") ?? "",
    scope: p.get("scope"),
    resource: p.get("resource"),
  };
}

/** Requested scopes, keeping only the ones this server knows ("offline_access" etc. are ignored). */
function parseScope(raw: string | null): Set<string> {
  const set = new Set((raw ?? "").split(/\s+/).filter((s) => (SCOPES as readonly string[]).includes(s)));
  set.add("read");
  return set;
}

function redirectWith(uri: string, params: Record<string, string | null | undefined>): Response {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined) u.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: u.toString(), "Cache-Control": "no-store" } });
}

/** CSRF token for the consent form: bound to the browser session, without another secret. */
async function consentToken(sessionToken: string): Promise<string> {
  return (await hashToken(`consent:${sessionToken}`)).slice(0, 32);
}

/**
 * GET/POST /oauth/authorize. GET shows who is asking and what for; POST records the user's
 * decision and sends the browser back to the client with a code (or access_denied).
 */
export async function authorize(
  request: Request, db: D1Database, url: URL, user: SessionUser | null, sessionToken: string | null,
): Promise<Response> {
  const isPost = request.method === "POST";
  const form = isPost ? new URLSearchParams(await request.text()) : url.searchParams;
  const p = readAuthorizeParams(form);

  // Until the client and redirect URI check out, errors are shown here, never redirected.
  let client: ClientInfo;
  try {
    client = await resolveClient(db, p.client_id);
  } catch (err) {
    return page("無法連線", `<p>${esc(err instanceof OAuthError ? err.message : "用戶端驗證失敗。")}</p><p class="help">請回到 AI 工具重新新增連線。</p>`, 400);
  }
  if (!p.redirect_uri || !client.redirect_uris.some((r) => redirectMatches(r, p.redirect_uri))) {
    return page("無法連線", "<p>這個連線要求的返回網址（redirect_uri）沒有登記在用戶端資料中，為安全起見已停止。</p>", 400);
  }
  const iss = issuerOf(url);
  const fail = (error: string, description: string) =>
    redirectWith(p.redirect_uri, { error, error_description: description, state: p.state, iss });
  if (p.response_type !== "code") return fail("unsupported_response_type", "只支援 response_type=code。");
  if (!p.code_challenge || p.code_challenge_method !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(p.code_challenge)) {
    return fail("invalid_request", "需要 PKCE（code_challenge_method=S256）。");
  }
  if (!resourceOk(p.resource, url)) return fail("invalid_target", `resource 必須是 ${resourceOf(url)}。`);

  if (!user || !sessionToken) {
    if (isPost) return page("請重新登入", "<p>登入已逾時，請回到 AI 工具重新連線。</p>", 401);
    return new Response(null, { status: 302, headers: { Location: `/?next=${encodeURIComponent(url.pathname + url.search)}`, "Cache-Control": "no-store" } });
  }
  const company = await db.prepare("SELECT mcp_enabled FROM company WHERE id = ?").bind(user.company_id).first<{ mcp_enabled: number }>();
  if (!company?.mcp_enabled) {
    if (isPost) return fail("access_denied", "公司管理員尚未開啟 AI 代理連線。");
    const back = new URL(p.redirect_uri);
    back.searchParams.set("error", "access_denied");
    back.searchParams.set("error_description", "公司管理員尚未開啟 AI 代理連線。");
    if (p.state) back.searchParams.set("state", p.state);
    back.searchParams.set("iss", iss);
    return page("尚未開啟 AI 代理連線", `<p>${esc(user.company_name)} 的管理員還沒有開啟 AI 代理連線（MCP）。請管理員到 RegReview 的「AI 代理連線」頁面開啟後再試。</p>
      <p><a class="btn" href="${esc(back.toString())}">返回 ${esc(client.client_name)}</a></p>`, 403);
  }

  const requested = parseScope(p.scope);
  const mayWrite = user.role === "admin" || user.role === "member";
  const csrf = await consentToken(sessionToken);

  if (!isPost) {
    const host = redirectHost(p.redirect_uri);
    const loopback = /^http:/.test(p.redirect_uri);
    const hidden = Object.entries({ ...p, csrf }).filter(([, v]) => v !== null)
      .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(String(v))}">`).join("");
    return page(`${client.client_name} 要求存取 RegReview`, `
      <p class="lead"><b>${esc(client.client_name)}</b> 想以你的身分（${esc(user.full_name)}，${esc(user.company_name)}）讀取 RegReview 的資料，交給它自己的 AI 模型分析。</p>
      <ul class="consent-list">
        <li>讀取公司所有案件、檢查清單與審查門檻</li>
        <li>讀取已上傳文件的文字內容與原始檔（PDF、圖片）</li>
      </ul>
      <form method="post" action="/oauth/authorize">
        ${hidden}
        ${mayWrite ? `<label class="check"><input type="checkbox" name="allow_write" value="1"${requested.has("write") ? " checked" : ""}> 也允許它把審查結果寫回檢查項目（不會刪除或修改文件）</label>` : ""}
        <dl class="consent-facts">
          <div><dt>授權後返回</dt><dd>${esc(host)}</dd></div>
          ${client.kind === "cimd" ? `<div><dt>用戶端識別</dt><dd>${esc(new URL(client.client_id).hostname)}</dd></div>` : ""}
        </dl>
        ${client.kind === "dcr" ? `<p class="help">這個用戶端是自行註冊的，名稱由它自己提供、RegReview 無法查證；請確認上面的返回網址是你正在使用的 AI 工具（例如 Claude 為 claude.ai，ChatGPT 為 chatgpt.com）。</p>` : ""}
        ${loopback ? `<p class="notice warn">這個連線會返回你電腦上的程式（${esc(host)}）。只有在你剛剛從自己的 AI 工具（例如 Claude Code、Cursor）發起連線時才允許。</p>` : ""}
        <p class="help">文件內容會傳給該 AI 服務的模型處理，請確認符合公司保密規範。之後可在 RegReview「AI 代理連線」頁面隨時撤銷。</p>
        <div class="btn-row">
          <button class="btn btn-primary" type="submit" name="decision" value="allow">允許</button>
          <button class="btn" type="submit" name="decision" value="deny">拒絕</button>
        </div>
      </form>`, 200);
  }

  // POST: the decision. The form must come from this site and this browser session.
  const origin = request.headers.get("Origin");
  if ((origin && origin !== url.origin) || form.get("csrf") !== csrf) {
    return page("無法完成授權", "<p>授權表單已失效，請回到 AI 工具重新連線。</p>", 403);
  }
  if (form.get("decision") !== "allow") return fail("access_denied", "使用者拒絕授權。");
  const scope = ["read", ...(mayWrite && form.get("allow_write") === "1" ? ["write"] : [])].join(" ");
  const code = newSessionToken();
  await db.batch([
    db.prepare("DELETE FROM oauth_code WHERE expires_at <= ?").bind(nowIso()),
    db.prepare("INSERT INTO oauth_code (code_hash, client_id, user_id, redirect_uri, code_challenge, scope, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(await hashToken(code), client.client_id, user.id, p.redirect_uri, p.code_challenge, scope, later(CODE_TTL_SECONDS)),
  ]);
  return redirectWith(p.redirect_uri, { code, state: p.state, iss });
}

function redirectHost(uri: string): string {
  try {
    const u = new URL(uri);
    return u.host || `${u.protocol}//`;
  } catch {
    return uri;
  }
}

// ── Token endpoint ───────────────────────────────────────────────────────────

async function readForm(request: Request): Promise<URLSearchParams> {
  const text = await request.text();
  if (text.length > 16 * 1024) throw new OAuthError("invalid_request", "請求內容過大。");
  if ((request.headers.get("Content-Type") ?? "").includes("application/json")) {
    const out = new URLSearchParams();
    try {
      for (const [k, v] of Object.entries(JSON.parse(text) as Record<string, unknown>)) if (typeof v === "string") out.set(k, v);
    } catch {
      throw new OAuthError("invalid_request", "無法解析請求內容。");
    }
    return out;
  }
  return new URLSearchParams(text);
}

async function pkceS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  let bin = "";
  for (const b of new Uint8Array(digest)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function issueTokens(db: D1Database, grantId: number, scope: string) {
  const access = TOKEN_PREFIX.access + newSessionToken();
  const refresh = TOKEN_PREFIX.refresh + newSessionToken();
  await db.batch([
    db.prepare("DELETE FROM mcp_access_token WHERE grant_id = ? AND expires_at <= ?").bind(grantId, nowIso()),
    db.prepare("INSERT INTO mcp_access_token (token_hash, grant_id, expires_at) VALUES (?, ?, ?)")
      .bind(await hashToken(access), grantId, later(ACCESS_TTL_SECONDS)),
    db.prepare("UPDATE mcp_grant SET refresh_hash = ?, expires_at = ? WHERE id = ?")
      .bind(await hashToken(refresh), later(REFRESH_TTL_DAYS * 86400), grantId),
  ]);
  return oauthJson({ access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_SECONDS, refresh_token: refresh, scope });
}

/** Users who can no longer connect: deactivated, or their company switched MCP off. */
async function userCanConnect(db: D1Database, userId: number): Promise<{ company_id: number } | null> {
  return db.prepare(
    `SELECT u.company_id FROM user u JOIN company c ON c.id = u.company_id
      WHERE u.id = ? AND u.is_active = 1 AND c.is_active = 1 AND c.mcp_enabled = 1`,
  ).bind(userId).first<{ company_id: number }>();
}

/** POST /oauth/token — authorization_code (with PKCE) and refresh_token grants. */
export async function token(request: Request, db: D1Database, url: URL): Promise<Response> {
  try {
    const form = await readForm(request);
    const grantType = form.get("grant_type");
    const clientId = form.get("client_id") ?? "";
    if (!resourceOk(form.get("resource"), url)) throw new OAuthError("invalid_target", `resource 必須是 ${resourceOf(url)}。`);

    if (grantType === "authorization_code") {
      const code = form.get("code") ?? "";
      const verifier = form.get("code_verifier") ?? "";
      // Single use: the row is gone whether or not the rest checks out.
      const row = await db.prepare("DELETE FROM oauth_code WHERE code_hash = ? RETURNING client_id, user_id, redirect_uri, code_challenge, scope, expires_at")
        .bind(await hashToken(code)).first<{ client_id: string; user_id: number; redirect_uri: string; code_challenge: string; scope: string; expires_at: string }>();
      if (!row || row.expires_at <= nowIso()) throw new OAuthError("invalid_grant", "授權碼無效或已過期。");
      if (row.client_id !== clientId) throw new OAuthError("invalid_grant", "授權碼不屬於此用戶端。");
      if ((form.get("redirect_uri") ?? "") !== row.redirect_uri) throw new OAuthError("invalid_grant", "redirect_uri 與授權時不同。");
      if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || (await pkceS256(verifier)) !== row.code_challenge) {
        throw new OAuthError("invalid_grant", "PKCE 驗證失敗。");
      }
      const who = await userCanConnect(db, row.user_id);
      if (!who) throw new OAuthError("invalid_grant", "帳號已停用，或公司已關閉 AI 代理連線。");
      const client = await db.prepare("SELECT client_name FROM oauth_client WHERE client_id = ?").bind(clientId).first<{ client_name: string }>();
      // One connection per user and client: reconnecting replaces the old one.
      const old = await db.prepare("SELECT id FROM mcp_grant WHERE user_id = ? AND client_id = ? AND kind = 'oauth'")
        .bind(row.user_id, clientId).all<{ id: number }>();
      const grant = await db.prepare(
        "INSERT INTO mcp_grant (company_id, user_id, kind, client_id, name, scope) VALUES (?, ?, 'oauth', ?, ?, ?) RETURNING id",
      ).bind(who.company_id, row.user_id, clientId, client?.client_name ?? "AI 代理", row.scope).first<{ id: number }>();
      if (old.results.length) await revokeGrants(db, old.results.map((g) => g.id));
      return await issueTokens(db, grant!.id, row.scope);
    }

    if (grantType === "refresh_token") {
      const refresh = form.get("refresh_token") ?? "";
      const grant = await db.prepare("SELECT id, user_id, client_id, scope, expires_at FROM mcp_grant WHERE refresh_hash = ? AND kind = 'oauth'")
        .bind(await hashToken(refresh)).first<{ id: number; user_id: number; client_id: string; scope: string; expires_at: string | null }>();
      if (!grant || !grant.expires_at || grant.expires_at <= nowIso()) throw new OAuthError("invalid_grant", "refresh token 無效或已過期。");
      if (grant.client_id !== clientId) throw new OAuthError("invalid_grant", "refresh token 不屬於此用戶端。");
      if (!(await userCanConnect(db, grant.user_id))) throw new OAuthError("invalid_grant", "帳號已停用，或公司已關閉 AI 代理連線。");
      return await issueTokens(db, grant.id, grant.scope);
    }

    throw new OAuthError("unsupported_grant_type", "只支援 authorization_code 與 refresh_token。");
  } catch (err) {
    if (err instanceof OAuthError) return oauthJson({ error: err.code, error_description: err.message }, err.status);
    throw err;
  }
}

/** POST /oauth/revoke (RFC 7009): ends the connection the token belongs to. Always 200. */
export async function revoke(request: Request, db: D1Database): Promise<Response> {
  try {
    const t = (await readForm(request)).get("token") ?? "";
    const h = await hashToken(t);
    const grant = t.startsWith(TOKEN_PREFIX.access)
      ? await db.prepare("SELECT grant_id AS id FROM mcp_access_token WHERE token_hash = ?").bind(h).first<{ id: number }>()
      : await db.prepare("SELECT id FROM mcp_grant WHERE refresh_hash = ? OR token_hash = ?").bind(h, h).first<{ id: number }>();
    if (grant) await revokeGrants(db, [grant.id]);
  } catch { /* RFC 7009: invalid tokens are not an error */ }
  return oauthJson({});
}

export async function revokeGrants(db: D1Database, ids: number[]): Promise<void> {
  if (!ids.length) return;
  const marks = ids.map(() => "?").join(",");
  await db.batch([
    db.prepare(`DELETE FROM mcp_access_token WHERE grant_id IN (${marks})`).bind(...ids),
    db.prepare(`DELETE FROM mcp_grant WHERE id IN (${marks})`).bind(...ids),
  ]);
}

// ── Bearer tokens on the MCP endpoint ────────────────────────────────────────

const PRINCIPAL_COLUMNS = `g.id AS grant_id, g.kind AS grant_kind, g.name AS agent, g.scope, g.last_used_at,
  u.id AS user_id, u.email, u.full_name, u.role, u.company_id, c.name AS company_name, c.mcp_enabled`;

/** The grant and user behind a bearer token, or null when the token is not (or no longer) valid. */
export async function principalFor(db: D1Database, request: Request): Promise<McpPrincipal | null> {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get("Authorization") ?? "");
  if (!m) return null;
  const t = m[1];
  const h = await hashToken(t);
  const now = nowIso();
  if (t.startsWith(TOKEN_PREFIX.access)) {
    return db.prepare(
      `SELECT ${PRINCIPAL_COLUMNS} FROM mcp_access_token t
         JOIN mcp_grant g ON g.id = t.grant_id JOIN user u ON u.id = g.user_id JOIN company c ON c.id = u.company_id
        WHERE t.token_hash = ? AND t.expires_at > ? AND g.company_id = u.company_id AND u.is_active = 1 AND c.is_active = 1`,
    ).bind(h, now).first<McpPrincipal>();
  }
  if (t.startsWith(TOKEN_PREFIX.personal)) {
    return db.prepare(
      `SELECT ${PRINCIPAL_COLUMNS} FROM mcp_grant g JOIN user u ON u.id = g.user_id JOIN company c ON c.id = u.company_id
        WHERE g.token_hash = ? AND g.kind = 'token' AND (g.expires_at IS NULL OR g.expires_at > ?)
          AND g.company_id = u.company_id AND u.is_active = 1 AND c.is_active = 1`,
    ).bind(h, now).first<McpPrincipal>();
  }
  return null;
}

/** Creates a personal access token; the token itself is returned once and never stored. */
export async function createPersonalToken(db: D1Database, user: SessionUser, name: string, scope: string, days: number) {
  const t = TOKEN_PREFIX.personal + newSessionToken();
  const row = await db.prepare(
    `INSERT INTO mcp_grant (company_id, user_id, kind, name, scope, token_hash, token_hint, expires_at)
     VALUES (?, ?, 'token', ?, ?, ?, ?, ?) RETURNING id`,
  ).bind(user.company_id, user.id, name, scope, await hashToken(t), t.slice(-4), later(days * 86400)).first<{ id: number }>();
  return { id: row!.id, token: t };
}

// ── Responses ────────────────────────────────────────────────────────────────

/** CORS for endpoints that browser-based MCP clients call directly (no cookies involved). */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

export function oauthJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", Pragma: "no-cache", ...CORS_HEADERS },
  });
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** A small server-rendered page in the site's look (the consent screen and its errors). */
function page(title: string, body: string, status: number): Response {
  const html = `<!doctype html>
<html lang="zh-Hant-TW"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}｜RegReview</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styles.css"><script src="/theme.js"></script>
</head><body><main class="consent">
<div class="consent-brand"><div class="seal-mark" aria-hidden="true">審</div><div><div class="brand-name">RegReview</div><div class="brand-sub">AI 代理連線</div></div></div>
<section class="sheet"><h1 class="consent-title">${esc(title)}</h1>${body}</section>
</main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      // No form-action: the decision redirects to the client's own callback.
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  });
}
