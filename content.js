// Sift v2 — Content Script Orchestrator (H&M only)
//
// All logic lives in the utility/module files loaded before this one:
//   utils/storage.js            → window.SiftStorage
//   utils/checkout-detection.js → window.SiftCheckout
//   cards/cards.js              → window.SiftCards
//   exit/exit.js                → window.SiftExit
//
// This file only orchestrates the flow.

(function () {
  'use strict';

  if (!/\bhm\.com$/.test(location.hostname)) return;
  if (window.__sift_initialized) return;
  window.__sift_initialized = true;

  async function main() {
    // Re-reads pillars from storage each time so popup changes are respected.
    SiftCheckout.setup(async (interceptedBtn) => {
      const { pillars } = await SiftStorage.getState();
      await SiftCards.show(interceptedBtn, pillars, () => {
        SiftCheckout.bypass(interceptedBtn);
      });
    });
  }

  main().catch(err => console.error('[Sift]', err));

})();
