import { describe, expect, it } from "vitest";
import { ATTACHMENT_TYPES, cleanFilename, contentDisposition, extensionOf } from "../src/attachments";

describe("attachment filenames", () => {
  it("drops paths and characters that are unsafe in a header", () => {
    expect(cleanFilename("C:\\docs\\申請書.pdf")).toBe("申請書.pdf");
    expect(cleanFilename("../../etc/passwd")).toBe("passwd");
    expect(cleanFilename('a"b<c>.pdf')).toBe("abc.pdf");
    expect(cleanFilename("...hidden.pdf")).toBe("hidden.pdf");
  });

  it("keeps the extension when shortening a long name", () => {
    const name = cleanFilename(`${"長".repeat(300)}.pdf`);
    expect(name.length).toBe(200);
    expect(name.endsWith(".pdf")).toBe(true);
  });

  it("only accepts listed extensions, case-insensitively", () => {
    expect(ATTACHMENT_TYPES[extensionOf("Report.PDF")]).toBe("application/pdf");
    expect(ATTACHMENT_TYPES[extensionOf("page.html")]).toBeUndefined();
    expect(ATTACHMENT_TYPES[extensionOf("image.exe")]).toBeUndefined();
    // eCTD Module 1 accepts SVG, GIF and XML (TFDA validation rule O.1).
    expect(ATTACHMENT_TYPES[extensionOf("figure.svg")]).toBe("image/svg+xml");
    expect(extensionOf("noext")).toBe("");
  });

  it("encodes CJK names for Content-Disposition", () => {
    const value = contentDisposition("申請書 (v2).pdf");
    expect(value.startsWith('attachment; filename="___ (v2).pdf";')).toBe(true);
    expect(value).toContain("filename*=UTF-8''%E7%94%B3%E8%AB%8B%E6%9B%B8%20%28v2%29.pdf");
  });
});
