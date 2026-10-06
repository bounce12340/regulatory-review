// ZIP reading and writing for eCTD packages, which can exceed 4 GB and 65,535 files, so both
// sides speak ZIP64. Nothing is held in memory whole: entries are read as streams from the
// Blob, and the writer hands each piece to a sink as soon as it is ready.

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_EOCD64_LOCATOR = 0x07064b50;
const MAX32 = 0xffffffff;
const MAX16 = 0xffff;
const FLAG_UTF8 = 0x0800;

// ── CRC-32 ──────────────────────────────────────────────────────────────────

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

export class Crc32 {
  crc = -1;
  update(data) {
    let c = this.crc;
    for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    this.crc = c;
    return this;
  }
  value() { return (this.crc ^ -1) >>> 0; }
}

// ── Reading ─────────────────────────────────────────────────────────────────

const u16 = (v, o) => v.getUint16(o, true);
const u32 = (v, o) => v.getUint32(o, true);
const u64 = (v, o) => v.getUint32(o, true) + v.getUint32(o + 4, true) * 2 ** 32;

async function bytesAt(blob, start, end) {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer());
}

/**
 * Reads the central directory of a ZIP file.
 * @param {Blob} blob
 * @returns {Promise<{name: string, size: number, compressedSize: number, method: number,
 *   encrypted: boolean, dir: boolean, crc: number, stream: () => ReadableStream<Uint8Array>}[]>}
 */
export async function readZip(blob) {
  const tailLen = Math.min(blob.size, 22 + MAX16 + 20);
  const tail = await bytesAt(blob, blob.size - tailLen, blob.size);
  const tv = new DataView(tail.buffer);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (u32(tv, i) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("不是有效的 ZIP 檔（找不到中央目錄）。");
  let count = u16(tv, eocd + 10);
  let cdSize = u32(tv, eocd + 12);
  let cdOffset = u32(tv, eocd + 16);
  // ZIP64: the locator sits just before the classic end record.
  if (eocd >= 20 && u32(tv, eocd - 20) === SIG_EOCD64_LOCATOR) {
    const recOffset = u64(tv, eocd - 20 + 8);
    const rec = await bytesAt(blob, recOffset, recOffset + 56);
    const rv = new DataView(rec.buffer);
    if (u32(rv, 0) !== SIG_EOCD64) throw new Error("ZIP64 結尾紀錄損毀。");
    count = u64(rv, 32);
    cdSize = u64(rv, 40);
    cdOffset = u64(rv, 48);
  }
  if (cdOffset + cdSize > blob.size) throw new Error("ZIP 檔不完整（可能下載或上傳中斷）。");
  const cd = await bytesAt(blob, cdOffset, cdOffset + cdSize);
  const v = new DataView(cd.buffer);
  const utf8 = new TextDecoder("utf-8");
  const entries = [];
  let p = 0;
  for (let n = 0; n < count; n++) {
    if (p + 46 > cd.length || u32(v, p) !== SIG_CENTRAL) throw new Error("ZIP 中央目錄損毀。");
    const flags = u16(v, p + 8);
    const method = u16(v, p + 10);
    const crc = u32(v, p + 16);
    let compressedSize = u32(v, p + 20);
    let size = u32(v, p + 24);
    const nameLen = u16(v, p + 28);
    const extraLen = u16(v, p + 30);
    const commentLen = u16(v, p + 32);
    let offset = u32(v, p + 42);
    const nameBytes = cd.subarray(p + 46, p + 46 + nameLen);
    // Without the UTF-8 flag the name is in a legacy code page; eCTD names are ASCII anyway.
    const name = (flags & FLAG_UTF8 ? utf8 : new TextDecoder("utf-8")).decode(nameBytes).replace(/\\/g, "/");
    // ZIP64 extra field: only the fields that overflowed are present, in this order.
    let e = p + 46 + nameLen;
    const extraEnd = e + extraLen;
    while (e + 4 <= extraEnd) {
      const id = u16(v, e);
      const len = u16(v, e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === MAX32) { size = u64(v, q); q += 8; }
        if (compressedSize === MAX32) { compressedSize = u64(v, q); q += 8; }
        if (offset === MAX32) { offset = u64(v, q); }
      }
      e += 4 + len;
    }
    p = extraEnd + commentLen;
    const dir = name.endsWith("/");
    entries.push({
      name, size, compressedSize, method, crc, dir, encrypted: Boolean(flags & 1),
      stream: () => entryStream(blob, offset, compressedSize, method, name),
    });
  }
  return entries;
}

