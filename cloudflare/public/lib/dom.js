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
  // Keep at most two on screen so a burst of saves doesn't stack over the checklist.
  while (host.children.length >= 2) host.firstElementChild.remove();
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

/** Asks for a short text (e.g. why an item is not applicable). Resolves to the text, or null on cancel. */
export function textDialog(message, { label = "原因", value = "", okLabel = "確定", maxlength = 2000 } = {}) {
  return new Promise((resolve) => {
    const input = h("textarea", { class: "input", required: true, maxlength, "aria-label": label }, value);
    const dlg = h("dialog", {},
      h("form", {
        method: "dialog",
        onsubmit: (e) => {
          if (!input.value.trim()) { e.preventDefault(); input.focus(); return; }
          dlg.returnValue = "ok";
        },
      },
        h("div", { style: "margin-bottom:12px" }, message),
        field(label, input),
        h("div", { class: "btn-row", style: "justify-content:flex-end;margin-top:16px" },
          h("button", { class: "btn", type: "button", onclick: () => dlg.close("cancel") }, "取消"),
          h("button", { class: "btn btn-primary", type: "submit" }, okLabel),
        ),
      ),
    );
    dlg.addEventListener("close", () => { resolve(dlg.returnValue === "ok" ? input.value.trim() : null); dlg.remove(); });
    document.body.appendChild(dlg);
    dlg.showModal();
    input.focus();
  });
}

export function confirmDialog(message, { okLabel = "確定", danger = false } = {}) {
  return new Promise((resolve) => {
    const dlg = h("dialog", {},
      h("div", { style: "margin-bottom:16px" }, message),
      h("div", { class: "btn-row", style: "justify-content:flex-end" },
        h("button", { class: "btn", onclick: () => dlg.close("cancel") }, "取消"),
        h("button", { class: `btn ${danger ? "btn-danger-solid" : "btn-primary"}`, onclick: () => dlg.close("ok") }, okLabel),
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
