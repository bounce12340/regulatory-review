// Uploads one file to a checklist item and stores the text extracted from it.
// Files up to the single-request limit go in one form POST (with byte-level progress);
// larger ones go in fixed-size parts through the Worker (R2 multipart), each part retried.
import { api, state, ApiError } from "./api.js";
import { extractForReview } from "./docparse.js";

const PART_RETRIES = 3;

/** One POST with upload progress (fetch cannot report it). */
function postForm(path, file, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", path);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(xhr.status, data?.error ?? `上傳失敗（${xhr.status}）`));
    };
    xhr.onerror = () => reject(new ApiError(0, "無法連線至伺服器，請檢查網路。"));
    xhr.onabort = () => reject(new ApiError(0, "已取消上傳。"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  });
}

async function putPart(path, blob, signal) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(path, { method: "PUT", body: blob, credentials: "same-origin", signal });
      const data = await res.json().catch(() => null);
      if (res.ok) return data;
      // Client errors will not fix themselves; retry only network and server failures.
      if (res.status < 500 || attempt >= PART_RETRIES) throw new ApiError(res.status, data?.error ?? `上傳失敗（${res.status}）`);
    } catch (err) {
      if (signal?.aborted || err instanceof ApiError || attempt >= PART_RETRIES) throw err;
    }
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

/**
 * @returns {Promise<{attachmentId: number, detail: object}>} the new attachment and the refreshed case
 */
export async function uploadToItem(itemId, file, { onProgress, signal } = {}) {
  const limits = state.config.attachments;
  if (file.size <= limits.single_max_bytes) {
    const data = await postForm(`/api/items/${itemId}/attachments`, file, onProgress, signal);
    return { attachmentId: data.attachment_id, detail: data };
  }
  const start = await api("POST", `/api/items/${itemId}/uploads`, { filename: file.name, size: file.size });
  const uid = encodeURIComponent(start.upload_id);
  try {
    const parts = [];
    for (let n = 1; n <= start.parts; n++) {
      const from = (n - 1) * start.part_size;
      const r = await putPart(`/api/uploads/${uid}/parts/${n}`, file.slice(from, Math.min(from + start.part_size, file.size)), signal);
      parts.push({ part_number: r.part_number, etag: r.etag });
      onProgress?.(n / start.parts);
    }
    const data = await api("POST", `/api/uploads/${uid}/complete`, { parts });
    return { attachmentId: data.attachment_id, detail: data };
  } catch (err) {
    api("DELETE", `/api/uploads/${uid}`).catch(() => {});
    throw err;
  }
}

/** Extracts the file's text in the browser and stores it for AI review. Returns the status. */
export async function storeText(attachmentId, file) {
  const { status, text } = await extractForReview(file);
  await api("PUT", `/api/attachments/${attachmentId}/text`, status === "ok" ? { status, text } : { status });
  return status;
}
