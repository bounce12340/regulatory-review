import { describe, expect, it } from "vitest";
import { baseUrlProblem, configFor, normalizeBaseUrl, openKey, PROVIDERS, providerById, sealKey } from "../src/aisettings";

describe("company AI keys at rest", () => {
  const bound = { companyId: 7, provider: "openai_compatible", baseUrl: "https://gw.example.com/v1" };
  it("round-trips, and only for the same secret, company, service and address", async () => {
    const sealed = await sealKey("secret-one", bound, "sk-test-123");
    expect(sealed).toMatch(/^v2\.[\w+/=]+\.[\w+/=]+$/);
    expect(sealed).not.toContain("sk-test-123");
    expect(await openKey("secret-one", bound, sealed)).toBe("sk-test-123");
    expect(await openKey("secret-two", bound, sealed)).toBeNull();
    expect(await openKey("secret-one", { ...bound, companyId: 8 }, sealed)).toBeNull();
    // Pointing the stored row at another address or service makes the key unreadable.
    expect(await openKey("secret-one", { ...bound, baseUrl: "https://attacker.example/v1" }, sealed)).toBeNull();
    expect(await openKey("secret-one", { ...bound, baseUrl: null }, sealed)).toBeNull();
    expect(await openKey("secret-one", { ...bound, provider: "openai" }, sealed)).toBeNull();
    expect(await openKey("secret-one", bound, "v1.AAAA.BBBB")).toBeNull();
    expect(await openKey("secret-one", bound, "garbage")).toBeNull();
    expect(await sealKey("secret-one", bound, "sk-test-123")).not.toBe(sealed);
  });
});

describe("custom AI service addresses", () => {
  it("allows public HTTPS endpoints", () => {
    for (const ok of ["https://api.example.com/v1", "https://generativelanguage.googleapis.com/v1beta/openai", "https://gw.example.co.jp/openai/v1", "https://api.example.com:443/v1"]) {
      expect(baseUrlProblem(ok), ok).toBeNull();
    }
  });
  it("refuses plain HTTP, IP addresses, internal names and credentials", () => {
    for (const bad of ["http://api.example.com/v1", "https://10.0.0.1/v1", "https://[::1]/v1", "https://localhost/v1", "https://intranet/v1",
      "https://ai.corp/v1", "https://box.local/v1", "https://u:p@api.example.com/v1", "https://api.example.com/v1?x=1", "ftp://api.example.com", "not a url",
      // Ways around the suffix and host checks found in review.
      "https://api.example.com/v1?", "https://api.example.com/v1#", "https://localhost./v1", "https://x.internal./v1", "https://api.example.com./v1",
      "https://api.example.com:8443/v1", "https://0x7f000001/v1", "https://2130706433/v1", "https://127.1/v1"]) {
      expect(baseUrlProblem(bad), bad).not.toBeNull();
    }
  });
  it("allows http://localhost only when local testing is switched on", () => {
    expect(baseUrlProblem("http://127.0.0.1:8788/v1")).not.toBeNull();
    expect(baseUrlProblem("http://127.0.0.1:8788/v1", true)).toBeNull();
    expect(baseUrlProblem("http://10.0.0.1/v1", true)).not.toBeNull();
  });
});

describe("stored addresses", () => {
  it("keep origin and path only", () => {
    expect(normalizeBaseUrl("https://API.example.com/v1/")).toBe("https://api.example.com/v1");
    expect(normalizeBaseUrl("https://api.example.com:443/openai/v1")).toBe("https://api.example.com/openai/v1");
    expect(normalizeBaseUrl("https://api.example.com")).toBe("https://api.example.com");
  });
});

describe("providers", () => {
  it("map to a protocol and endpoint", () => {
    expect(PROVIDERS.map((p) => p.id)).toEqual(["anthropic", "openai", "gemini", "ollama", "openai_compatible"]);
    expect(configFor({ provider: "gemini", base_url: null, model: "m" }, "k")).toEqual({
      protocol: "openai", apiKey: "k", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", model: "m", source: "company",
    });
    expect(configFor({ provider: "anthropic", base_url: "https://proxy.example.com", model: "claude-opus-5-5" }, "k").baseURL).toBe("https://proxy.example.com");
    expect(providerById("openai_compatible")!.base_url).toBeNull();
    expect(providerById("nope")).toBeNull();
  });
});
