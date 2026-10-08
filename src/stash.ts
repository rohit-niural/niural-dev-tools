/** Key under which a tab's Match is stashed in chrome.storage.session. */
export function stashKey(tabId: number): string {
  return `tab:${tabId}`;
}
