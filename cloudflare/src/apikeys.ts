/**
 * API keys for the REST API (/api/*): a company's own programs act as one member, with that
 * member's current role, limited further by the key's scope. Keys are sent as
 * `Authorization: Bearer rrk_…`; only their SHA-256 is stored.
 */

import { hashToken, newSessionToken } from "./auth";

export const API_KEY_PREFIX = "rrk_";
export const API_KEY_DAYS = [30, 90, 365] as const;
export const API_KEY_SCOPES = ["read", "read write"] as const;
export const MAX_KEYS_PER_USER = 20;
const AUDIT_DAYS = 365;

export interface ApiKeyPrincipal {
  key_id: number;
  key_name: string;
  scope: (typeof API_KEY_SCOPES)[number];
  last_used_at: string | null;
  api_enabled: number;
  id: number;
  email: string;
  full_name: string;
  role: "admin" | "member" | "viewer";
  company_id: number;
  company_name: string;
  company_slug: string;
}

/** The bearer value of an Authorization header, when it carries one of our API keys. */
export function bearerApiKey(request: Request): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get("Authorization") ?? "");
  return m && m[1].startsWith(API_KEY_PREFIX) ? m[1] : null;
}

/** The key and its member, or null when the key is unknown, expired, or its member or company is inactive. */
export async function apiKeyPrincipal(db: D1Database, key: string, now: string): Promise<ApiKeyPrincipal | null> {
  return db.prepare(
    `SELECT k.id AS key_id, k.name AS key_name, k.scope, k.last_used_at, c.api_enabled,
            u.id, u.email, u.full_name, u.role, u.company_id, c.name AS company_name, c.slug AS company_slug
       FROM api_key k JOIN user u ON u.id = k.user_id JOIN company c ON c.id = u.company_id
      WHERE k.key_hash = ? AND k.expires_at > ? AND k.company_id = u.company_id AND u.is_active = 1 AND c.is_active = 1`,
  ).bind(await hashToken(key), now).first<ApiKeyPrincipal>();
}

/**
 * Paths a key may never reach, whatever its scope: signing in and out, passwords, members,
 * and the settings that hand out access (agent connections and API keys themselves). A
 * leaked key therefore cannot mint more access or lock people out.
 */
const KEY_FORBIDDEN = /^\/api\/(auth\/(?!me$)|users(\/|$)|mcp(\/|$)|api-keys(\/|$))/;

/** Why a key may not make this request, or null when it may. */
export function keyRequestProblem(scope: string, method: string, path: string): string | null {
  if (KEY_FORBIDDEN.test(path)) return "API 金鑰不能用於登入、帳號、成員或連線設定，請在網頁上操作。";
  if (scope !== "read write" && method !== "GET" && method !== "HEAD") return "此 API 金鑰為唯讀，不能修改資料。";
  return null;
}

/** Creates a key; the key itself is returned once and never stored. */
export async function createApiKey(
  db: D1Database, user: { id: number; company_id: number }, name: string, scope: string, days: number,
): Promise<{ id: number; key: string; expires_at: string }> {
  const key = API_KEY_PREFIX + newSessionToken();
  const expires = new Date(Date.now() + days * 86400_000).toISOString();
  const row = await db.prepare(
    `INSERT INTO api_key (company_id, user_id, name, scope, key_hash, key_hint, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  ).bind(user.company_id, user.id, name, scope, await hashToken(key), key.slice(-4), expires).first<{ id: number }>();
  return { id: row!.id, key, expires_at: expires };
}

/**
 * Records one request made with a key and, at most once a minute, when the key was last used.
 * Old audit rows are pruned now and then.
 */
export async function recordKeyUse(
  db: D1Database, p: ApiKeyPrincipal, method: string, path: string, status: number, now: string,
): Promise<void> {
  const stmts = [
    db.prepare("INSERT INTO api_audit (company_id, key_id, user_id, key_name, method, path, status) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(p.company_id, p.key_id, p.id, p.key_name, method, path.slice(0, 300), status),
  ];
  if (!p.last_used_at || Date.parse(now) - Date.parse(p.last_used_at) > 60_000) {
    stmts.push(db.prepare("UPDATE api_key SET last_used_at = ? WHERE id = ?").bind(now, p.key_id));
  }
  if (Math.random() < 0.01) {
    stmts.push(db.prepare("DELETE FROM api_audit WHERE created_at < ?")
      .bind(new Date(Date.parse(now) - AUDIT_DAYS * 86400_000).toISOString()));
  }
  await db.batch(stmts);
}
