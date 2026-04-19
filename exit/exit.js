// Sift — Exit Flow
// Shown after the user clicks "I've decided to buy these items."
// Presents a calm, final reflection before proceeding to real checkout.
// Exposes window.SiftExit for use by cards.js.

(function () {
  'use strict';

  let _cssCache = null;

  async function loadCSS() {
    if (!_cssCache) {
      const url = chrome.runtime.getURL('exit/exit.css');
      _cssCache = await fetch(url).then(r => r.text());
    }
    return _cssCache;
  }

  window.SiftExit = {

    /**
     * Show the "Before you leave" exit modal.
     * @param {Function} onCheckout  Called when user clicks "Continue to checkout"
     */
    async show(onCheckout) {
      if (document.getElementById('sift-exit-host')) return;

      const css = await loadCSS();

      // ── Shadow DOM host ──────────────────────────────────────
      const host = document.createElement('div');
      host.id    = 'sift-exit-host';
      host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;';
      document.body.appendChild(host);

      const shadow = host.attachShadow({ mode: 'closed' });

      const styleEl = document.createElement('style');
      styleEl.textContent = css;
      shadow.appendChild(styleEl);

      // ── Markup ───────────────────────────────────────────────
      const root = document.createElement('div');
      root.innerHTML = `
        <div class="backdrop" id="backdrop"></div>
        <div class="modal" id="modal" role="dialog" aria-modal="true" aria-label="Before you go">

          <div class="headline">Before you leave, think about:</div>

          <ul class="think-list">
            <li>If it's worth the money</li>
            <li>If you have the space</li>
            <li>How often you'll use the item</li>
          </ul>

          <div class="sign-off">We hope you cherish your items!</div>

          <button class="btn-checkout" id="btn-checkout">Continue to checkout</button>

        </div>`;
      shadow.appendChild(root);

      // ── Animate in ───────────────────────────────────────────
      const modal = shadow.getElementById('modal');
      requestAnimationFrame(() =>
        requestAnimationFrame(() => modal.classList.add('visible'))
      );

      // ── Continue to checkout ──────────────────────────────────
      shadow.getElementById('btn-checkout').addEventListener('click', () => {
        // Fade out modal + backdrop, then proceed
        modal.style.transition = 'opacity 0.24s ease, transform 0.24s ease';
        modal.style.opacity    = '0';
        modal.style.transform  = 'translate(-50%, -48%) scale(0.96)';
        shadow.getElementById('backdrop').style.cssText +=
          ';opacity:0;transition:opacity 0.24s ease;';

        setTimeout(() => {
          host.remove();
          onCheckout();
        }, 250);
      });
    },

  };

})();
