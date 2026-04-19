// Sift — ESC Key Hold Detection
// Detects when the user holds the ESC key for a specified duration.
// Animates a circular progress ring provided by the caller.
// On completion, fires onComplete(). On early keyup, resets and cancels.
//
// Exposes window.SiftEscHold for use by cards.js.

(function () {
  'use strict';

  window.SiftEscHold = {

    /**
     * Start listening for an ESC hold.
     *
     * @param {object} opts
     * @param {Element}  opts.ringContainer  - Element to show/hide (gets .visible class)
     * @param {SVGElement} opts.ringFill     - SVG <circle> whose stroke-dashoffset we animate
     * @param {number}   opts.circumference  - 2πr of the SVG circle
     * @param {number}   [opts.holdMs=5000] - How long user must hold ESC (ms)
     * @param {Function} opts.onComplete    - Called when hold is completed
     * @returns {Function} cleanup — call to remove all listeners and reset state
     */
    start({ ringContainer, ringFill, circumference, holdMs = 5000, onComplete }) {
      let active    = false;
      let timer     = null;
      let startTime = null;

      // Initialise dasharray so the ring is hidden (full offset = full circle)
      ringFill.style.strokeDasharray  = String(circumference);
      ringFill.style.strokeDashoffset = String(circumference);

      function reset() {
        if (timer) { clearTimeout(timer); timer = null; }
        active    = false;
        startTime = null;
        ringContainer.classList.remove('visible');
        ringFill.style.strokeDashoffset = String(circumference);
      }

      function tick() {
        const elapsed  = Date.now() - startTime;
        const progress = Math.min(elapsed / holdMs, 1);
        ringFill.style.strokeDashoffset = String(circumference * (1 - progress));

        if (progress >= 1) {
          cleanup();
          onComplete();
        } else {
          timer = setTimeout(tick, 50);
        }
      }

      function onKeydown(e) {
        if (e.key !== 'Escape' || active) return;
        e.preventDefault(); // Prevent browser ESC behaviour while Sift is open
        active    = true;
        startTime = Date.now();
        ringContainer.classList.add('visible');
        timer = setTimeout(tick, 50);
      }

      function onKeyup(e) {
        if (e.key === 'Escape' && active) reset();
      }

      document.addEventListener('keydown', onKeydown);
      document.addEventListener('keyup',   onKeyup);

      function cleanup() {
        document.removeEventListener('keydown', onKeydown);
        document.removeEventListener('keyup',   onKeyup);
        reset();
      }

      return cleanup;
    },

  };

})();
