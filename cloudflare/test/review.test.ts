import { describe, expect, it } from "vitest";
import { documentsBlock, parseItemReview } from "../src/ai";

describe("parseItemReview", () => {
  it("accepts a well-formed reply wrapped in prose", () => {
    const r = parseItemReview('結果如下：```json\n{"verdict":"revise","summary":"規格不一致","findings":[{"criterion":1,"status":"not_met","note":"x"}],"fixes":["修正規格"]}\n```', 3);
    expect(r).toEqual({ verdict: "revise", summary: "規格不一致", findings: [{ criterion: 1, status: "not_met", note: "x" }], fixes: ["修正規格"] });
  });

  it("does not let a pass stand when a criterion is unmet", () => {
    const r = parseItemReview('{"verdict":"pass","summary":"ok","findings":[{"criterion":2,"status":"not_met","note":"缺"}],"fixes":[]}', 2);
    expect(r?.verdict).toBe("revise");
  });

  it("repairs out-of-range criteria and unknown statuses", () => {
    const r = parseItemReview('{"verdict":"insufficient","summary":"s","findings":[{"criterion":9,"status":"maybe","note":"n"}],"fixes":"not a list"}', 2);
    expect(r?.findings).toEqual([{ criterion: 2, status: "unclear", note: "n" }]);
    expect(r?.fixes).toEqual([]);
  });

  it("rejects replies without a verdict", () => {
    expect(parseItemReview('{"summary":"s"}', 1)).toBeNull();
    expect(parseItemReview("not json", 1)).toBeNull();
  });
});

describe("documentsBlock", () => {
  it("shares the text budget across files and notes unreadable ones", () => {
    const block = documentsBlock([
      { filename: "a.pdf", text: "A".repeat(1000), text_status: "ok" },
      { filename: "b.pdf", text: "B".repeat(10), text_status: "ok" },
      { filename: "scan.pdf", text: null, text_status: "scanned" },
    ], 200);
    expect(block).toContain('filename="a.pdf"');
    expect(block).toContain("B".repeat(10));
    expect(block).toContain("原文共 1,000 字元");
    expect(block).toContain('filename="scan.pdf" unreadable="true"');
    expect(block).toContain("掃描檔");
    expect((block.match(/A/g) ?? []).length).toBe(100);
  });
});
