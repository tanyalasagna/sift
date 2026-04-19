// Sift — H&M Checkout Button Detection
// Intercepts "Continue to checkout" on H&M's bag page.
// Uses capture-phase event delegation so React's synthetic event handlers
// are pre-empted. After the Sift flow, bypasses the interceptor to let
// the original click through.
//
// Exposes window.SiftCheckout for use by content.js.

(function () {
  'use strict';

  console.log('[Sift] checkout-detection loaded on', location.href);

  // Loose text match — collapse all whitespace so multiline innerText,
  // React fragments, and hidden child spans don't break the match.
  function hasCheckoutText(el) {
    const raw = (el.innerText || el.textContent || '');
    const text = raw.trim().replace(/\s+/g, ' ').toLowerCase();
    return text.includes('checkout');
  }

  // H&M-specific attribute selectors as a belt-and-suspenders fallback.
  // Anchor tags with a checkout href are also matched here.
  const HM_SELECTORS = [
    '[data-testid*="checkout"]',
    '[data-testid*="proceed"]',
    '[data-cid*="checkout"]',
    'button[class*="checkout"]',
    'a[href*="checkout"]',
  ];

  function isCheckoutBtn(el) {
    if (!el || typeof el.matches !== 'function') return false;
    const tag = el.tagName.toLowerCase();
    const clickable =
      tag === 'button' ||
      tag === 'a' ||
      el.getAttribute('role') === 'button' ||
      (tag === 'input' && /^(submit|button)$/i.test(el.type || ''));
    if (!clickable) return false;

    if (hasCheckoutText(el)) return true;

    return HM_SELECTORS.some(sel => { try { return el.matches(sel); } catch { return false; } });
  }

  // Walk up to 6 levels to find checkout button (click may land on child span/icon)
  function findCheckoutBtn(target) {
    let el = target;
    for (let i = 0; i < 6; i++) {
      if (!el) break;
      if (isCheckoutBtn(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  let _bypassed = false;
  let _clickHandler = null;

  window.SiftCheckout = {

    // onIntercept(btn): called with the intercepted button element when
    // the user clicks "Continue to checkout". Navigation is blocked until
    // bypass() is called.
    setup(onIntercept) {
      _bypassed = false;
      _clickHandler = function (e) {
        if (_bypassed) return; // Sift flow done — let it through
        const btn = findCheckoutBtn(e.target);
        if (!btn) return;
        console.log('[Sift] checkout button intercepted:', btn);
        e.preventDefault();
        e.stopImmediatePropagation(); // Block React handlers on this event
        onIntercept(btn);
      };
      document.addEventListener('click', _clickHandler, { capture: true });
      console.log('[Sift] click interceptor active');
    },

    // Call this when the Sift flow is complete to proceed to H&M's checkout.
    // Sets the bypass flag and re-fires the click on the original button so
    // H&M's own handlers run normally.
    bypass(btn) {
      _bypassed = true;
      if (btn && typeof btn.click === 'function') {
        btn.click();
      } else {
        // Fallback: navigate to H&M checkout URL
        const lang = document.documentElement.lang || 'en_us';
        window.location.href = `/${lang.replace('-', '_')}/checkout`;
      }
    },

    teardown() {
      if (_clickHandler) {
        document.removeEventListener('click', _clickHandler, { capture: true });
        _clickHandler = null;
      }
    },

  };

})();
