// Incremental MD5 (RFC 1321). eCTD checksums are MD5, Web Crypto has no MD5, and a dossier
// can run to several GB, so files are hashed chunk by chunk as they stream past.

export class Md5 {
  constructor() {
    this.state = new Int32Array([0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476]);
    this.buf = new Uint8Array(64);
    this.bufLen = 0;
    this.bytes = 0;
  }

  /** @param {Uint8Array} data */
  update(data) {
    let i = 0;
    this.bytes += data.length;
    if (this.bufLen) {
      const take = Math.min(64 - this.bufLen, data.length);
      this.buf.set(data.subarray(0, take), this.bufLen);
      this.bufLen += take;
      i = take;
      if (this.bufLen < 64) return this;
      this.#block(this.buf, 0);
      this.bufLen = 0;
    }
    for (; i + 64 <= data.length; i += 64) this.#block(data, i);
    if (i < data.length) {
      this.buf.set(data.subarray(i), 0);
      this.bufLen = data.length - i;
    }
    return this;
  }

  /** @returns {string} lower-case hex digest */
  hex() {
    const bits = this.bytes * 8;
    const pad = new Uint8Array((this.bufLen < 56 ? 56 : 120) - this.bufLen + 8);
    pad[0] = 0x80;
    const view = new DataView(pad.buffer);
    // Length in bits, little-endian 64-bit (exact up to 2^53 bytes).
    view.setUint32(pad.length - 8, bits >>> 0, true);
    view.setUint32(pad.length - 4, Math.floor(bits / 2 ** 32), true);
    const bytes = this.bytes;
    this.update(pad);
    this.bytes = bytes;
    let out = "";
    for (const v of this.state) {
      for (let s = 0; s < 32; s += 8) out += ((v >>> s) & 0xff).toString(16).padStart(2, "0");
    }
    return out;
  }

