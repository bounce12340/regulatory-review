// Suggests which checklist item each uploaded file belongs to. The user confirms or changes
// every suggestion before anything is uploaded, so this aims to be right most of the time,
// not always. Signals, strongest first:
// 1. a CTD node in the folder path or file name that matches the item's node;
// 2. a form code shared with the item name (表A, 表B-3, 表C-1, SMF, CPP, Ⅳ …);
// 3. overlapping Chinese words between the file name and the item name.
import { itemNodes, modulesIn, nodesIn } from "./ectd.js";

const MIN_SCORE = 24;

const CODE_RE = /表\s*[a-c](?:-\d+)?|[a-c]-\d+|smf|cpp|gmp|gdp|rtf|bse|cep|cos|dmf|coa|psur|rmp|ccdp|[ⅰ-ⅷⅠ-Ⅷ]/gi;

function codes(text) {
  return new Set((String(text).match(CODE_RE) ?? []).map((c) => c.replace(/\s+/g, "").toLowerCase()));
}

/** Two-character runs of CJK text plus latin words of 3+ letters. */
function grams(text) {
  const out = new Set();
  const s = String(text).toLowerCase();
  for (const run of s.match(/[一-鿿]+/g) ?? []) {
    for (let i = 0; i + 1 < run.length; i++) out.add(run.slice(i, i + 2));
  }
  for (const w of s.match(/[a-z]{3,}/g) ?? []) out.add(w);
  return out;
}

function nodeScore(fileNodes, nodes) {
  let best = 0;
  for (const f of fileNodes) {
    for (const n of nodes) {
      if (f === n) best = Math.max(best, 100);
      else if (f.startsWith(`${n}.`)) best = Math.max(best, 80); // file is deeper than the item (3.2.s.7.3 → 3.2.s.7)
      else if (n.startsWith(`${f}.`)) best = Math.max(best, 40); // item is deeper than the file
    }
  }
  return best;
}

/**
 * @param {{name: string, path?: string}[]} files  path is the folder-relative path when a folder was picked
 * @param {{id: number, item_key: string|null, item_name: string}[]} items
 * @returns {{itemId: number|null, score: number, reason: string}[]} one suggestion per file
 */
export function suggestItems(files, items) {
  const prepared = items.map((item) => ({
    item, nodes: itemNodes(item), codes: codes(item.item_name), grams: grams(item.item_name),
    modules: new Set([...modulesIn(item.item_name), ...itemNodes(item).map((n) => n[0])]),
  }));
  return files.map((file) => {
    const where = file.path || file.name;
    const fNodes = nodesIn(where);
    const fCodes = codes(file.name);
    const fModules = modulesIn(where);
    const fGrams = grams(file.name.replace(/\.[^.]+$/, ""));
    let best = { itemId: null, score: 0, reason: "" };
    for (const p of prepared) {
      const byNode = nodeScore(fNodes, p.nodes);
      const sharedCodes = [...fCodes].filter((c) => p.codes.has(c)).length;
      const shared = [...fGrams].filter((g) => p.grams.has(g)).length;
      const byWords = p.grams.size ? Math.round((40 * shared) / Math.min(p.grams.size, Math.max(fGrams.size, 1))) : 0;
      // Same CTD module is a weak hint, enough to separate "M5 臨床摘要" from an M1 form.
      const byModule = !byNode && fModules.some((m) => p.modules.has(m)) ? 20 : 0;
      const score = byNode + 30 * sharedCodes + byWords + byModule;
      if (score > best.score) {
        const reason = byNode ? `CTD 節點 ${fNodes.join("、")}` : sharedCodes ? "表單代號相同" : "名稱相近";
        best = { itemId: p.item.id, score, reason };
      }
    }
    return best.score >= MIN_SCORE ? best : { itemId: null, score: best.score, reason: "找不到對應項目" };
  });
}
