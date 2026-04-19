// Sift — Storage Utility (chrome.storage.local)
// Wraps persistent storage for pillar selections.
// Exposes window.SiftStorage for use by other content script modules.

(function () {
  'use strict';

  const KEY_PILLARS     = 'sift_pillars';
  const DEFAULT_PILLARS = ['money', 'space', 'need'];

  function get(keys) {
    return new Promise(resolve => chrome.storage.local.get(keys, resolve));
  }

  function set(items) {
    return new Promise(resolve => chrome.storage.local.set(items, resolve));
  }

  window.SiftStorage = {

    // Returns { pillars: string[] }
    async getState() {
      const data = await get([KEY_PILLARS]);
      return {
        pillars: Array.isArray(data[KEY_PILLARS]) && data[KEY_PILLARS].length
          ? data[KEY_PILLARS]
          : [...DEFAULT_PILLARS],
      };
    },

    async setPillars(pillars) {
      return set({ [KEY_PILLARS]: pillars });
    },

  };

})();
