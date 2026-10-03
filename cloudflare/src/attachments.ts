/**
 * Rules for files attached to checklist items. The handlers live in index.ts; these pure
 * helpers decide what is accepted and how a stored file is served back.
 */

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_ITEM = 20;

/**
 * Accepted extensions and the Content-Type each is served with. The type comes from this
 * table, never from the browser, so an upload cannot choose how it is rendered.
 */
export const ATTACHMENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  zip: "application/zip",
  msg: "application/vnd.ms-outlook",
};

/** Strips any path, control characters and surrounding dots/spaces; keeps CJK names intact. */
export function cleanFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "").trim().replace(/^\.+/, "");
  if (cleaned.length <= 200) return cleaned;
  // Keep the extension when shortening a long name.
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, 200 - ext.length) + ext;
}

/** Lower-case extension of a cleaned filename, or "" when there is none. */
export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

/** Content-Disposition that always downloads, with an RFC 5987 UTF-8 name for CJK filenames. */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "file";
  // encodeURIComponent leaves ' ( ) * unescaped, but RFC 5987 does not allow them.
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
