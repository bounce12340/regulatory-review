// Module 4/5 packaging: study reports grouped in node extensions (TFDA eCTD-R2.1; ICH eCTD
// V3.2.2 Appendix 4), checked against the official DTD and the TFDA validation rules.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error plain browser modules without type declarations
import { planPaths, writePackage } from "../public/lib/ectd-build.js";
// @ts-expect-error
import { lifecycleFindings } from "../public/lib/ectd-lifecycle.js";
// @ts-expect-error
import { loadBundledUtil, summarize, validateEntries, zipEntries } from "../public/lib/ectd-validate.js";
// @ts-expect-error
import { readZip, streamBytes } from "../public/lib/zip.js";
// @ts-expect-error
import { ICH_NODES, PLACEABLE } from "../public/lib/ectd-spec.js";

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), "../public/vendor/ectd/");
const vendor = (name: string) => readFileSync(VENDOR + name);
const enc = new TextEncoder();
const pdf = (body: string) => enc.encode(`%PDF-1.7\n1 0 obj<<>>endobj\n% ${body}\ntrailer<<>>\n%%EOF\n`);
const UUID = "550e8400-e29b-41d4-a716-446655442895";
const product = { substance: "Examplin", manufacturer: "Example Chem", product: "Examplin tablets", indication: "Hypertension" };

type Leaf = { id: string; xml: string; node: string; title: string; op: string; modifiedFile: string | null; section: string; extension: boolean; path: string | null };
type Manifest = { sequence: string; uuid: string; leaves: Leaf[] };
type Doc = { key: string; node: string; title: string; filename: string; size: number; bytes: Uint8Array; study?: string; target?: unknown };

const env = (sequence: string) => ({
  identifier: UUID, objective: "new", unitType: sequence === "0000" ? "initial" : "response",
  applicant: "Example Pharma", cca: "MG00000000000005", phones: ["02-0000-0000"], emails: ["ra@example.test"],
  inventedNames: [{ name: "Examplin 10 mg", licenses: [], appNo: "2026100601", codes: ["202610060110mg"] }],
  inns: ["examplin"], sequence, relatedSequences: ["0000"], description: "測試",
});

function doc(key: string, node: string, title: string, filename: string, study?: string, body = title): Doc {
  const bytes = pdf(body);
  return { key, node, title, filename, size: bytes.length, bytes, study };
}

async function build(sequence: string, docs: Doc[], deletes: unknown[] = []) {
  const { placed, problems } = planPaths(docs, product, "2026100601", sequence);
  expect(problems).toEqual([]);
  const parts: Uint8Array[] = [];
  const res = await writePackage({
    env: env(sequence), product, placed, deletes,
    sink: { write: async (c: Uint8Array | Blob) => { parts.push(c instanceof Blob ? new Uint8Array(await c.arrayBuffer()) : c); } },
    fetchDoc: async (d: Doc) => new Blob([docs.find((x) => x.key === d.key)!.bytes]),
    fetchUtil: async (name: string) => new Blob([vendor(name)]),
  });
  return { zip: new Blob(parts), manifest: res.manifest as Manifest };
}

const findings = async (zip: Blob, history: Manifest[] = []) => summarize(await validateEntries(await zipEntries(zip), { history }));
const rules = (list: { rule: string }[]) => [...new Set(list.map((x) => x.rule))].sort();
// The test PDFs are not linearized ("fast web view"), a reminder unrelated to Module 4/5.
const reminders = (list: { rule: string }[]) => rules(list).filter((r) => r !== "P.BP4");

