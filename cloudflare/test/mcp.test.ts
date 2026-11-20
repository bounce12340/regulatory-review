import { describe, expect, it } from "vitest";
import { decodeHeaderValue, headerProblem } from "../src/mcp";
import {
  authorizationServerMetadata, clientFromMetadataDocument, clientIdUrlProblem, protectedResourceMetadata, redirectAllowed, redirectMatches,
} from "../src/oauth";

// Claude Code's Client ID Metadata Document as published at this URL.
const CLAUDE_CODE_ID = "https://claude.ai/oauth/claude-code-client-metadata";
const CLAUDE_CODE_DOC = {
  client_id: CLAUDE_CODE_ID, client_name: "Claude Code", client_uri: "https://claude.ai",
  redirect_uris: ["http://localhost/callback", "http://127.0.0.1/callback"],
  grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none",
};

describe("redirect URIs", () => {
  it("allows HTTPS, loopback http and app schemes; refuses the rest", () => {
    for (const ok of ["https://claude.ai/api/mcp/auth_callback", "http://127.0.0.1:3118/callback", "http://localhost/callback",
      "http://[::1]:8080/cb", "cursor://anysphere.cursor-retrieval/oauth/callback", "vscode://vscode.github-authentication/did-authenticate"]) {
      expect(redirectAllowed(ok), ok).toBe(true);
    }
    for (const bad of ["http://evil.example/cb", "javascript:alert(1)", "data:text/html,x", "file:///etc/passwd",
      "https://claude.ai/cb#frag", "https://user:pw@claude.ai/cb", "not a url"]) {
      expect(redirectAllowed(bad), bad).toBe(false);
    }
  });

  it("ignores the port of a loopback redirect only (RFC 8252 7.3)", () => {
    expect(redirectMatches("http://localhost/callback", "http://localhost:3118/callback")).toBe(true);
    expect(redirectMatches("http://127.0.0.1/callback", "http://127.0.0.1:51234/callback")).toBe(true);
    expect(redirectMatches("http://localhost/callback", "http://127.0.0.1:3118/callback")).toBe(false);
    expect(redirectMatches("http://localhost/callback", "http://localhost:3118/other")).toBe(false);
    expect(redirectMatches("https://claude.ai/api/mcp/auth_callback", "https://claude.ai:8443/api/mcp/auth_callback")).toBe(false);
    expect(redirectMatches("https://claude.ai/api/mcp/auth_callback", "https://claude.ai/api/mcp/auth_callback")).toBe(true);
  });
});

describe("client ID metadata documents", () => {
  it("accepts Claude Code's document and its loopback callbacks", () => {
    expect(clientIdUrlProblem(CLAUDE_CODE_ID)).toBeNull();
    const c = clientFromMetadataDocument(CLAUDE_CODE_ID, CLAUDE_CODE_DOC);
    expect(c.client_name).toBe("Claude Code");
    expect(c.redirect_uris.some((r) => redirectMatches(r, "http://localhost:3118/callback"))).toBe(true);
  });

  it("refuses unsafe client_id URLs and documents that do not match", () => {
    for (const bad of ["http://claude.ai/x", "https://claude.ai/", "https://127.0.0.1/meta.json", "https://localhost/meta.json", "https://intranet/meta"]) {
      expect(clientIdUrlProblem(bad), bad).not.toBeNull();
    }
    expect(() => clientFromMetadataDocument(CLAUDE_CODE_ID, { ...CLAUDE_CODE_DOC, client_id: "https://evil.example/meta" })).toThrow(/不符/);
    expect(() => clientFromMetadataDocument(CLAUDE_CODE_ID, { ...CLAUDE_CODE_DOC, redirect_uris: ["http://evil.example/cb"] })).toThrow(/redirect_uris/);
    expect(() => clientFromMetadataDocument(CLAUDE_CODE_ID, { ...CLAUDE_CODE_DOC, redirect_uris: [] })).toThrow(/redirect_uris/);
    expect(() => clientFromMetadataDocument(CLAUDE_CODE_ID, [CLAUDE_CODE_DOC])).toThrow();
  });
});

describe("discovery metadata", () => {
  const url = new URL("https://rr.example.com/mcp");
  it("names this server as resource and issuer, with what Claude needs to pick CIMD", () => {
    expect(protectedResourceMetadata(url)).toMatchObject({ resource: "https://rr.example.com/mcp", authorization_servers: ["https://rr.example.com"] });
    const as = authorizationServerMetadata(url);
    expect(as.issuer).toBe("https://rr.example.com");
    expect(as.client_id_metadata_document_supported).toBe(true);
    expect(as.token_endpoint_auth_methods_supported).toContain("none");
    expect(as.code_challenge_methods_supported).toEqual(["S256"]);
    expect(as.registration_endpoint).toBe("https://rr.example.com/oauth/register");
  });
});

describe("2026-07-28 request headers", () => {
  const meta = { _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" } };
  const headers = (h: Record<string, string>) => new Headers(h);

  it("accepts matching headers, including a base64-encoded tool name", () => {
    expect(headerProblem(headers({ "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/list" }), "tools/list", meta)).toBeNull();
    const encoded = `=?base64?${btoa(String.fromCharCode(...new TextEncoder().encode("讀取")))}?=`;
    expect(headerProblem(headers({ "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/call", "Mcp-Name": encoded }), "tools/call", { ...meta, name: "讀取" })).toBeNull();
  });

  it("reports missing and mismatched headers", () => {
    expect(headerProblem(headers({ "Mcp-Method": "tools/list" }), "tools/list", meta)).toMatch(/MCP-Protocol-Version/);
    expect(headerProblem(headers({ "MCP-Protocol-Version": "2026-07-28" }), "tools/list", meta)).toMatch(/Mcp-Method/);
    expect(headerProblem(headers({ "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/call" }), "tools/list", meta)).toMatch(/does not match/);
    expect(headerProblem(headers({ "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/call" }), "tools/call", { ...meta, name: "x" })).toMatch(/Mcp-Name/);
    expect(headerProblem(headers({ "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/call", "Mcp-Name": "y" }), "tools/call", { ...meta, name: "x" })).toMatch(/does not match/);
    expect(headerProblem(headers({ "MCP-Protocol-Version": "2025-11-25", "Mcp-Method": "tools/list" }), "tools/list", meta)).toMatch(/does not match/);
  });

  it("decodes the sentinel form and rejects broken values", () => {
    expect(decodeHeaderValue("list_cases")).toBe("list_cases");
    expect(decodeHeaderValue("=?base64?SGVsbG8sIOS4lueVjA==?=")).toBe("Hello, 世界");
    expect(decodeHeaderValue("=?base64?/w==?=")).toBeNull(); // not UTF-8
  });
});
