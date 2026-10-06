import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error plain browser modules without type declarations
import { Md5, md5 } from "../public/lib/md5.js";
// @ts-expect-error
import { Crc32, ZipWriter, readZip, streamBytes } from "../public/lib/zip.js";
// @ts-expect-error
import { parseXml } from "../public/lib/xml.js";
// @ts-expect-error
import { parseDtd, validate } from "../public/lib/dtd.js";
// @ts-expect-error
import { UTIL_FILES } from "../public/lib/ectd-spec.js";
// @ts-expect-error
import { envelopeProblems, indexXml, planPaths, twRegionalXml, writePackage } from "../public/lib/ectd-build.js";
// @ts-expect-error
import { loadBundledUtil, summarize, validateEntries, zipEntries } from "../public/lib/ectd-validate.js";

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), "../public/vendor/ectd/");
const vendor = (name: string) => readFileSync(VENDOR + name);
const enc = new TextEncoder();
const pdf = (version = "1.7", body = "x") => enc.encode(`%PDF-${version}\n%âãÏÓ\n1 0 obj<<>>endobj\n% ${body}\ntrailer<<>>\n%%EOF\n`);

type Doc = { key: string; node: string; title: string; filename: string; size: number; bytes: Uint8Array };

const env = () => ({
  identifier: "550e8400-e29b-41d4-a716-446655442895", objective: "new", unitType: "initial", tier1: "import", tier2: "new-drugs-application",
  applicant: "Example Pharma（虛擬）", cca: "MG00000000000005", phones: ["02-0000-0000"], emails: ["ra@example.test"],
  inventedNames: [{ name: "Examplin 10 mg", licenses: [], appNo: "2026100601", codes: ["202610060110mg"] }],
  inns: ["examplin"], sequence: "0000", relatedSequences: ["0000"], description: "測試序列",
});
const product = { substance: "Examplin", manufacturer: "Example Chem", product: "Examplin tablets", dosageForm: "tablet" };

function docs(): Doc[] {
  const list: [string, string, string][] = [
    ["1.1.1", "申請書", "form.pdf"], ["1.1.4", "RTF 查檢表", "rtf.pdf"], ["1.3.1.1", "中文仿單", "label.pdf"],
    ["2.3.s", "QOS 原料藥", "qos.pdf"], ["3.2.s.4.1", "原料藥規格", "spec.pdf"], ["3.2.s.4.2", "分析方法 1", "m1.pdf"],
    ["3.2.s.4.2", "分析方法 2", "m2.pdf"], ["3.2.p.8.3", "安定性數據", "stab.pdf"],
  ];
  return list.map(([node, title, filename], i) => {
    const bytes = pdf("1.7", filename);
    return { key: String(i), node, title, filename, size: bytes.length, bytes };
  });
}

/** Builds a package in memory and returns its bytes. */
async function build(mutate?: (path: string, data: Uint8Array) => Uint8Array) {
  const all = docs();
  const { placed, problems } = planPaths(all, product, "2026100601", "0000");
  expect(problems).toEqual([]);
  const parts: Uint8Array[] = [];
  await writePackage({
    env: env(), product, placed,
    sink: { write: async (c: Uint8Array | Blob) => { parts.push(c instanceof Blob ? new Uint8Array(await c.arrayBuffer()) : c); } },
    fetchDoc: async (d: Doc) => new Blob([all.find((x) => x.key === d.key)!.bytes]),
    fetchUtil: async (name: string) => new Blob([vendor(name)]),
  });
  const zip = new Blob(parts);
  if (!mutate) return zip;
  // Rewrite the archive with one entry changed.
  const out: Uint8Array[] = [];
  const w = new ZipWriter({ write: async (c: Uint8Array | Blob) => { out.push(c instanceof Blob ? new Uint8Array(await c.arrayBuffer()) : c); } });
  for (const e of await readZip(zip)) {
    const data = mutate(e.name, await streamBytes(e.stream()));
    if (data.length || !e.name.endsWith(".txt")) await w.add(e.name, data, new Crc32().update(data).value());
  }
  await w.finish();
  return new Blob(out);
}

async function check(zip: Blob, renames: [RegExp, string][] = []) {
  const entries = (await zipEntries(zip)).map((e: { path: string }) => ({ ...e, path: renames.reduce((p, [re, to]) => p.replace(re, to), e.path) }));
  const report = await validateEntries(entries);
  return { report, ...summarize(report), rules: [...new Set(summarize(report).refuse.map((x: { rule: string }) => x.rule))].sort() };
}

beforeAll(async () => {
  await loadBundledUtil(async (name: string) => new TextDecoder().decode(vendor(name)));
});

