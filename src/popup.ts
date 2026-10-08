import { stashKey } from "./stash";
import type { Field, Match } from "./extract";
import { rowsFor } from "./rows";

function renderEmpty(root: HTMLElement): void {
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = "No PK on this page.";
  root.append(p);
}

function renderRow(field: Field): HTMLElement {
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

/** Minimal shape check so a malformed stored value falls back to the empty state instead of throwing inside `main()`. */
function isMatch(value: unknown): value is Match {
  return (
    typeof value === "object" && value !== null && Array.isArray((value as { fields?: unknown }).fields)
  );
}

async function activeMatch(): Promise<Match | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return null;
  const key = stashKey(tab.id);
  const stash = await chrome.storage.session.get(key);
  const value = stash[key];
  return isMatch(value) ? value : null;
}

async function main(): Promise<void> {
  const root = document.getElementById("root");
  if (!root) return;

  // A failed/missing stash is treated the same as no match — the popup must
  // always render something rather than propagate a rejection and leave
  // `root` empty, which looks like a broken extension.
  let match: Match | null;
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
