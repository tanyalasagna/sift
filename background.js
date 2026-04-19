// Sift v2 — Background Service Worker (Manifest V3)
//
// The popup reads/writes chrome.storage.local directly, so no relay is
// needed here. This worker handles install lifecycle events and is
// available as an extension point for future features (e.g. badge updates,
// cross-tab coordination).

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'OPEN_TAB') {
    chrome.tabs.create({ url: chrome.runtime.getURL(msg.path) });
  }
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    console.log('[Sift] installed — onboarding will appear on first H&M visit.');
  }
  if (reason === 'update') {
    console.log('[Sift] updated to', chrome.runtime.getManifest().version);
  }
});
