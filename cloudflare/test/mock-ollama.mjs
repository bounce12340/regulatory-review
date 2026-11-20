// Minimal stand-in for Ollama's cloud chat API (POST /api/chat, NDJSON streaming), for
// offline tests of the AI analysis path. It also answers like an OpenAI-compatible service
// (POST /v1/chat/completions, key "byok-openai-key") and like Anthropic's Messages API
// (POST /v1/messages with SSE streaming, key "byok-anthropic-key"), for companies' own
// AI services. Model "missing-model" answers 404; Anthropic model "refuse-model" refuses. Start it, then run `wrangler dev` with
//   OLLAMA_API_KEY=test-key  AI_BASE_URL=http://127.0.0.1:8788
// GET /__last returns the last request (headers + body) so tests can assert on its shape.
//
// Like a real model without schema enforcement, the first reply wraps the JSON in prose
// and a code fence. With model "mock-broken-once" the first reply is not JSON at all,
// to exercise the Worker's single retry.
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 8788);
let last = null;

const result = {
  completeness_score: 62,
  gaps: [
    { requirement_key: "item3", requirement: "原料規格及來源證明", status: "missing", severity: "medium", explanation: "未附原料來源證明。", recommendation: "補附供應商 COA 與來源證明。" },
    { requirement_key: "item5", requirement: "衛生安全性試驗報告", status: "missing", severity: "high", explanation: "文件未提及安全性試驗。", recommendation: "委託認證實驗室完成試驗。" },
  ],
  compliant_items: ["item1", "item2"],
  risk_assessment: "high",
  estimated_review_time: "8–12 小時",
  summary: "文件具備業者登錄與配方說明，但缺少安全性試驗報告。",
  action_items: ["補齊衛生安全性試驗報告", "補附原料來源證明"],
};

// Reply for a per-item review (whole-case review); chosen when the prompt asks for one.
const review = {
  verdict: "insufficient",
  summary: "安定性資料只有 3 個月長期試驗，未達 6 個月。",
  findings: [
    { criterion: 1, status: "not_met", note: "長期試驗只到 3 個月。" },
    { criterion: 2, status: "met", note: "試驗條件與方法有說明。" },
  ],
  fixes: ["補齊三批 6 個月長期與 6 個月加速安定性數據。"],
};

/** The reply text for a request: a key check, a per-item review or a gap report. */
function replyText(contents, retry, model) {
  const all = contents.join("\n");
  if (all.includes("這是連線測試")) return "OK";
  const payload = all.includes("## 審查門檻") ? review : result;
  if (model === "mock-broken-once" && !retry) return "抱歉，以下是分析結果：缺少安全性試驗報告。";
  return `以下是分析結果：\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
}

function openAiCompatible(body, req, res) {
  const json = (status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
  if (req.headers.authorization !== "Bearer byok-openai-key") return json(401, { error: { message: "Incorrect API key provided", type: "invalid_request_error" } });
  if (body.model === "missing-model") return json(404, { error: { message: "The model `missing-model` does not exist", type: "invalid_request_error" } });
  const retry = body.messages.some((m) => m.role === "assistant");
  const text = replyText(body.messages.map((m) => m.content), retry, body.model);
  json(200, {
    id: "chatcmpl-mock", object: "chat.completion", model: `${body.model}-2026`,
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage: { prompt_tokens: 11000, completion_tokens: 800, total_tokens: 11800 },
  });
}

function anthropicMessages(body, req, res) {
  const json = (status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
  // Current SDKs send the key as a bearer token; older ones as x-api-key.
  const key = req.headers["x-api-key"] ?? (req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (key !== "byok-anthropic-key") return json(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } });
  if (body.model === "missing-model") return json(404, { type: "error", error: { type: "not_found_error", message: "model: missing-model" } });
  const contents = [typeof body.system === "string" ? body.system : "", ...body.messages.map((m) => (typeof m.content === "string" ? m.content : ""))];
  const retry = contents.some((c) => c.includes("<previous_reply>"));
  const refuse = body.model === "refuse-model";
  const text = refuse ? "" : replyText(contents, retry, body.model);
  if (!body.stream) return json(400, { type: "error", error: { type: "invalid_request_error", message: "mock expects stream: true" } });
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`);
  send("message_start", { message: { id: "msg_mock", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10000, output_tokens: 1 } } });
  send("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
  for (let i = 0; i < text.length; i += 80) send("content_block_delta", { index: 0, delta: { type: "text_delta", text: text.slice(i, i + 80) } });
  send("content_block_stop", { index: 0 });
  send("message_delta", { delta: { stop_reason: refuse ? "refusal" : "end_turn", stop_sequence: null }, usage: { output_tokens: 700 } });
  send("message_stop", {});
  res.end();
}

http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/__last") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(last));
    return;
  }
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw || "{}");
    last = { url: req.url, headers: req.headers, body };
    if (req.url === "/v1/chat/completions") return openAiCompatible(body, req, res);
    if (req.url === "/v1/messages") return anthropicMessages(body, req, res);
    if (req.url !== "/api/chat") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    if (req.headers.authorization !== "Bearer test-key") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    const retry = body.messages.some((m) => m.role === "assistant");
    const isReview = body.messages.some((m) => m.role === "user" && m.content.includes("## 審查門檻"));
    const payload = isReview ? review : result;
    const text = body.model === "mock-broken-once" && !retry
      ? "抱歉，以下是分析結果：缺少安全性試驗報告。"
      : `以下是分析結果：\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
    res.writeHead(200, { "Content-Type": "application/x-ndjson" });
    for (let i = 0; i < text.length; i += 80) {
      res.write(JSON.stringify({ model: body.model, message: { role: "assistant", content: text.slice(i, i + 80) }, done: false }) + "\n");
    }
    res.end(JSON.stringify({ model: body.model, message: { role: "assistant", content: "" }, done: true, done_reason: "stop", prompt_eval_count: 12000, eval_count: 900 }) + "\n");
  });
}).listen(PORT, "127.0.0.1", () => console.log(`mock ollama on :${PORT}`));
