// Minimal stand-in for Ollama's cloud chat API (POST /api/chat, NDJSON streaming), for
// offline tests of the AI analysis path. Start it, then run `wrangler dev` with
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
    const text = body.model === "mock-broken-once" && !retry
      ? "抱歉，以下是分析結果：缺少安全性試驗報告。"
      : `以下是分析結果：\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
    res.writeHead(200, { "Content-Type": "application/x-ndjson" });
    for (let i = 0; i < text.length; i += 80) {
      res.write(JSON.stringify({ model: body.model, message: { role: "assistant", content: text.slice(i, i + 80) }, done: false }) + "\n");
    }
    res.end(JSON.stringify({ model: body.model, message: { role: "assistant", content: "" }, done: true, done_reason: "stop", prompt_eval_count: 12000, eval_count: 900 }) + "\n");
  });
}).listen(PORT, "127.0.0.1", () => console.log(`mock ollama on :${PORT}`));
