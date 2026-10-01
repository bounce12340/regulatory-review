// Tiny DOM helpers. All user-supplied text goes through textContent (never innerHTML),
// which closes the stored-XSS holes the Streamlit version had with unsafe_allow_html.

/**
 * h("div", { class: "x", onclick: fn }, "text", childNode, [more, children])
 * Attributes starting with "on" become event listeners; null/false values are skipped.
 */
export function h(tag, attrs = {}, ...children) {
  const el = tag.startsWith("svg:")
    ? document.createElementNS("http://www.w3.org/2000/svg", tag.slice(4))
    : document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "value" && "value" in el) {
      el.value = value;
    } else if (key === "checked" || key === "selected" || key === "disabled") {
      el[key] = Boolean(value);
    } else {
      el.setAttribute(key, value === true ? "" : String(value));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else if (child instanceof Node) el.appendChild(child);
    else el.appendChild(document.createTextNode(String(child)));
  }
}

export function svg(tag, attrs = {}, ...children) {
  return h(`svg:${tag}`, attrs, ...children);
}

export function mount(target, ...nodes) {
  target.replaceChildren(...nodes.flat().filter(Boolean));
}

export function toast(message, kind = "info") {
  const host = document.getElementById("toast");
  const el = h("div", { class: `toast ${kind === "error" ? "error" : ""}` }, message);
  host.appendChild(el);
  setTimeout(() => el.remove(), kind === "error" ? 6000 : 3000);
}

export function download(filename, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Read a <form> into a plain object of trimmed strings / checkbox booleans. */
export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    out[el.name] = el.type === "checkbox" ? el.checked : el.value.trim();
  }
  return out;
}

/** Disable a submit button while an async action runs. */
export async function busy(button, fn, label = "處理中…") {
  const original = [...button.childNodes];
  button.disabled = true;
  button.replaceChildren(h("span", { class: "spinner", "aria-hidden": "true" }), label);
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.replaceChildren(...original);
  }
}

export function confirmDialog(message, { okLabel = "確定", danger = false } = {}) {
  return new Promise((resolve) => {
    const dlg = h("dialog", {},
      h("p", { style: "margin-top:0" }, message),
      h("div", { class: "btn-row", style: "justify-content:flex-end" },
        h("button", { class: "btn", onclick: () => dlg.close("cancel") }, "取消"),
        h("button", { class: `btn ${danger ? "btn-danger" : "btn-primary"}`, onclick: () => dlg.close("ok") }, okLabel),
      ),
    );
    dlg.addEventListener("close", () => { resolve(dlg.returnValue === "ok"); dlg.remove(); });
    document.body.appendChild(dlg);
    dlg.showModal();
  });
}

/** Labelled form field wrapper. */
export function field(label, input, help) {
  const id = input.id || `f-${Math.random().toString(36).slice(2, 9)}`;
  input.id = id;
  return h("div", { class: "field" }, h("label", { for: id }, label), input, help ? h("span", { class: "help" }, help) : null);
}
