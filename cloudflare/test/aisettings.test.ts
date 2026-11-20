import { describe, expect, it } from "vitest";
import { baseUrlProblem, configFor, openKey, PROVIDERS, providerById, sealKey } from "../src/aisettings";

describe("company AI keys at rest", () => {
  it("round-trips, and only for the same secret and company", async () => {
    const sealed = await sealKey("secret-one", 7, "sk-test-123");
    expect(sealed).toMatch(/^v1\.[\w+/=]+\.[\w+/=]+$/);
    expect(sealed).not.toContain("sk-test-123");
    expect(await openKey("secret-one", 7, sealed)).toBe("sk-test-123");
    expect(await openKey("secret-two", 7, sealed)).toBeNull();
    expect(await openKey("secret-one", 8, sealed)).toBeNull();
    expect(await openKey("secret-one", 7, "v1.AAAA.BBBB")).toBeNull();
    expect(await openKey("secret-one", 7, "garbage")).toBeNull();
    expect(await sealKey("secret-one", 7, "sk-test-123")).not.toBe(sealed);
  });
});

describe("custom AI service addresses", () => {
  it("allows public HTTPS endpoints", () => {
    for (const ok of ["https://api.example.com/v1", "https://generativelanguage.googleapis.com/v1beta/openai", "https://gw.example.co.jp:8443/openai/v1"]) {
      expect(baseUrlProblem(ok), ok).toBeNull();
    }
  });
  it("refuses plain HTTP, IP addresses, internal names and credentials", () => {
    for (const bad of ["http://api.example.com/v1", "https://10.0.0.1/v1", "https://[::1]/v1", "https://localhost/v1", "https://intranet/v1",
      "https://ai.corp/v1", "https://box.local/v1", "https://u:p@api.example.com/v1", "https://api.example.com/v1?x=1", "ftp://api.example.com", "not a url"]) {
      expect(baseUrlProblem(bad), bad).not.toBeNull();
    }
  });
  it("allows http://localhost only when local testing is switched on", () => {
    expect(baseUrlProblem("http://127.0.0.1:8788/v1")).not.toBeNull();
    expect(baseUrlProblem("http://127.0.0.1:8788/v1", true)).toBeNull();
    expect(baseUrlProblem("http://10.0.0.1/v1", true)).not.toBeNull();
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
