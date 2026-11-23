/**
 * Reads a request body as text without ever holding more than `max` bytes: a declared
 * Content-Length over the limit is refused before reading, and a chunked body is cut off
 * as soon as it passes the limit.
 */
export class BodyTooLarge extends Error {
  constructor() {
    super("請求內容過大。");
  }
}

export async function readTextLimited(request: Request, max: number): Promise<string> {
  const declared = Number(request.headers.get("Content-Length") ?? "");
  if (Number.isFinite(declared) && declared > max) throw new BodyTooLarge();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { bytes.set(c, at); at += c.byteLength; }
  return new TextDecoder().decode(bytes);
}
