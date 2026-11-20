/**
 * One chat call to the AI service in use: the system's Ollama account, or the service a
 * company configured with its own key (Anthropic Claude, OpenAI, Google Gemini, Ollama, or
 * any OpenAI-compatible endpoint). Callers get the whole reply text, the model that
 * answered and token usage, or an AnalysisError with a message fit for the user.
 */

import Anthropic from "@anthropic-ai/sdk";

const REQUEST_TIMEOUT_MS = 5 * 60_000;

export class AnalysisError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

/** How a service is called. Gemini and most other services speak the OpenAI protocol. */
export type Protocol = "ollama" | "openai" | "anthropic";

export interface AiConfig {
  protocol: Protocol;
  apiKey: string;
  baseURL: string;
  model: string;
  /** Who set the key up, so error messages point to the right fix. */
  source: "system" | "company";
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface ChatReply {
  content: string;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

export interface ChatOptions {
  /** Short calls (a key check) ask for less output and less thinking. */
  brief?: boolean;
}

type Usage = ChatReply["usage"];

/** Sends one conversation and returns the whole reply; adds to `prior` usage. */
export function chat(cfg: AiConfig, messages: ChatMessage[], prior: Usage = { input_tokens: 0, output_tokens: 0 }, opts: ChatOptions = {}): Promise<ChatReply> {
  switch (cfg.protocol) {
    case "anthropic": return chatAnthropic(cfg, messages, prior, opts);
    case "openai": return chatOpenAI(cfg, messages, prior, opts);
    default: return chatOllama(cfg, messages, prior);
  }
}

const fixKey = (cfg: AiConfig) => (cfg.source === "company" ? "請管理員在「AI 模型設定」檢查金鑰" : "請管理員檢查 OLLAMA_API_KEY");
const fixModel = (cfg: AiConfig) => (cfg.source === "company" ? "請管理員在「AI 模型設定」檢查模型名稱" : "請管理員檢查 AI_MODEL");
const TRUNCATED = "AI 回應超過長度上限而被截斷，請改上傳較小的文件或分段分析。";
const TIMEOUT = "AI 服務回應逾時，請改上傳較小的文件或稍後再試。";

/** The usual HTTP failures of any of the services, in the user's terms. */
function httpError(cfg: AiConfig, status: number, detail: string): AnalysisError {
  if (status === 401 || status === 403) return new AnalysisError(`AI 服務金鑰無效或沒有權限，${fixKey(cfg)}。`, 503);
  if (status === 404) return new AnalysisError(`找不到 AI 模型「${cfg.model}」，${fixModel(cfg)}。`, 503);
  if (status === 429) return new AnalysisError("AI 服務請求過於頻繁或已達用量上限，請稍後再試。", 429);
  if (status === 400 || status === 422) return new AnalysisError(`AI 服務拒絕此請求：${detail || "未知錯誤"}`, 400);
  if (status === 413) return new AnalysisError("文件內容超過此模型能處理的長度，請減少文件或分次分析。", 413);
  return new AnalysisError(`AI 服務錯誤（${status}），請稍後再試。`);
}

// ── Anthropic Claude (Messages API, official SDK) ────────────────────────────

/** Models that accept the effort setting; older ones reject it. */
const EFFORT_MODELS = /^claude-(opus|sonnet|haiku|fable|mythos)-(5|4-[6-9])/;
/** Models with server-side refusal fallbacks: a policy decline is retried on a fallback model. */
const FALLBACK_MODELS = new Set(["claude-fable-5-2", "claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

/**
 * The conversation as one user turn. The JSON retry sends the earlier reply back; folding
 * it into the user turn keeps the request free of edited assistant history, which newer
 * models check against the thinking that produced it.
 */
function singleUserTurn(messages: ChatMessage[]): string {
  const turns = messages.filter((m) => m.role !== "system");
  if (turns.length === 1) return turns[0].content;
  return turns.map((m) => (m.role === "assistant" ? `<previous_reply>\n${m.content}\n</previous_reply>` : m.content)).join("\n\n");
}

async function chatAnthropic(cfg: AiConfig, messages: ChatMessage[], prior: Usage, opts: ChatOptions): Promise<ChatReply> {
  const client = new Anthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const fallback = FALLBACK_MODELS.has(cfg.model);
  let message: Anthropic.Beta.BetaMessage;
  try {
    // Streaming keeps long document reviews clear of HTTP timeouts; only the final message is used.
    const stream = client.beta.messages.stream({
      model: cfg.model,
      max_tokens: opts.brief ? 2048 : 32000,
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: singleUserTurn(messages) }],
      ...(EFFORT_MODELS.test(cfg.model) ? { output_config: { effort: opts.brief ? "low" : "high" } } : {}),
      ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
    });
    message = await stream.finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.APIConnectionTimeoutError) throw new AnalysisError(TIMEOUT, 504);
    if (err instanceof Anthropic.APIConnectionError) throw new AnalysisError("無法連線至 AI 服務，請稍後再試。");
    if (err instanceof Anthropic.APIError && typeof err.status === "number") {
      const detail = (err.error as { error?: { message?: string } } | undefined)?.error?.message ?? err.message;
      throw httpError(cfg, err.status, String(detail).slice(0, 300));
    }
    throw err;
  }
  if (message.stop_reason === "refusal") {
    throw new AnalysisError("AI 模型依其安全政策拒絕處理這份內容，請檢查文件內容或改用其他模型。", 422);
  }
  if (message.stop_reason === "max_tokens") throw new AnalysisError(TRUNCATED, 422);
  if (message.stop_reason === "model_context_window_exceeded") {
    throw new AnalysisError("文件內容超過此模型能處理的長度，請減少文件或分次分析。", 413);
  }
  const content = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return {
    content,
    model: message.model,
    usage: {
      input_tokens: prior.input_tokens + message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0),
      output_tokens: prior.output_tokens + message.usage.output_tokens,
    },
  };
}

