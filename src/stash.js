/**
 * Key under which a tab's Match is stashed in chrome.storage.session.
 *
 * @param {number} tabId
 * @returns {string}
 */
export function stashKey(tabId) {
  return `tab:${tabId}`;
}
