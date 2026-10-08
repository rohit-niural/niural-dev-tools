import { stashKey } from "./stash.js";
import { rowsFor } from "./rows.js";

/** @import { Field, Match } from "./extract.js" */

/**
 * @param {HTMLElement} root
 * @returns {void}
 */
function renderEmpty(root) {
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = "No PK on this page.";
  root.append(p);
}

/**
 * @param {Field} field
 * @returns {HTMLElement}
 */
function renderRow(field) {
  const row = document.createElement("div");
  row.className = "row";

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = field.label;

  const value = document.createElement("span");
  value.className = "value";
  value.textContent = field.value;

  const copy = document.createElement("button");
  copy.textContent = "Copy";
  copy.addEventListener("click", () => {
    navigator.clipboard
      .writeText(field.value)
      .then(() => {
        copy.textContent = "Copied";
        setTimeout(() => (copy.textContent = "Copy"), 900);
      })
      .catch(() => {
        // Denied/unavailable clipboard access must not look like success —
        // the whole point of this tool is not delivering a wrong value
        // silently.
        copy.textContent = "Failed";
        setTimeout(() => (copy.textContent = "Copy"), 900);
      });
  });

  row.append(label, value, copy);
  return row;
}

/**
 * Minimal shape check so a malformed stored value falls back to the empty state instead of throwing inside `main()`.
 *
 * @param {unknown} value
 * @returns {value is Match}
 */
function isMatch(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray(/** @type {{ fields?: unknown }} */ (value).fields)
  );
}

/** @returns {Promise<Match | null>} */
async function activeMatch() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return null;
  const key = stashKey(tab.id);
  const stash = await chrome.storage.session.get(key);
  const value = stash[key];
  return isMatch(value) ? value : null;
}

/** @returns {Promise<void>} */
async function main() {
  const root = document.getElementById("root");
  if (!root) return;

  // A failed/missing stash is treated the same as no match — the popup must
  // always render something rather than propagate a rejection and leave
  // `root` empty, which looks like a broken extension.
  /** @type {Match | null} */
  let match;
  try {
    match = await activeMatch();
  } catch {
    match = null;
  }

  if (!match) {
    renderEmpty(root);
    return;
  }

  const heading = document.createElement("h1");
  heading.textContent = match.name;
  root.append(heading, ...rowsFor(match).map(renderRow));
}

void main();
