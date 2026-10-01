import { describe, expect, it } from "vitest";
import { hashPassword, hashToken, newSessionToken, normalizeEmail, readSessionCookie, slugify, validatePassword, verifyPassword } from "../src/auth";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const stored = await hashPassword("correct horse battery", 1000);
    expect(stored).toMatch(/^pbkdf2\$1000\$/);
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("wrong password", stored)).toBe(false);
  });
  it("salts hashes", async () => {
    expect(await hashPassword("same-password", 1000)).not.toBe(await hashPassword("same-password", 1000));
  });
  it("rejects malformed or out-of-range stored hashes", async () => {
    expect(await verifyPassword("x", "bcrypt$abc")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2$999999999$AA==$AA==")).toBe(false);
  });
});

describe("session tokens", () => {
  it("are unique, URL-safe, and hashed to hex", async () => {
    const a = newSessionToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(newSessionToken());
    expect(await hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("reads the session cookie among others", () => {
    const req = new Request("https://x.test", { headers: { Cookie: "a=1; rr_session=abc-DEF_1; b=2" } });
    expect(readSessionCookie(req)).toBe("abc-DEF_1");
    expect(readSessionCookie(new Request("https://x.test"))).toBeNull();
  });
});

describe("validation", () => {
  it("normalizes emails", () => {
    expect(normalizeEmail("  Josh@Example.COM ")).toBe("josh@example.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });
  it("enforces password length", () => {
    expect(validatePassword("short")).not.toBeNull();
    expect(validatePassword("long-enough")).toBeNull();
  });
  it("slugifies like auth/register.py, keeping CJK", () => {
    expect(slugify("Universal Integrated Corp.")).toBe("universal-integrated-corp");
    expect(slugify("優良 製藥 股份有限公司")).toBe("優良-製藥-股份有限公司");
    expect(slugify("!!!", "company")).toBe("company");
  });
});