function entryStream(blob, offset, compressedSize, method, name) {
  // The local header's name and extra lengths can differ from the central directory's.
  const header = blob.slice(offset, offset + 30);
  let inner;
  return new ReadableStream({
    async start() {
      const h = new DataView(await header.arrayBuffer());
      if (h.getUint32(0, true) !== SIG_LOCAL) throw new Error(`ZIP 內「${name}」的檔頭損毀。`);
      const start = offset + 30 + h.getUint16(26, true) + h.getUint16(28, true);
      const raw = blob.slice(start, start + compressedSize).stream();
      if (method === 0) inner = raw;
      else if (method === 8) inner = raw.pipeThrough(new DecompressionStream("deflate-raw"));
      else throw new Error(`ZIP 內「${name}」使用不支援的壓縮方式（${method}）。`);
      inner = inner.getReader();
    },
    async pull(controller) {
      const { value, done } = await inner.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel(reason) { return inner?.cancel(reason); },
  });
}

/** Reads a whole stream into one Uint8Array (for small entries such as XML). */
export async function streamBytes(stream, limit = 64 * 1024 * 1024) {
  const parts = [];
  let total = 0;
  for await (const chunk of streamIter(stream)) {
    total += chunk.length;
    if (total > limit) throw new Error("檔案過大，無法讀入記憶體。");
    parts.push(chunk);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of parts) { out.set(c, o); o += c.length; }
  return out;
}

/** Async iteration over a ReadableStream (Safari lacks ReadableStream[Symbol.asyncIterator]). */
export async function* streamIter(stream) {
  const reader = stream.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Writing ─────────────────────────────────────────────────────────────────

/**
 * Writes a stored (uncompressed) ZIP. PDFs are already compressed, and storing keeps sizes
 * and CRCs in the local headers, which every unzip tool reads, including streaming ones.
 * The caller supplies each file's CRC-32 up front (see hashBlob).
 */
export class ZipWriter {
  /** @param {{write: (chunk: Uint8Array|Blob) => Promise<void>}} sink */
  constructor(sink) {
    this.sink = sink;
    this.offset = 0;
    this.central = [];
    this.enc = new TextEncoder();
  }

  async #emit(chunk) {
    await this.sink.write(chunk);
    this.offset += chunk instanceof Blob ? chunk.size : chunk.length;
  }

  /**
   * @param {string} name  path inside the archive, "/"-separated
   * @param {Blob|Uint8Array} data
   * @param {number} crc  CRC-32 of data
   */
  async add(name, data, crc) {
    const nameBytes = this.enc.encode(name);
    const size = data instanceof Blob ? data.size : data.length;
    const offset = this.offset;
    const big = size >= MAX32;
    const local = new Uint8Array(30 + nameBytes.length + (big ? 20 : 0));
    const v = new DataView(local.buffer);
    v.setUint32(0, SIG_LOCAL, true);
    v.setUint16(4, big ? 45 : 20, true);
    v.setUint16(6, FLAG_UTF8, true);
    v.setUint16(8, 0, true);
    setDosTime(v, 10);
    v.setUint32(14, crc, true);
    v.setUint32(18, big ? MAX32 : size, true);
    v.setUint32(22, big ? MAX32 : size, true);
    v.setUint16(26, nameBytes.length, true);
    v.setUint16(28, big ? 20 : 0, true);
    local.set(nameBytes, 30);
    if (big) {
      const x = 30 + nameBytes.length;
      v.setUint16(x, 0x0001, true);
      v.setUint16(x + 2, 16, true);
      setU64(v, x + 4, size);
      setU64(v, x + 12, size);
    }
    await this.#emit(local);
    await this.#emit(data);
    this.central.push({ nameBytes, size, crc, offset });
  }

  async finish() {
    const cdStart = this.offset;
    for (const e of this.central) {
      const needSize = e.size >= MAX32;
      const needOffset = e.offset >= MAX32;
      const extraLen = needSize || needOffset ? 4 + (needSize ? 16 : 0) + (needOffset ? 8 : 0) : 0;
      const rec = new Uint8Array(46 + e.nameBytes.length + extraLen);
      const v = new DataView(rec.buffer);
      v.setUint32(0, SIG_CENTRAL, true);
      v.setUint16(4, 45, true); // made by: version 4.5 (ZIP64)
      v.setUint16(6, extraLen ? 45 : 20, true);
      v.setUint16(8, FLAG_UTF8, true);
      v.setUint16(10, 0, true);
      setDosTime(v, 12);
      v.setUint32(16, e.crc, true);
      v.setUint32(20, needSize ? MAX32 : e.size, true);
      v.setUint32(24, needSize ? MAX32 : e.size, true);
      v.setUint16(28, e.nameBytes.length, true);
      v.setUint16(30, extraLen, true);
      v.setUint32(42, needOffset ? MAX32 : e.offset, true);
      rec.set(e.nameBytes, 46);
      if (extraLen) {
        let x = 46 + e.nameBytes.length;
        v.setUint16(x, 0x0001, true);
        v.setUint16(x + 2, extraLen - 4, true);
        x += 4;
        if (needSize) { setU64(v, x, e.size); setU64(v, x + 8, e.size); x += 16; }
        if (needOffset) setU64(v, x, e.offset);
      }
      await this.#emit(rec);
    }
    const cdSize = this.offset - cdStart;
    const count = this.central.length;
    const zip64 = count >= MAX16 || cdStart >= MAX32 || cdSize >= MAX32;
    if (zip64) {
      const recOffset = this.offset;
      const r = new Uint8Array(56 + 20);
      const v = new DataView(r.buffer);
      v.setUint32(0, SIG_EOCD64, true);
      setU64(v, 4, 44);
      v.setUint16(12, 45, true);
      v.setUint16(14, 45, true);
      setU64(v, 24, count);
      setU64(v, 32, count);
      setU64(v, 40, cdSize);
      setU64(v, 48, cdStart);
      v.setUint32(56, SIG_EOCD64_LOCATOR, true);
      setU64(v, 64, recOffset);
      v.setUint32(72, 1, true);
      await this.#emit(r);
    }
    const end = new Uint8Array(22);
    const v = new DataView(end.buffer);
    v.setUint32(0, SIG_EOCD, true);
    v.setUint16(8, Math.min(count, MAX16), true);
    v.setUint16(10, Math.min(count, MAX16), true);
    v.setUint32(12, Math.min(cdSize, MAX32), true);
    v.setUint32(16, Math.min(cdStart, MAX32), true);
    await this.#emit(end);
  }
}

function setU64(v, o, n) {
  v.setUint32(o, n >>> 0, true);
  v.setUint32(o + 4, Math.floor(n / 2 ** 32), true);
}

function setDosTime(v, o) {
  const d = new Date();
  v.setUint16(o, (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), true);
  v.setUint16(o + 2, ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), true);
}