// ── OpenAI-compatible Chat Completions (OpenAI, Gemini, and others) ──────────

async function chatOpenAI(cfg: AiConfig, messages: ChatMessage[], prior: Usage, opts: ChatOptions): Promise<ChatReply> {
  let res: Response;
  try {
    res = await fetch(`${cfg.baseURL.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      // No temperature: several current reasoning models accept only their default.
      body: JSON.stringify({ model: cfg.model, messages }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") throw new AnalysisError(TIMEOUT, 504);
    throw new AnalysisError("無法連線至 AI 服務，請稍後再試。");
  }
  const text = await res.text().catch(() => "");
  let body: Record<string, unknown> | null = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  const errBody = body?.error as { message?: string } | string | undefined;
  const detail = (typeof errBody === "string" ? errBody : errBody?.message ?? text).slice(0, 300);
  if (!res.ok) throw httpError(cfg, res.status, detail);
  if (!body) throw new AnalysisError("AI 服務回應格式無法解析，請確認服務網址是否為 OpenAI 相容端點。");
  const choice = (body.choices as Array<{ message?: { content?: unknown; refusal?: unknown }; finish_reason?: string }> | undefined)?.[0];
  if (!choice) throw new AnalysisError(`AI 服務沒有回傳結果：${detail}`);
  if (choice.finish_reason === "length") throw new AnalysisError(TRUNCATED, 422);
  if (typeof choice.message?.refusal === "string" && choice.message.refusal) {
    throw new AnalysisError("AI 模型依其安全政策拒絕處理這份內容，請檢查文件內容或改用其他模型。", 422);
  }
  const usage = body.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
  return {
    content: typeof choice.message?.content === "string" ? choice.message.content : "",
    model: typeof body.model === "string" ? body.model : cfg.model,
    usage: {
      input_tokens: prior.input_tokens + Number(usage?.prompt_tokens ?? 0),
      output_tokens: prior.output_tokens + Number(usage?.completion_tokens ?? 0),
    },
  };
}

// ── Ollama (POST /api/chat, NDJSON streaming) ────────────────────────────────

async function chatOllama(cfg: AiConfig, messages: ChatMessage[], prior: Usage): Promise<ChatReply> {
  let res: Response;
  try {
    res = await fetch(`${cfg.baseURL.replace(/\/+$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      // Streaming keeps the connection busy on long documents; we only keep the final text.
      body: JSON.stringify({ model: cfg.model, messages, stream: true, options: { temperature: 0.2 } }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") throw new AnalysisError(TIMEOUT, 504);
    throw new AnalysisError("無法連線至 AI 服務，請稍後再試。");
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw httpError(cfg, res.status, errorMessage(detail));
  }

  let content = "";
  let model = cfg.model;
  let doneReason = "";
  const usage = { ...prior };
  for await (const line of ndjsonLines(res.body!)) {
    let chunk: Record<string, unknown>;
    try { chunk = JSON.parse(line); } catch { continue; }
    if (typeof chunk.error === "string") throw new AnalysisError(`AI 服務錯誤：${chunk.error}`);
    const msg = chunk.message as { content?: string } | undefined;
    if (typeof msg?.content === "string") content += msg.content;
    if (typeof chunk.model === "string") model = chunk.model;
    if (chunk.done) {
      doneReason = String(chunk.done_reason ?? "");
      usage.input_tokens += Number(chunk.prompt_eval_count ?? 0);
      usage.output_tokens += Number(chunk.eval_count ?? 0);
    }
  }
  if (doneReason === "length") throw new AnalysisError(TRUNCATED, 422);
  return { content, model, usage };
}

async function* ndjsonLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) yield line;
    }
  }
  if (buf.trim()) yield buf.trim();
}

function errorMessage(body: string): string {
  try { return String(JSON.parse(body).error ?? body); } catch { return body || "未知錯誤"; }
}

/** A tiny request that proves the key and model work, before a company saves them. */
export async function checkConnection(cfg: AiConfig): Promise<{ model: string }> {
  const reply = await chat(cfg, [{ role: "user", content: "這是連線測試。請只回覆「OK」。" }], undefined, { brief: true });
  return { model: reply.model };
}