describe("md5", () => {
  it("matches node:crypto in one go and in pieces", () => {
    const data = new Uint8Array(100_003).map((_, i) => (i * 31) & 0xff);
    const ref = createHash("md5").update(data).digest("hex");
    expect(md5(data)).toBe(ref);
    const h = new Md5();
    for (let i = 0; i < data.length; i += 777) h.update(data.subarray(i, i + 777));
    expect(h.hex()).toBe(ref);
    expect(md5("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });

  it("vendored util files carry TFDA's published checksums", () => {
    for (const u of UTIL_FILES) expect(md5(new Uint8Array(vendor(u.path.split("/").pop())))).toBe(u.md5);
  });
});

describe("zip", () => {
  it("round-trips stored entries with UTF-8 names", async () => {
    const parts: Uint8Array[] = [];
    const w = new ZipWriter({ write: async (c: Uint8Array) => { parts.push(c); } });
    const a = enc.encode("hello");
    const b = enc.encode("中文內容");
    await w.add("a/b.txt", a, new Crc32().update(a).value());
    await w.add("資料/c.txt", b, new Crc32().update(b).value());
    await w.finish();
    const entries = await readZip(new Blob(parts));
    expect(entries.map((e: { name: string }) => e.name)).toEqual(["a/b.txt", "資料/c.txt"]);
    expect(new TextDecoder().decode(await streamBytes(entries[1].stream()))).toBe("中文內容");
    expect(entries[0].crc).toBe(new Crc32().update(a).value());
  });
});

describe("DTD validation", () => {
  const tw = parseDtd(vendor("tw-regional.dtd").toString(), (s: string) => vendor(s).toString());
  const ich = parseDtd(vendor("ich-ectd-3-2.dtd").toString());
  const placed = planPaths(docs(), product).placed.map((d: Doc) => ({ ...d, md5: "0".repeat(32) }));
  const twXml = twRegionalXml(env(), placed.filter((d: { path: string }) => d.path.startsWith("m1/")));
  const ixXml = indexXml("0".repeat(32), placed.filter((d: { path: string }) => !d.path.startsWith("m1/")), product);

  it("generated tw-regional.xml and index.xml are valid", () => {
    expect(validate(parseXml(twXml), tw, "tw:tw-backbone")).toEqual([]);
    expect(validate(parseXml(ixXml), ich, "ectd:ectd")).toEqual([]);
  });

  it("catches wrong order, missing elements and bad attribute values", () => {
    const errs = (xml: string, dtd = tw, root = "tw:tw-backbone") => validate(parseXml(xml), dtd, root).map((e: { message: string }) => e.message).join("\n");
    expect(errs(twXml.replace(/<m1-1-1-form>[\s\S]*?<\/m1-1-1-form>\n/, ""))).toMatch("m1-1-offdoc");
    expect(errs(twXml.replace('objective="new"', 'objective="newer"'))).toMatch("objective");
    expect(errs(twXml.replace(/ checksum="0+"/, ""))).toMatch("checksum");
    expect(errs(ixXml.replace(/ substance="[^"]*"/, ""), ich, "ectd:ectd")).toMatch("substance");
    expect(errs(ixXml.replace('dtd-version="3.2"', 'dtd-version="3.1"'), ich, "ectd:ectd")).toMatch("dtd-version");
  });

  it("reports malformed XML with a line number", () => {
    expect(() => parseXml("<a>\n<b></a>")).toThrow(/第 2 行/);
  });
});

describe("planPaths", () => {
  it("names files per TW 附件一 and ICH Appendix 4", () => {
    const { placed } = planPaths(docs(), product, "2026100601", "0000");
    const paths = placed.map((d: { path: string }) => d.path);
    expect(paths).toContain("m1/tw/11-offdoc/111-form/form-form.pdf");
    expect(paths).toContain("m1/tw/11-offdoc/114-rtfcheck/rtfcheck-rtf.pdf");
    expect(paths).toContain("m2/23-qos/drug-substance.pdf");
    expect(paths).toContain("m3/32-body-data/32s-drug-sub/examplin-example-chem/32s4-contr-drug-sub/32s41-spec/specification.pdf");
    expect(paths).toContain("m3/32-body-data/32s-drug-sub/examplin-example-chem/32s4-contr-drug-sub/32s42-analyt-proc/analytical-procedure-1.pdf");
    expect(paths).toContain("m3/32-body-data/32s-drug-sub/examplin-example-chem/32s4-contr-drug-sub/32s42-analyt-proc/analytical-procedure-2.pdf");
    for (const p of paths) for (const seg of p.split("/")) expect(seg.length).toBeLessThanOrEqual(64);
  });

  it("refuses Word files and headings that take no files", () => {
    const base = { key: "x", title: "t", size: 10 };
    expect(planPaths([{ ...base, node: "1.1.1", filename: "a.docx" }], product).problems[0].message).toMatch("PDF");
    expect(planPaths([{ ...base, node: "1.2", filename: "a.pdf" }], product).problems[0].message).toMatch("不可放檔案");
  });

  it("keeps every path within 180 characters even with long names (O.3)", () => {
    const long = { ...product, substance: "x".repeat(80), manufacturer: "m".repeat(80), product: "y".repeat(80) };
    // @ts-expect-error plain browser module
    return import("../public/lib/ectd-spec.js").then(({ PLACEABLE }) => {
      const all = PLACEABLE.map((n: { node: string }, i: number) => ({ key: String(i), node: n.node, title: "t", filename: `${"z".repeat(90)}.pdf`, size: 1 }));
      const { placed, problems } = planPaths(all, long, "2026100601", "0000");
      expect(problems).toEqual([]);
      for (const d of placed) expect(`2026100601/0000/${d.path}`.length).toBeLessThanOrEqual(180);
    });
  });
});

describe("envelopeProblems", () => {
  it("accepts a complete initial envelope", () => {
    expect(envelopeProblems(env())).toEqual([]);
  });
  it("applies rules N.1, N.2 and N.4", () => {
    expect(envelopeProblems({ ...env(), relatedSequences: ["0001"] }).join()).toMatch("相關序列須等於本序列");
    expect(envelopeProblems({ ...env(), unitType: "response", sequence: "0001", relatedSequences: ["0001"] }).join()).toMatch("不可等於本序列");
    expect(envelopeProblems({ ...env(), objective: "change" }).join()).toMatch("許可證字號");
  });
});

describe("validator (TFDA rules A–P)", () => {
  it("passes a package built by the packager", async () => {
    const { refuse, remind, report } = await check(await build());
    expect(refuse).toEqual([]);
    expect(remind.map((x: { rule: string }) => x.rule)).toContain("P.BP4"); // test PDFs are not linearized
    expect(report.sequences[0].stats.leaves).toBe(9);
    expect(report.sequences[0].envelope.inventedNames[0].appNo).toBe("2026100601");
  });

  it("detects a document changed after the XML was written (K.2)", async () => {
    const zip = await build((p, d) => (p.endsWith("specification.pdf") ? pdf("1.7", "changed") : d));
    expect((await check(zip)).rules).toEqual(["K.2"]);
  });

  it("detects old PDF versions and broken PDFs (P.1, P.2)", async () => {
    const zip = await build((p, d) => (p.endsWith("form-form.pdf") ? pdf("1.3") : p.endsWith("rtfcheck-rtf.pdf") ? enc.encode("not a pdf") : d));
    expect((await check(zip)).rules).toEqual(expect.arrayContaining(["K.2", "P.1", "P.2"]));
  });

  it("detects a changed util file and a changed index.xml (C.3, H.3)", async () => {
    const zip = await build((p, d) => (p.endsWith("tw-regional.dtd") ? new Uint8Array([...d, 32]) : p.endsWith("index.xml") ? new Uint8Array([...d, 10]) : d));
    expect((await check(zip)).rules).toEqual(["C.3", "H.3"]);
  });

  it("detects naming, unreferenced files and folder problems (O.6, O.8, O.9, O.12, M.3)", async () => {
    const zip = await build();
    const renamed = await check(zip, [[/^2026100601\/0000\/m3\/(.*)specification\.pdf$/, "2026100601/0000/m3/$1Specification.pdf"]]);
    expect(renamed.rules).toEqual(expect.arrayContaining(["K.6", "O.6", "O.8"]));
    const noTop = await check(zip, [[/^2026100601\//, ""]]);
    expect(noTop.rules).toContain("O.12");
    const wrongSeq = await check(zip, [[/^2026100601\/0000\//, "2026100601/0001/"]]);
    expect(wrongSeq.rules).toEqual(expect.arrayContaining(["M.3", "N.1"]));
    const stray = await check(zip, [[/^2026100601\/0000\/util\/style\/ectd-2-0\.xsl$/, "2026100601/0000/ectd-2-0.xsl"]]);
    expect(stray.rules).toEqual(expect.arrayContaining(["B.2", "O.9"]));
  });

  it("says where index.xml is when there is no sequence folder (G.1)", async () => {
    const zip = await build();
    const { rules } = await check(zip, [[/^2026100601\/0000\//, "2026100601/seq-a/"]]);
    expect(rules).toEqual(["G.1"]);
  });
});
