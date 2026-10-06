// A small, strict XML parser for eCTD backbone files. It reports well-formedness errors with
// line numbers (validation rules G.3 / I.3), keeps the DOCTYPE and processing instructions
// (G.5, G.6, I.5, I.6) and runs the same in the browser and in tests (no DOMParser needed).

/**
 * @typedef {{name: string, attrs: Record<string, string>, children: XmlNode[], text: string, line: number, parent: XmlNode|null}} XmlNode
 * @typedef {{root: XmlNode, doctype: {name: string, system: string}|null, pis: {target: string, data: string}[]}} XmlDoc
 */

const NAME_START = /[A-Za-z_:À-￿]/;
const NAME = /[A-Za-z0-9_:.\-·À-￿]/;
const ENTITIES = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

export class XmlError extends Error {
  constructor(message, line) {
    super(`第 ${line} 行：${message}`);
    this.line = line;
  }
}

/** @returns {XmlDoc} */
export function parseXml(text) {
  let i = 0;
  let line = 1;
  const doc = { root: null, doctype: null, pis: [] };
  const stack = [];
  const fail = (msg) => { throw new XmlError(msg, line); };
  const advance = (n) => {
    for (let k = 0; k < n; k++) if (text.charCodeAt(i + k) === 10) line++;
    i += n;
  };
  const startsWith = (s) => text.startsWith(s, i);
  const skipTo = (s, what) => {
    const j = text.indexOf(s, i);
    if (j < 0) fail(`${what}沒有結束`);
    const body = text.slice(i, j);
    advance(j - i + s.length);
    return body;
  };
  const readName = () => {
    if (!NAME_START.test(text[i] ?? "")) fail(`這裡需要名稱，卻是「${text[i] ?? "檔案結尾"}」`);
    const s = i;
    while (i < text.length && NAME.test(text[i])) i++;
    return text.slice(s, i);
  };
  const skipSpace = () => {
    while (i < text.length && /\s/.test(text[i])) advance(1);
  };
  const decode = (raw) => raw.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);|&/g, (m, ent) => {
    if (!ent) fail("「&」必須寫成 &amp;");
    if (ent[0] === "#") return String.fromCodePoint(ent[1] === "x" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10));
    if (!(ent in ENTITIES)) fail(`未定義的實體 &${ent};`);
    return ENTITIES[ent];
  });

  if (text.charCodeAt(0) === 0xfeff) i = 1;
  while (i < text.length) {
    if (startsWith("<?")) {
      advance(2);
      const target = readName();
      const data = skipTo("?>", "處理指令").trim();
      if (target.toLowerCase() === "xml" && (doc.pis.length || doc.root || stack.length)) fail("XML 宣告只能在檔案最前面");
      doc.pis.push({ target, data });
    } else if (startsWith("<!--")) {
      advance(4);
      const body = skipTo("-->", "註解");
      if (body.includes("--")) fail("註解內不可有「--」");
    } else if (startsWith("<![CDATA[")) {
      if (!stack.length) fail("CDATA 只能在元素內");
      advance(9);
      stack[stack.length - 1].text += skipTo("]]>", "CDATA");
    } else if (startsWith("<!DOCTYPE")) {
      if (doc.root || stack.length || doc.doctype) fail("DOCTYPE 位置錯誤");
      advance(9);
      skipSpace();
      const name = readName();
      skipSpace();
      let system = "";
      if (startsWith("SYSTEM")) {
        advance(6);
        skipSpace();
        system = readQuoted();
      } else if (startsWith("PUBLIC")) {
        advance(6);
        skipSpace();
        readQuoted();
        skipSpace();
        system = readQuoted();
      }
      skipSpace();
      if (text[i] === "[") skipTo("]", "DOCTYPE 內部子集");
      skipSpace();
      if (text[i] !== ">") fail("DOCTYPE 沒有正確結束");
      advance(1);
      doc.doctype = { name, system };
    } else if (startsWith("</")) {
      advance(2);
      const name = readName();
      skipSpace();
      if (text[i] !== ">") fail(`結束標籤 </${name}> 沒有正確結束`);
      advance(1);
      const open = stack.pop();
      if (!open) fail(`多出結束標籤 </${name}>`);
      if (open.name !== name) fail(`結束標籤 </${name}> 與開始標籤 <${open.name}>（第 ${open.line} 行）不符`);
    } else if (text[i] === "<") {
      advance(1);
      const el = { name: readName(), attrs: {}, children: [], text: "", line, parent: stack[stack.length - 1] ?? null };
      for (;;) {
        const before = i;
        skipSpace();
        if (startsWith("/>") || text[i] === ">") break;
        if (i === before) fail(`<${el.name}> 的屬性之間需要空白`);
        const an = readName();
        skipSpace();
        if (text[i] !== "=") fail(`屬性 ${an} 缺少「=」`);
        advance(1);
        skipSpace();
        const raw = readQuoted();
        if (raw.includes("<")) fail(`屬性 ${an} 的值不可含「<」`);
        if (an in el.attrs) fail(`<${el.name}> 的屬性 ${an} 重複`);
        el.attrs[an] = decode(raw).replace(/[\t\n\r]/g, " ");
      }
      if (el.parent) el.parent.children.push(el);
      else if (doc.root) fail("XML 只能有一個根元素");
      else doc.root = el;
      if (startsWith("/>")) advance(2);
      else { advance(1); stack.push(el); }
    } else {
      const j = text.indexOf("<", i);
      const raw = text.slice(i, j < 0 ? text.length : j);
      if (stack.length) stack[stack.length - 1].text += decode(raw);
      else if (raw.trim()) fail("根元素以外不可有文字");
      advance(raw.length);
    }
  }
  if (stack.length) fail(`<${stack[stack.length - 1].name}>（第 ${stack[stack.length - 1].line} 行）沒有結束標籤`);
  if (!doc.root) fail("找不到根元素");
  return doc;

  function readQuoted() {
    const q = text[i];
    if (q !== '"' && q !== "'") fail("屬性值需用引號括住");
    advance(1);
    return skipTo(q, "引號");
  }
}

/** Every element below (and including) node, in document order. */
export function* walk(node) {
  yield node;
  for (const c of node.children) yield* walk(c);
}

/** Text with XML special characters escaped, for writing attributes and text. */
export function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
