// DTD validation for eCTD backbones (rules G.4 and I.4: index.xml must be valid against
// ich-ectd-3-2.dtd, tw-regional.xml against tw-regional.dtd with its .mod modules).
// Supports what those DTDs use: parameter entities (internal and SYSTEM), ELEMENT content
// models, and ATTLIST with CDATA / ID / enumerations and #REQUIRED / #IMPLIED / #FIXED.

import { walk } from "./xml.js";

/**
 * @param {string} text  the main DTD
 * @param {(system: string) => string|undefined} resolve  returns the text of an external module
 */
export function parseDtd(text, resolve = () => undefined) {
  const entities = new Map();
  const elements = new Map();
  const attlists = new Map();

  const expand = (s, depth = 0) => {
    if (depth > 20) throw new Error("DTD 參數實體巢狀過深");
    return s.replace(/%([A-Za-z_][\w.-]*);/g, (_, name) => {
      if (!entities.has(name)) throw new Error(`DTD 未定義參數實體 %${name};`);
      return expand(entities.get(name), depth + 1);
    });
  };

  const process = (src) => {
    src = src.replace(/<!--[\s\S]*?-->/g, " ");
    // Declarations and parameter-entity references, in order (later ones may use earlier).
    const re = /<!(ENTITY|ELEMENT|ATTLIST)\s+((?:[^>"']|"[^"]*"|'[^']*')*)>|%([A-Za-z_][\w.-]*);/g;
    let m;
    while ((m = re.exec(src))) {
      if (m[3]) {
        // A reference at top level pulls in that entity's declarations.
        const value = entities.get(m[3]);
        if (value === undefined) throw new Error(`DTD 未定義參數實體 %${m[3]};`);
        process(value);
        continue;
      }
      const [, kind, body] = m;
      if (kind === "ENTITY") {
        const e = /^%\s+([A-Za-z_][\w.-]*)\s+(?:"([^"]*)"|'([^']*)'|SYSTEM\s+(?:"([^"]*)"|'([^']*)'))\s*$/s.exec(body.trim());
        if (!e) continue; // general entities are not used by eCTD DTDs
        const [, name, v1, v2, s1, s2] = e;
        if (entities.has(name)) continue; // first declaration wins
        if (s1 ?? s2) {
          const ext = resolve(s1 ?? s2);
          if (ext === undefined) throw new Error(`找不到 DTD 模組「${s1 ?? s2}」`);
          entities.set(name, ext);
        } else entities.set(name, v1 ?? v2);
      } else if (kind === "ELEMENT") {
        const full = expand(body).trim();
        const e = /^(\S+)\s+([\s\S]+)$/.exec(full);
        if (!e) throw new Error(`無法解析 ELEMENT：${full.slice(0, 60)}`);
        elements.set(e[1], compileModel(e[2].trim()));
      } else {
        const full = expand(body).trim();
        const e = /^(\S+)\s*([\s\S]*)$/.exec(full);
        const defs = attlists.get(e[1]) ?? new Map();
        const tok = /([^\s()]+)\s+(\([^)]*\)|[A-Z]+)\s+(#REQUIRED|#IMPLIED|#FIXED\s+(?:"[^"]*"|'[^']*')|"[^"]*"|'[^']*')/g;
        let a;
        while ((a = tok.exec(e[2]))) {
          const [, name, type, dflt] = a;
          if (defs.has(name)) continue;
          const def = { type: type.startsWith("(") ? "enum" : type, values: null, required: dflt === "#REQUIRED", fixed: null };
          if (def.type === "enum") def.values = type.slice(1, -1).split("|").map((v) => v.trim());
          const f = /^#FIXED\s+["'](.*)["']$/s.exec(dflt);
          if (f) def.fixed = f[1];
          defs.set(name, def);
        }
        attlists.set(e[1], defs);
      }
    }
  };
  process(text);
  return { elements, attlists };
}

/** Turns a content model into a matcher over the child element names. */
function compileModel(model) {
  if (model === "EMPTY") return { kind: "empty" };
  if (model === "ANY") return { kind: "any" };
  if (/^\(\s*#PCDATA\s*\)\*?$/.test(model)) return { kind: "text" };
  if (/^\(\s*#PCDATA/.test(model)) {
    const names = model.replace(/^\(\s*#PCDATA\s*\|?/, "").replace(/\)\*?$/, "").split("|").map((s) => s.trim()).filter(Boolean);
    return { kind: "mixed", names: new Set(names) };
  }
  // Each child name becomes "name " in a string; the model becomes a regex over that string.
  let p = 0;
  const parse = () => {
    let out;
    if (model[p] === "(") {
      p++;
      const parts = [];
      let sep = null;
      for (;;) {
        skip();
        parts.push(parse());
        skip();
        const c = model[p++];
        if (c === ")") break;
        if (c !== "," && c !== "|") throw new Error(`無法解析內容模型：${model}`);
        sep = c;
      }
      out = sep === "|" ? `(?:${parts.join("|")})` : `(?:${parts.join("")})`;
    } else {
      const m = /^[^\s,|()?*+]+/.exec(model.slice(p));
      if (!m) throw new Error(`無法解析內容模型：${model}`);
      p += m[0].length;
      out = `(?:${m[0].replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")} )`;
    }
    if ("?*+".includes(model[p] ?? "x")) out += model[p++];
    return out;
  };
  const skip = () => { while (/\s/.test(model[p] ?? "")) p++; };
  const re = parse();
  return { kind: "children", re: new RegExp(`^${re}$`), model };
}

/**
 * Validates a parsed XML document against a parsed DTD.
 * @returns {{line: number, message: string}[]}
 */
export function validate(doc, dtd, rootName) {
  const errors = [];
  const err = (node, message) => errors.push({ line: node.line, message });
  if (doc.doctype?.name !== rootName) err(doc.root, `DOCTYPE 應為 ${rootName}`);
  if (doc.root.name !== rootName) err(doc.root, `根元素應為 <${rootName}>，卻是 <${doc.root.name}>`);
  const ids = new Map();
  for (const node of walk(doc.root)) {
    const model = dtd.elements.get(node.name);
    if (!model) { err(node, `<${node.name}> 未在 DTD 中宣告`); continue; }
    const hasText = node.text.trim().length > 0;
    if (model.kind === "empty" && (node.children.length || hasText)) err(node, `<${node.name}> 必須是空元素`);
    else if (model.kind === "text" && node.children.length) err(node, `<${node.name}> 只能含文字`);
    else if (model.kind === "mixed") {
      for (const c of node.children) if (!model.names.has(c.name)) err(c, `<${node.name}> 內不允許 <${c.name}>`);
    } else if (model.kind === "children") {
      if (hasText) err(node, `<${node.name}> 內不允許文字`);
      const seq = node.children.map((c) => `${c.name} `).join("");
      if (!model.re.test(seq)) {
        err(node, `<${node.name}> 的子元素不符合 DTD（應為 ${model.model.replace(/\s+/g, " ")}；實際為 ${node.children.map((c) => c.name).join(", ") || "無"}）`);
      }
    }
    const defs = dtd.attlists.get(node.name) ?? new Map();
    for (const [name, value] of Object.entries(node.attrs)) {
      const def = defs.get(name);
      if (!def) { err(node, `<${node.name}> 的屬性 ${name} 未在 DTD 中宣告`); continue; }
      if (def.fixed !== null && value !== def.fixed) err(node, `<${node.name}> 的屬性 ${name} 必須是「${def.fixed}」`);
      if (def.type === "enum" && !def.values.includes(value)) err(node, `<${node.name}> 的屬性 ${name}="${value}" 不在允許值（${def.values.join("、")}）內`);
      if (def.type === "ID") {
        if (!/^[A-Za-z_][\w.-]*$/.test(value)) err(node, `ID「${value}」格式不正確（須以英文字母或底線開頭）`);
        else if (ids.has(value)) err(node, `ID「${value}」重複（第 ${ids.get(value)} 行已使用）`);
        else ids.set(value, node.line);
      }
    }
    for (const [name, def] of defs) {
      if (def.required && !(name in node.attrs)) err(node, `<${node.name}> 缺少必要屬性 ${name}`);
    }
  }
  return errors;
}
