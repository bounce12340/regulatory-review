import { describe, expect, it } from "vitest";
import { API_KEY_PREFIX, bearerApiKey, keyRequestProblem } from "../src/apikeys";

const req = (auth?: string) => new Request("https://rr.example.com/api/projects", { headers: auth ? { Authorization: auth } : {} });

describe("API key requests", () => {
  it("reads only our keys from the Authorization header", () => {
    expect(bearerApiKey(req(`Bearer ${API_KEY_PREFIX}abc`))).toBe(`${API_KEY_PREFIX}abc`);
    expect(bearerApiKey(req(`bearer ${API_KEY_PREFIX}abc `))).toBe(`${API_KEY_PREFIX}abc`);
    expect(bearerApiKey(req("Bearer rrp_personal-mcp-token"))).toBeNull();
    expect(bearerApiKey(req(`Basic ${API_KEY_PREFIX}abc`))).toBeNull();
    expect(bearerApiKey(req())).toBeNull();
  });

  it("keeps read-only keys to reads", () => {
    expect(keyRequestProblem("read", "GET", "/api/projects")).toBeNull();
    expect(keyRequestProblem("read", "HEAD", "/api/attachments/3")).toBeNull();
    for (const m of ["POST", "PATCH", "PUT", "DELETE"]) expect(keyRequestProblem("read", m, "/api/projects/1")).toMatch(/唯讀/);
    expect(keyRequestProblem("read write", "PATCH", "/api/items/4")).toBeNull();
    expect(keyRequestProblem("read write", "POST", "/api/items/4/attachments")).toBeNull();
  });

  it("never lets a key manage sign-in, members or access", () => {
    for (const [m, path] of [
      ["POST", "/api/auth/login"], ["POST", "/api/auth/logout"], ["POST", "/api/auth/password"], ["GET", "/api/auth/mex"],
      ["GET", "/api/users"], ["PATCH", "/api/users/2"], ["GET", "/api/mcp"], ["POST", "/api/mcp/tokens"],
      ["GET", "/api/api-keys"], ["POST", "/api/api-keys"], ["DELETE", "/api/api-keys/1"], ["PATCH", "/api/api-keys/settings"],
      ["GET", "/api/ai/settings"], ["PUT", "/api/ai/settings"], ["DELETE", "/api/ai/settings"],
    ]) {
      expect(keyRequestProblem("read write", m, path), `${m} ${path}`).toMatch(/不能/);
    }
    expect(keyRequestProblem("read", "GET", "/api/auth/me")).toBeNull();
    expect(keyRequestProblem("read", "GET", "/api/users-report")).toBeNull();
    expect(keyRequestProblem("read write", "POST", "/api/ai/analyze")).toBeNull();
  });
});