  #block(src, off) {
    // Unrolled: about 4x faster than a loop with table lookups.
    const r = (p) => src[p] | (src[p + 1] << 8) | (src[p + 2] << 16) | (src[p + 3] << 24);
    const w0 = r(off), w1 = r(off + 4), w2 = r(off + 8), w3 = r(off + 12), w4 = r(off + 16), w5 = r(off + 20),
      w6 = r(off + 24), w7 = r(off + 28), w8 = r(off + 32), w9 = r(off + 36), w10 = r(off + 40), w11 = r(off + 44),
      w12 = r(off + 48), w13 = r(off + 52), w14 = r(off + 56), w15 = r(off + 60);
    const st = this.state;
    let a = st[0], b = st[1], c = st[2], d = st[3], t;
    t = (a + ((b & c) | (~b & d)) + 0xd76aa478 + w0) | 0; a = (b + ((t << 7) | (t >>> 25))) | 0;
    t = (d + ((a & b) | (~a & c)) + 0xe8c7b756 + w1) | 0; d = (a + ((t << 12) | (t >>> 20))) | 0;
    t = (c + ((d & a) | (~d & b)) + 0x242070db + w2) | 0; c = (d + ((t << 17) | (t >>> 15))) | 0;
    t = (b + ((c & d) | (~c & a)) + 0xc1bdceee + w3) | 0; b = (c + ((t << 22) | (t >>> 10))) | 0;
    t = (a + ((b & c) | (~b & d)) + 0xf57c0faf + w4) | 0; a = (b + ((t << 7) | (t >>> 25))) | 0;
    t = (d + ((a & b) | (~a & c)) + 0x4787c62a + w5) | 0; d = (a + ((t << 12) | (t >>> 20))) | 0;
    t = (c + ((d & a) | (~d & b)) + 0xa8304613 + w6) | 0; c = (d + ((t << 17) | (t >>> 15))) | 0;
    t = (b + ((c & d) | (~c & a)) + 0xfd469501 + w7) | 0; b = (c + ((t << 22) | (t >>> 10))) | 0;
    t = (a + ((b & c) | (~b & d)) + 0x698098d8 + w8) | 0; a = (b + ((t << 7) | (t >>> 25))) | 0;
    t = (d + ((a & b) | (~a & c)) + 0x8b44f7af + w9) | 0; d = (a + ((t << 12) | (t >>> 20))) | 0;
    t = (c + ((d & a) | (~d & b)) + 0xffff5bb1 + w10) | 0; c = (d + ((t << 17) | (t >>> 15))) | 0;
    t = (b + ((c & d) | (~c & a)) + 0x895cd7be + w11) | 0; b = (c + ((t << 22) | (t >>> 10))) | 0;
    t = (a + ((b & c) | (~b & d)) + 0x6b901122 + w12) | 0; a = (b + ((t << 7) | (t >>> 25))) | 0;
    t = (d + ((a & b) | (~a & c)) + 0xfd987193 + w13) | 0; d = (a + ((t << 12) | (t >>> 20))) | 0;
    t = (c + ((d & a) | (~d & b)) + 0xa679438e + w14) | 0; c = (d + ((t << 17) | (t >>> 15))) | 0;
    t = (b + ((c & d) | (~c & a)) + 0x49b40821 + w15) | 0; b = (c + ((t << 22) | (t >>> 10))) | 0;
    t = (a + ((d & b) | (~d & c)) + 0xf61e2562 + w1) | 0; a = (b + ((t << 5) | (t >>> 27))) | 0;
    t = (d + ((c & a) | (~c & b)) + 0xc040b340 + w6) | 0; d = (a + ((t << 9) | (t >>> 23))) | 0;
    t = (c + ((b & d) | (~b & a)) + 0x265e5a51 + w11) | 0; c = (d + ((t << 14) | (t >>> 18))) | 0;
    t = (b + ((a & c) | (~a & d)) + 0xe9b6c7aa + w0) | 0; b = (c + ((t << 20) | (t >>> 12))) | 0;
    t = (a + ((d & b) | (~d & c)) + 0xd62f105d + w5) | 0; a = (b + ((t << 5) | (t >>> 27))) | 0;
    t = (d + ((c & a) | (~c & b)) + 0x2441453 + w10) | 0; d = (a + ((t << 9) | (t >>> 23))) | 0;
    t = (c + ((b & d) | (~b & a)) + 0xd8a1e681 + w15) | 0; c = (d + ((t << 14) | (t >>> 18))) | 0;
    t = (b + ((a & c) | (~a & d)) + 0xe7d3fbc8 + w4) | 0; b = (c + ((t << 20) | (t >>> 12))) | 0;
    t = (a + ((d & b) | (~d & c)) + 0x21e1cde6 + w9) | 0; a = (b + ((t << 5) | (t >>> 27))) | 0;
    t = (d + ((c & a) | (~c & b)) + 0xc33707d6 + w14) | 0; d = (a + ((t << 9) | (t >>> 23))) | 0;
    t = (c + ((b & d) | (~b & a)) + 0xf4d50d87 + w3) | 0; c = (d + ((t << 14) | (t >>> 18))) | 0;
    t = (b + ((a & c) | (~a & d)) + 0x455a14ed + w8) | 0; b = (c + ((t << 20) | (t >>> 12))) | 0;
    t = (a + ((d & b) | (~d & c)) + 0xa9e3e905 + w13) | 0; a = (b + ((t << 5) | (t >>> 27))) | 0;
    t = (d + ((c & a) | (~c & b)) + 0xfcefa3f8 + w2) | 0; d = (a + ((t << 9) | (t >>> 23))) | 0;
    t = (c + ((b & d) | (~b & a)) + 0x676f02d9 + w7) | 0; c = (d + ((t << 14) | (t >>> 18))) | 0;
    t = (b + ((a & c) | (~a & d)) + 0x8d2a4c8a + w12) | 0; b = (c + ((t << 20) | (t >>> 12))) | 0;
    t = (a + (b ^ c ^ d) + 0xfffa3942 + w5) | 0; a = (b + ((t << 4) | (t >>> 28))) | 0;
    t = (d + (a ^ b ^ c) + 0x8771f681 + w8) | 0; d = (a + ((t << 11) | (t >>> 21))) | 0;
    t = (c + (d ^ a ^ b) + 0x6d9d6122 + w11) | 0; c = (d + ((t << 16) | (t >>> 16))) | 0;
    t = (b + (c ^ d ^ a) + 0xfde5380c + w14) | 0; b = (c + ((t << 23) | (t >>> 9))) | 0;
    t = (a + (b ^ c ^ d) + 0xa4beea44 + w1) | 0; a = (b + ((t << 4) | (t >>> 28))) | 0;
    t = (d + (a ^ b ^ c) + 0x4bdecfa9 + w4) | 0; d = (a + ((t << 11) | (t >>> 21))) | 0;
    t = (c + (d ^ a ^ b) + 0xf6bb4b60 + w7) | 0; c = (d + ((t << 16) | (t >>> 16))) | 0;
    t = (b + (c ^ d ^ a) + 0xbebfbc70 + w10) | 0; b = (c + ((t << 23) | (t >>> 9))) | 0;
    t = (a + (b ^ c ^ d) + 0x289b7ec6 + w13) | 0; a = (b + ((t << 4) | (t >>> 28))) | 0;
    t = (d + (a ^ b ^ c) + 0xeaa127fa + w0) | 0; d = (a + ((t << 11) | (t >>> 21))) | 0;
    t = (c + (d ^ a ^ b) + 0xd4ef3085 + w3) | 0; c = (d + ((t << 16) | (t >>> 16))) | 0;
    t = (b + (c ^ d ^ a) + 0x4881d05 + w6) | 0; b = (c + ((t << 23) | (t >>> 9))) | 0;
    t = (a + (b ^ c ^ d) + 0xd9d4d039 + w9) | 0; a = (b + ((t << 4) | (t >>> 28))) | 0;
    t = (d + (a ^ b ^ c) + 0xe6db99e5 + w12) | 0; d = (a + ((t << 11) | (t >>> 21))) | 0;
    t = (c + (d ^ a ^ b) + 0x1fa27cf8 + w15) | 0; c = (d + ((t << 16) | (t >>> 16))) | 0;
    t = (b + (c ^ d ^ a) + 0xc4ac5665 + w2) | 0; b = (c + ((t << 23) | (t >>> 9))) | 0;
    t = (a + (c ^ (b | ~d)) + 0xf4292244 + w0) | 0; a = (b + ((t << 6) | (t >>> 26))) | 0;
    t = (d + (b ^ (a | ~c)) + 0x432aff97 + w7) | 0; d = (a + ((t << 10) | (t >>> 22))) | 0;
    t = (c + (a ^ (d | ~b)) + 0xab9423a7 + w14) | 0; c = (d + ((t << 15) | (t >>> 17))) | 0;
    t = (b + (d ^ (c | ~a)) + 0xfc93a039 + w5) | 0; b = (c + ((t << 21) | (t >>> 11))) | 0;
    t = (a + (c ^ (b | ~d)) + 0x655b59c3 + w12) | 0; a = (b + ((t << 6) | (t >>> 26))) | 0;
    t = (d + (b ^ (a | ~c)) + 0x8f0ccc92 + w3) | 0; d = (a + ((t << 10) | (t >>> 22))) | 0;
    t = (c + (a ^ (d | ~b)) + 0xffeff47d + w10) | 0; c = (d + ((t << 15) | (t >>> 17))) | 0;
    t = (b + (d ^ (c | ~a)) + 0x85845dd1 + w1) | 0; b = (c + ((t << 21) | (t >>> 11))) | 0;
    t = (a + (c ^ (b | ~d)) + 0x6fa87e4f + w8) | 0; a = (b + ((t << 6) | (t >>> 26))) | 0;
    t = (d + (b ^ (a | ~c)) + 0xfe2ce6e0 + w15) | 0; d = (a + ((t << 10) | (t >>> 22))) | 0;
    t = (c + (a ^ (d | ~b)) + 0xa3014314 + w6) | 0; c = (d + ((t << 15) | (t >>> 17))) | 0;
    t = (b + (d ^ (c | ~a)) + 0x4e0811a1 + w13) | 0; b = (c + ((t << 21) | (t >>> 11))) | 0;
    t = (a + (c ^ (b | ~d)) + 0xf7537e82 + w4) | 0; a = (b + ((t << 6) | (t >>> 26))) | 0;
    t = (d + (b ^ (a | ~c)) + 0xbd3af235 + w11) | 0; d = (a + ((t << 10) | (t >>> 22))) | 0;
    t = (c + (a ^ (d | ~b)) + 0x2ad7d2bb + w2) | 0; c = (d + ((t << 15) | (t >>> 17))) | 0;
    t = (b + (d ^ (c | ~a)) + 0xeb86d391 + w9) | 0; b = (c + ((t << 21) | (t >>> 11))) | 0;
    st[0] = (st[0] + a) | 0;
    st[1] = (st[1] + b) | 0;
    st[2] = (st[2] + c) | 0;
    st[3] = (st[3] + d) | 0;
  }
}

/** MD5 of a whole byte array or string. */
export function md5(data) {
  return new Md5().update(typeof data === "string" ? new TextEncoder().encode(data) : data).hex();
}

/** MD5 of a Blob/File, read in slices so memory stays flat. */
export async function md5Blob(blob, { onProgress, signal } = {}) {
  const h = new Md5();
  const step = 8 * 1024 * 1024;
  for (let off = 0; off < blob.size; off += step) {
    if (signal?.aborted) throw new DOMException("已取消", "AbortError");
    h.update(new Uint8Array(await blob.slice(off, off + step).arrayBuffer()));
    onProgress?.(Math.min(1, (off + step) / blob.size));
  }
  return h.hex();
}
