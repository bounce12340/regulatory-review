import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error plain browser modules without type declarations
import { planPaths, writePackage } from "../public/lib/ectd-build.js";
// @ts-expect-error
import { currentLeaves, lifecycleFindings, modifiedFileFor, parseModifiedFile } from "../public/lib/ectd-lifecycle.js";
// @ts-expect-error
import { loadBundledUtil, readManifests, summarize, validateEntries, zipEntries } from "../public/lib/ectd-validate.js";
// @ts-expect-error
import { readZip, streamBytes } from "../public/lib/zip.js";

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), "../public/vendor/ectd/");
const vendor = (name: string) => readFileSync(VENDOR + name);
const enc = new TextEncoder();
const pdf = (body: string) => enc.encode(`%PDF-1.7\n1 0 obj<<>>endobj\n% ${body}\ntrailer<<>>\n%%EOF\n`);
const UUID = "550e8400-e29b-41d4-a716-446655442895";
const product = { substance: "Examplin", manufacturer: "Example Chem", product: "Examplin tablets" };

type Leaf = { id: string; xml: string; node: string; title: string; op: string; modifiedFile: string | null; section: string; sequence?: string };
type Manifest = { sequence: string; uuid: string; leaves: Leaf[] };

const env = (sequence: string, extra: Record<string, unknown> = {}) => ({
  identifier: UUID, objective: "new", unitType: sequence === "0000" ? "initial" : "response",
  applicant: "Example Pharma", cca: "MG00000000000005", phones: ["02-0000-0000"], emails: ["ra@example.test"],
  inventedNames: [{ name: "Examplin 10 mg", licenses: [], appNo: "2026100601", codes: ["202610060110mg"] }],
  inns: ["examplin"], sequence, relatedSequences: [sequence === "0000" ? "0000" : "0000"], description: "測試", ...extra,
});

type Doc = { key: string; node: string; title: string; filename: string; size: number; bytes: Uint8Array; target?: unknown };
function doc(key: string, node: string, title: string, body = title): Doc {
  const bytes = pdf(body);
  return { key, node, title, filename: `${key}.pdf`, size: bytes.length, bytes };
}

async function build(sequence: string, docs: Doc[], deletes: unknown[] = [], envExtra = {}) {
  const { placed, problems } = planPaths(docs, product, "2026100601", sequence);
  expect(problems).toEqual([]);
  const parts: Uint8Array[] = [];
  const res = await writePackage({
    env: env(sequence, envExtra), product, placed, deletes,
    sink: { write: async (c: Uint8Array | Blob) => { parts.push(c instanceof Blob ? new Uint8Array(await c.arrayBuffer()) : c); } },
    fetchDoc: async (d: Doc) => new Blob([docs.find((x) => x.key === d.key)!.bytes]),
    fetchUtil: async (name: string) => new Blob([vendor(name)]),
  });
  return { zip: new Blob(parts), manifest: res.manifest as Manifest };
}

const refuse = async (zip: Blob, history: Manifest[] = []) =>
  [...new Set(summarize(await validateEntries(await zipEntries(zip), { history })).refuse.map((x: { rule: string }) => x.rule))].sort();

let s0: { zip: Blob; manifest: Manifest };
beforeAll(async () => {
  await loadBundledUtil(async (name: string) => new TextDecoder().decode(vendor(name)));
  s0 = await build("0000", [
    doc("1", "1.1.1", "申請書"), doc("2", "1.3.1.1", "中文仿單"), doc("3", "3.2.s.4.1", "原料藥規格"), doc("4", "3.2.p.8.3", "安定性數據"),
  ]);
});

describe("modified-file", () => {
  it("is written relative to the XML that holds the leaf and read back", () => {
    expect(modifiedFileFor("index", { sequence: "0000", xml: "index", id: "s0000-a3" })).toBe("../0000/index.xml#s0000-a3");
    expect(modifiedFileFor("tw", { sequence: "0000", xml: "tw", id: "s0000-a2" })).toBe("../../../0000/m1/tw/tw-regional.xml#s0000-a2");
    expect(parseModifiedFile("../0000/index.xml#x", "index")).toEqual({ sequence: "0000", xml: "index", id: "x" });
    expect(parseModifiedFile("../../../0000/m1/tw/tw-regional.xml#y", "tw")).toEqual({ sequence: "0000", xml: "tw", id: "y" });
    // Some tools write tw-regional.xml leaves relative to the sequence folder.
    expect(parseModifiedFile("../0000/m1/tw/tw-regional.xml#y", "tw")).toEqual({ sequence: "0000", xml: "tw", id: "y" });
    expect(parseModifiedFile("nonsense", "index")).toBeNull();
  });
});

describe("manifests", () => {
  it("records stable leaf IDs, sections and the UUID", async () => {
    expect(s0.manifest.uuid).toBe(UUID);
    expect(s0.manifest.leaves.map((l) => [l.id, l.node, l.op])).toEqual([
      ["s0000-a3", "3.2.s.4.1", "new"], ["s0000-a4", "3.2.p.8.3", "new"], ["s0000-a1", "1.1.1", "new"], ["s0000-a2", "1.3.1.1", "new"],
    ]);
    // Building the same sequence again gives the same IDs (later sequences may point at them).
    const again = await build("0000", [doc("1", "1.1.1", "申請書"), doc("2", "1.3.1.1", "中文仿單"), doc("3", "3.2.s.4.1", "原料藥規格"), doc("4", "3.2.p.8.3", "安定性數據")]);
    expect(again.manifest.leaves.map((l) => l.id)).toEqual(s0.manifest.leaves.map((l) => l.id));
  });

  it("reads the same manifest back from a submitted ZIP", async () => {
    const [m] = await readManifests(await zipEntries(s0.zip));
    expect(m.sequence).toBe("0000");
    expect(m.uuid).toBe(UUID);
    expect(m.leaves).toEqual(s0.manifest.leaves);
  });
});

