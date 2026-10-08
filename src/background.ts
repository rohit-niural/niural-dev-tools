import { extract, type Match } from "./extract";
import { stashKey } from "./stash";

const BADGE_TEXT = "●";
const BADGE_COLOR = "#16a34a";

/**
 * Per-tab generation counter. Bumped at the start of every `refreshTab` call
 * so a call can tell, once its awaits resolve, whether a later call for the
 * same tab has since superseded it — otherwise two in-flight calls for a tab
 * with different URLs could apply their badge writes out of order.
 */
const generations = new Map<number, number>();

function bumpGeneration(tabId: number): number {
  const next = (generations.get(tabId) ?? 0) + 1;
  generations.set(tabId, next);
  return next;
}

function isCurrentGeneration(tabId: number, generation: number): boolean {
  return generations.get(tabId) === generation;
}

/**
 * Runs a fire-and-forget promise without letting a rejection become an
 * unhandled rejection in the worker, where it would otherwise land in the
 * extension's error card and mask real failures.
 */
function detach(promise: Promise<unknown>): void {
  void promise.catch(() => {});
}

/**
 * Recomputes a tab's badge and stash. Called on every event that can change
 * what a tab is showing; safe to call with a url the extension does not
 * recognise, which simply clears both.
 */
export async function refreshTab(tabId: number, url: string | undefined): Promise<void> {
  const generation = bumpGeneration(tabId);
  const match: Match | null = url ? extract(url) : null;

  if (!match) {
    await chrome.storage.session.remove(stashKey(tabId));
    if (!isCurrentGeneration(tabId, generation)) return;
    await chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }

  await chrome.storage.session.set({ [stashKey(tabId)]: match });
  if (!isCurrentGeneration(tabId, generation)) return;

  // An employer-only page is stashed for the popup but left unbadged: the
  // employer key is available on nearly every payroll page, so badging them
  // all would make the badge meaningless.
  if (match.kind !== "route") {
    await chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }

  await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
  await chrome.action.setBadgeText({ tabId, text: BADGE_TEXT });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // `url` is set on navigation; `status` covers SPA history updates that land
  // on the same tab without a fresh url event.
  if (changeInfo.url === undefined && changeInfo.status === undefined) return;
  detach(refreshTab(tabId, changeInfo.url ?? tab.url));
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  detach(chrome.tabs.get(tabId).then((tab) => refreshTab(tabId, tab.url)));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  generations.delete(tabId);
  detach(chrome.storage.session.remove(stashKey(tabId)));
});

/**
 * Scans every open tab and refreshes it. `chrome.storage.session` is cleared
 * on browser shutdown and no tab events fire for tabs restored from a
 * previous session, so without this a tab already sitting on a matching page
 * shows nothing until its next `onUpdated`/`onActivated` event.
 */
function scanOpenTabs(): void {
  detach(
    chrome.tabs.query({}).then((tabs) => {
      for (const tab of tabs) {
        if (tab.id !== undefined) detach(refreshTab(tab.id, tab.url));
      }
    }),
  );
}

chrome.runtime.onStartup.addListener(scanOpenTabs);
chrome.runtime.onInstalled.addListener(scanOpenTabs);