/** Unzips and runs xmllint --valid on index.xml (skipped where xmllint is not installed). */
async function xmllint(zip: Blob, sequence: string) {
  const dir = mkdtempSync(join(tmpdir(), "ectd-m45-"));
  try {
    for (const e of await readZip(zip)) {
      const p = join(dir, e.name);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, await streamBytes(e.stream()));
    }
    const seq = join(dir, `2026100601/${sequence}`);
    try {
      execFileSync("xmllint", ["--noout", "--valid", "index.xml"], { cwd: seq, stdio: "pipe" });
    } catch (err) {
      if ((err as { code?: string }).code !== "ENOENT") throw new Error(String((err as { stderr?: Buffer }).stderr ?? err));
    }
    return readFileSync(join(seq, "index.xml"), "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const S0 = [
  doc("1", "1.1.1", "申請書", "form.pdf"),
  doc("10", "4.2.3.2", "28-Day Oral Toxicity Study in Rats", "4.2.3.2 TOX-028 report.pdf", "TOX-028"),
  doc("11", "4.2.3.2", "TOX-028 Amendment 1", "amendment.pdf", "TOX-028"),
  doc("12", "4.2.3.2", "13-Week Dog Study", "report.pdf", "TOX-091 13-week dog study"),
  doc("13", "4.3", "Literature 1", "smith-2019.pdf"),
  doc("20", "5.2", "Tabular Listing", "listing.pdf"),
  doc("21", "5.3.5.1", "EXA-301 Clinical Study Report", "5.3.5.1_EXA-301_CSR.pdf", "EXA-301"),
  doc("22", "5.3.5.1", "EXA-301 Protocol", "protocol.pdf", "EXA-301"),
  doc("23", "5.3.5.1", "EXA-302 Clinical Study Report", "csr.pdf", "EXA-302"),
  doc("24", "5.3.1.2", "BE Study", "be.pdf", "BE-101"),
  // A study whose title has no Latin letters still gets a folder.
  doc("25", "5.3.5.2", "開放性延伸試驗報告", "報告.pdf", "開放性延伸試驗"),
  doc("26", "5.4", "Reference 1", "ref.pdf"),
];

let s0: { zip: Blob; manifest: Manifest };
beforeAll(async () => {
  await loadBundledUtil(async (name: string) => new TextDecoder().decode(vendor(name)));
  s0 = await build("0000", S0);
});

describe("Module 4/5 sections", () => {
  it("covers TFDA 表十一／表十二 with the ICH elements, and only leaf sections take documents", () => {
    const m45 = ICH_NODES.filter((n: { module: number }) => n.module >= 4);
    expect(m45.length).toBe(69);
    expect(PLACEABLE.filter((n: { module: number }) => n.module >= 4).length).toBe(53);
    expect(m45.find((n: { node: string }) => n.node === "5.3.5.1").study).toBe("folder");
    expect(m45.find((n: { node: string }) => n.node === "4.2.3.2").study).toBe("prefix");
    expect(m45.find((n: { node: string }) => n.node === "5.4").study).toBeNull();
  });

  it("names files after Appendix 4: per-study folders in M5, study-prefixed names in M4", () => {
    const { placed } = planPaths(S0, product, "2026100601", "0000");
    const path = (key: string) => placed.find((p: { key: string }) => p.key === key).path;
    expect(path("10")).toBe("m4/42-stud-rep/423-tox/4232-repeat-dose-tox/tox-028-report.pdf");
    expect(path("11")).toBe("m4/42-stud-rep/423-tox/4232-repeat-dose-tox/tox-028-amendment.pdf");
    expect(path("12")).toBe("m4/42-stud-rep/423-tox/4232-repeat-dose-tox/tox-091-13-week-dog-study-report.pdf");
    expect(path("13")).toBe("m4/43-lit-ref/reference.pdf");
    expect(path("20")).toBe("m5/52-tab-list/tabular-listing.pdf");
    expect(path("21")).toBe("m5/53-clin-stud-rep/535-rep-effic-safety-stud/hypertension/5351-stud-rep-contr/exa-301/csr.pdf");
    expect(path("22")).toBe("m5/53-clin-stud-rep/535-rep-effic-safety-stud/hypertension/5351-stud-rep-contr/exa-301/protocol.pdf");
    expect(path("23")).toBe("m5/53-clin-stud-rep/535-rep-effic-safety-stud/hypertension/5351-stud-rep-contr/exa-302/csr.pdf");
    expect(path("24")).toBe("m5/53-clin-stud-rep/531-rep-biopharm-stud/5312-compar-ba-be-stud-rep/be-101/be.pdf");
    expect(path("25")).toBe("m5/53-clin-stud-rep/535-rep-effic-safety-stud/hypertension/5352-stud-rep-uncontr/study-1/study-report.pdf");
  });

  it("writes one titled node extension per study, valid against the ICH DTD", async () => {
    const index = await xmllint(s0.zip, "0000");
    expect(index).toMatch(/<m5-3-5-reports-of-efficacy-and-safety-studies indication="Hypertension">/);
    expect((index.match(/<node-extension /g) ?? []).length).toBe(6);
    expect(index).toMatch(/<node-extension ID="s0000-x5\.3\.5\.1-1">\n\s+<title>EXA-301<\/title>\n\s+<leaf ID="s0000-a21"/);
    // Literature references sit directly in their section.
    expect(index).toMatch(/<m4-3-literature-references>\n\s+<leaf ID="s0000-a13"/);
  });

  it("passes every TFDA rule, L.1 included", async () => {
    const r = await findings(s0.zip);
    expect(rules(r.refuse)).toEqual([]);
    expect(reminders(r.remind)).toEqual([]);
  });

  it("records study leaves in the manifest with their node extension", () => {
    const l = s0.manifest.leaves.find((x) => x.id === "s0000-a22")!;
    expect(l.node).toBe("5.3.5.1");
    expect(l.extension).toBe(true);
    expect(l.section).toMatch(/m5-3-5-reports-of-efficacy-and-safety-studies\[indication=Hypertension\]\/m5-3-5-1-.*\/node-extension\[EXA-301\]$/);
  });
});

describe("a response sequence for Module 5", () => {
  const t = (id: string) => ({ sequence: "0000", xml: "index", id });
  it("replaces and deletes documents inside a study without lifecycle findings", async () => {
    const replace = { ...doc("30", "5.3.5.1", "EXA-301 Clinical Study Report (corrected)", "csr-v2.pdf", "EXA-301", "v2"), target: t("s0000-a21") };
    const s1 = await build("0001", [doc("31", "1.1.1", "補件回復函", "reply.pdf"), replace],
      [{ key: "0000-s0000-a12", node: "4.2.3.2", title: "13-Week Dog Study", study: "TOX-091 13-week dog study", target: t("s0000-a12") }]);
    const index = await xmllint(s1.zip, "0001");
    expect(index).toMatch(/<title>TOX-091 13-week dog study<\/title>\n\s+<leaf ID="s0001-d0000-s0000-a12" operation="delete"/);
    const r = await findings(s1.zip, [s0.manifest]);
    expect(rules(r.refuse)).toEqual([]);
    expect(reminders(r.remind)).toEqual([]);
  });

  it("flags a replacement filed under another study (K.BP1, not a refusal)", async () => {
    const moved = { ...doc("32", "5.3.5.1", "EXA-302 CSR", "csr.pdf", "EXA-302 (renamed)"), target: t("s0000-a23") };
    const s1 = await build("0001", [doc("31", "1.1.1", "補件回復函", "reply.pdf"), moved]);
    expect(lifecycleFindings(s1.manifest, [s0.manifest]).map((f: { rule: string }) => f.rule)).toEqual(["K.BP1"]);
  });
});