describe("a response sequence that replaces and deletes", () => {
  const t = (seq: string, xml: string, id: string) => ({ sequence: seq, xml, id });
  let s1: { zip: Blob; manifest: Manifest };

  beforeAll(async () => {
    const replacement = { ...doc("5", "3.2.s.4.1", "原料藥規格（修正版）", "v2"), target: t("0000", "index", "s0000-a3") };
    const label = { ...doc("6", "1.3.1.1", "中文仿單（修正版）", "label v2"), target: t("0000", "tw", "s0000-a2") };
    s1 = await build("0001", [doc("7", "1.1.1", "補件回復函"), replacement, label],
      [{ key: "0000-s0000-a4", node: "3.2.p.8.3", title: "安定性數據", target: t("0000", "index", "s0000-a4") }]);
  });

  it("writes replace and delete leaves that pass every rule, lifecycle included", async () => {
    const ops = s1.manifest.leaves.map((l) => [l.id, l.op, l.modifiedFile]);
    expect(ops).toContainEqual(["s0001-a5", "replace", "../0000/index.xml#s0000-a3"]);
    expect(ops).toContainEqual(["s0001-a6", "replace", "../../../0000/m1/tw/tw-regional.xml#s0000-a2"]);
    expect(ops).toContainEqual(["s0001-d0000-s0000-a4", "delete", "../0000/index.xml#s0000-a4"]);
    expect(await refuse(s1.zip, [s0.manifest])).toEqual([]);
  });

  it("is valid against the official DTDs (xmllint), delete leaf included", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ectd-"));
    try {
      for (const e of await readZip(s1.zip)) {
        const p = join(dir, e.name);
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, await streamBytes(e.stream()));
      }
      const seq = join(dir, "2026100601/0001");
      try {
        // Throws (and fails the test) when either file is not valid against its DTD.
        execFileSync("xmllint", ["--noout", "--valid", "index.xml"], { cwd: seq, stdio: "pipe" });
        execFileSync("xmllint", ["--noout", "--valid", "tw-regional.xml"], { cwd: join(seq, "m1/tw"), stdio: "pipe" });
      } catch (err) {
        if ((err as { code?: string }).code !== "ENOENT") throw err; // ENOENT: xmllint not installed here
      }
      const index = readFileSync(join(seq, "index.xml"), "utf8");
      expect(index).toMatch(/<leaf ID="s0001-d0000-s0000-a4" operation="delete" modified-file="\.\.\/0000\/index\.xml#s0000-a4" checksum-type="md5" checksum="" xlink:type="simple">/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("leaves the right documents current", () => {
    const live = currentLeaves([s0.manifest, s1.manifest]);
    expect([...live.values()].map((l: Leaf) => l.title).sort()).toEqual(["中文仿單（修正版）", "原料藥規格（修正版）", "申請書", "補件回復函"].sort());
  });

  it("checks lifecycle across sequences uploaded together", async () => {
    // Both sequences in one upload: no history needed.
    const both = await zipEntries(s0.zip).then(async (a: object[]) => [...a, ...(await zipEntries(s1.zip))]);
    expect(summarize(await validateEntries(both)).refuse).toEqual([]);
  });

  it("refuses replacing a document twice, a missing target, a wrong section, a new UUID and a skipped sequence", () => {
    const f = (cur: Manifest, hist = [s0.manifest]) => lifecycleFindings(cur, hist).map((x: { rule: string }) => x.rule).sort();
    const leaf = (over: Partial<Leaf>) => ({ ...s1.manifest.leaves.find((l) => l.id === "s0001-a5")!, ...over });
    // s0000-a3 was replaced in 0001, so 0002 cannot replace it again.
    expect(f({ sequence: "0002", uuid: UUID, leaves: [leaf({ id: "s0002-a9", modifiedFile: "../0000/index.xml#s0000-a3" })] }, [s0.manifest, s1.manifest])).toEqual(["K.12"]);
    expect(f({ sequence: "0001", uuid: UUID, leaves: [leaf({ modifiedFile: "../0000/index.xml#nope" })] })).toEqual(["K.9"]);
    expect(f({ sequence: "0001", uuid: UUID, leaves: [leaf({ section: "ectd:ectd/m3-quality/m3-2-body-of-data/other" })] })).toEqual(["K.10"]);
    expect(f({ sequence: "0001", uuid: "11111111-2222-3333-4444-555555555555", leaves: [] })).toEqual(["I.8"]);
    expect(f({ sequence: "0003", uuid: UUID, leaves: [] })).toEqual(["M.4"]);
    expect(f({ sequence: "0000", uuid: UUID, leaves: [] })).toEqual(["M.2"]);
  });

  it("reports lifecycle problems through the validator with history", async () => {
    // Validating 0001 against a history in which 0000 does not hold the targeted leaves.
    const other = { ...s0.manifest, leaves: s0.manifest.leaves.filter((l) => l.id !== "s0000-a3") };
    expect(await refuse(s1.zip, [other])).toEqual(["K.9"]);
  });
});
