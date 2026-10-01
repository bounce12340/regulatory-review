// Minimal stand-in for the Anthropic Messages API (streaming), for offline tests of the
// AI analysis path. Start it, then run `wrangler dev` with
//   ANTHROPIC_API_KEY=test-key  ANTHROPIC_BASE_URL=http://127.0.0.1:8788
// GET /__last returns the last request (headers + body) so tests can assert on its shape.
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

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
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
    if (req.headers["x-api-key"] !== "test-key") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }));
      return;
    }
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    const text = JSON.stringify(result);
    sse(res, "message_start", {
      type: "message_start",
      message: { id: "msg_mock", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 12000, output_tokens: 1 } },
    });
    sse(res, "content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
    for (let i = 0; i < text.length; i += 80) {
      sse(res, "content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: text.slice(i, i + 80) } });
    }
    sse(res, "content_block_stop", { type: "content_block_stop", index: 0 });
    sse(res, "message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 900 } });
    sse(res, "message_stop", { type: "message_stop" });
    res.end();
  });
}).listen(PORT, "127.0.0.1", () => console.log(`mock anthropic on :${PORT}`));
