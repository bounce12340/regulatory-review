/**
 * A company's own AI service ("bring your own key"): which service and model its AI
 * analysis runs on, with the company's own API key. Keys are encrypted with AES-GCM under
 * a key derived from the Worker secret AI_KEY_SECRET and bound to the company, so a
 * database copy alone does not reveal them, and a row moved to another company won't
 * decrypt.
 */

import type { AiConfig, Protocol } from "./llm";

export type ProviderId = "anthropic" | "openai" | "gemini" | "ollama" | "openai_compatible";

export interface Provider {
  id: ProviderId;
  label: string;
  protocol: Protocol;
  /** Default endpoint; null when the company must give one. */
  base_url: string | null;
  default_model: string | null;
  suggested_models: string[];
  key_help: string;
}

export const PROVIDERS: Provider[] = [
  {
    id: "anthropic", label: "Anthropic Claude", protocol: "anthropic", base_url: "https://api.anthropic.com",
    default_model: "claude-opus-5-5", suggested_models: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
    key_help: "在 Claude Console（platform.claude.com）的 API Keys 建立。",
  },
  {
    id: "openai", label: "OpenAI", protocol: "openai", base_url: "https://api.openai.com/v1",
    default_model: null, suggested_models: [], key_help: "在 OpenAI Platform 的 API keys 建立。模型名稱請依 OpenAI 目前提供的模型填寫。",
  },
  {
    id: "gemini", label: "Google Gemini", protocol: "openai", base_url: "https://generativelanguage.googleapis.com/v1beta/openai",
    default_model: null, suggested_models: [], key_help: "在 Google AI Studio 建立 API 金鑰。模型名稱請依 Gemini API 目前提供的模型填寫。",
  },
  {
    id: "ollama", label: "Ollama 雲端", protocol: "ollama", base_url: "https://ollama.com",
    default_model: null, suggested_models: [], key_help: "在 ollama.com 的 Settings → Keys 建立。模型名稱可在 ollama.com 的雲端模型清單查到。",
  },
  {
    id: "openai_compatible", label: "其他 OpenAI 相容服務", protocol: "openai", base_url: null,
    default_model: null, suggested_models: [], key_help: "填入服務提供的 API 網址（通常以 /v1 結尾）與金鑰，服務需支援 Chat Completions。",
  },
];

export const providerById = (id: string) => PROVIDERS.find((p) => p.id === id) ?? null;

/**
 * Why a custom API address is unsafe, or null when it is fine: HTTPS on the standard port,
 * a public-looking domain name (never an IP address or an internal name), and nothing after
 * the path that could change where requests go. Local test runs may allow
 * http://localhost with AI_ALLOW_LOCAL_BASE_URL=true. The services are also called with
 * redirects refused, so an address cannot bounce requests elsewhere.
 */
export function baseUrlProblem(raw: string, allowLocal = false): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return "API 網址格式不正確。"; }
  // A bare "?" or "#" leaves u.search / u.hash empty, so look at the raw text too.
  if (u.username || u.password || /[?#]/.test(raw)) return "API 網址不可包含帳號密碼、查詢參數或 #。";
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (allowLocal && local && u.protocol === "http:") return null;
  if (u.protocol !== "https:") return "API 網址必須以 https:// 開頭。";
  if (u.port) return "API 網址請使用標準 HTTPS 連接埠（不指定連接埠）。";
  if (/^\d+(\.\d+){3}$/.test(host) || host.startsWith("[")) return "API 網址請使用網域名稱，不能是 IP 位址。";
  if (local || !host.includes(".") || u.hostname.endsWith(".")
    || /\.(local|internal|localhost|lan|home|corp|intranet|private)$/.test(host)) return "API 網址不能指向內部網路。";
  return null;
}

/** The address as stored and called: origin plus path, without a trailing slash. */
export function normalizeBaseUrl(raw: string): string {
  const u = new URL(raw);
  return `${u.origin}${u.pathname}`.replace(/\/+$/, "");
}

// ── Encryption of stored keys ────────────────────────────────────────────────

const enc = new TextEncoder();

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function sealingKey(secret: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("regreview"), info: enc.encode("company-ai-key-v1") },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

/** What a stored key is bound to: it only decrypts for this company, service and address. */
export interface KeyBinding {
  companyId: number;
  provider: string;
  baseUrl: string | null;
}

const bindingData = (b: KeyBinding) => enc.encode(JSON.stringify(["company-ai-key", b.companyId, b.provider, b.baseUrl ?? ""]));

/**
 * "v2.<iv>.<ciphertext>", base64. The company, service and address are authenticated
 * alongside, so changing any of them in the database (without the secret) makes the key
 * unreadable instead of sending it somewhere new.
 */
export async function sealKey(secret: string, binding: KeyBinding, apiKey: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: bindingData(binding) }, await sealingKey(secret), enc.encode(apiKey),
  );
  return `v2.${b64(iv)}.${b64(new Uint8Array(ct))}`;
}

/** The key, or null when it cannot be decrypted (wrong secret or binding, damaged). */
export async function openKey(secret: string, binding: KeyBinding, sealed: string): Promise<string | null> {
  const [v, iv, ct] = sealed.split(".");
  if (v !== "v2" || !iv || !ct) return null;
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(iv), additionalData: bindingData(binding) }, await sealingKey(secret), unb64(ct),
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

// ── Stored settings ──────────────────────────────────────────────────────────

export interface CompanyAiRow {
  provider: ProviderId;
  base_url: string | null;
  model: string;
  key_sealed: string;
  key_hint: string;
  updated_at: string;
  updated_by_name: string | null;
}

export async function companyAiRow(db: D1Database, companyId: number): Promise<CompanyAiRow | null> {
  return db.prepare(
    `SELECT a.provider, a.base_url, a.model, a.key_sealed, a.key_hint, a.updated_at, u.full_name AS updated_by_name
       FROM company_ai a LEFT JOIN user u ON u.id = a.updated_by WHERE a.company_id = ?`,
  ).bind(companyId).first<CompanyAiRow>();
}

/** The model call settings for a stored row, given its decrypted key. */
export function configFor(row: Pick<CompanyAiRow, "provider" | "base_url" | "model">, apiKey: string): AiConfig {
  const p = providerById(row.provider)!;
  return { protocol: p.protocol, apiKey, baseURL: row.base_url || p.base_url!, model: row.model, source: "company" };
}
