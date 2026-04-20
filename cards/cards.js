// Sift — Card Experience
// Full-screen overlay with solitaire-style card stack, gear icon, shuffle,
// and "I've decided" → exit flow trigger.
// Exposes window.SiftCards for use by content.js.

(function () {
  'use strict';

  // ── Pillar metadata ──────────────────────────────────────────

  const PILLAR_META = {
    money: {
      label:       'Money',
      emoji:       '💰',
      accent:      '#4caf7d',
      accentLight: '#e8f5ee',
      accentDark:  '#2e7d52',
      backBg:      '#0f2018',
      bg:          '#e8c88d',
      text:        '#5c3d2e',
      tagline:     'Can I actually swing this?',
    },
    space: {
      label:       'Space',
      emoji:       '🏠',
      accent:      '#4a90d9',
      accentLight: '#e8f0fa',
      accentDark:  '#2c5f9e',
      backBg:      '#0f1a28',
      bg:          '#a8b99a',
      text:        '#ffffff',
      tagline:     'Will it all have a home?',
    },
    need: {
      label:       'Need',
      emoji:       '🪞',
      accent:      '#e8962e',
      accentLight: '#fdf0e0',
      accentDark:  '#b56b0f',
      backBg:      '#281a0f',
      bg:          '#c49a8a',
      text:        '#f5ede4',
      tagline:     'Do I want it or need it?',
    },
  };

  const CARD_W     = 300;
  const CARD_H     = 420;
  const FAN_MAX    = 28;   // px reserved around card for fan overflow
  const BACK_COUNT = 4;    // number of back cards visible behind the front card

  // ── Resource loaders (cached after first fetch) ───────────────

  let _css     = null;
  let _prompts = null;

  async function loadCSS() {
    if (!_css) {
      _css = await fetch(chrome.runtime.getURL('cards/cards.css')).then(r => r.text());
    }
    return _css;
  }

  async function loadPrompts() {
    if (!_prompts) {
      _prompts = await fetch(chrome.runtime.getURL('prompts/prompts.json')).then(r => r.json());
    }
    return _prompts;
  }

  // ── Deck builder ─────────────────────────────────────────────
  // Rules:
  //   1 pillar  → all 4 cards from that pillar
  //   2 pillars → 3 random cards from each  (6 total)
  //   3 pillars → 2 random cards from each  (6 total)
  // Returns the complete sequence: [intro, ...shuffled pillar cards, outro]

  function shuffleArr(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildDeck(activePillars, prompts) {
    const count          = activePillars.length;
    const cardsPerPillar = count === 1 ? 4 : count === 2 ? 3 : 2;

    const pillarCards = [];
    for (const pid of activePillars) {
      const pool = prompts[pid];
      if (!pool?.length) continue;
      const picked = shuffleArr([...pool]).slice(0, cardsPerPillar);
      picked.forEach((item, i) => {
        pillarCards.push({ type: pid, index: i, prompt: item.prompt });
      });
    }
    shuffleArr(pillarCards);

    return [{ type: 'intro' }, ...pillarCards, { type: 'outro' }];
  }

  // ── Card inner HTML factories ─────────────────────────────────

  function introCardHTML() {
    return `
      <div class="intro-parchment">
        <div class="intro-corner intro-corner-tl"></div>
        <div class="intro-corner intro-corner-br"></div>
        <div class="intro-content">
          <p class="intro-wordmark">sift.</p>
          <p class="intro-body">You picked some <span class="intro-highlight c-need">things to</span> <span class="intro-highlight c-money">think</span> <span class="intro-highlight c-space">about</span> when you set up <span class="intro-highlight c-terra">Sift.</span> Here they are.</p>
          <p class="intro-hint">Shuffle through, take your time, and jot down some thoughts.</p>
        </div>
      </div>`;
  }

  const HEART_SVG = `<svg width="26" height="24" viewBox="0 0 24 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="white" stroke-width="2.5"/></svg>`;

  const DOLLAR_SVG = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/><path d="M12 18V6"/></svg>`;

  const WAREHOUSE_SVG = `<svg width="26" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><path d="M6 10h12"/></svg>`;

  const PILLAR_ICONS = {
    need:  HEART_SVG,
    money: DOLLAR_SVG,
    space: WAREHOUSE_SVG,
  };

  // Single factory for all three pillar types.
  // --pillar-bg is set on the card element in renderStack from PILLAR_META.
  function promptCardHTML(type, prompt) {
    const icon = PILLAR_ICONS[type];
    return `
      <div class="prompt-parchment">
        <div class="prompt-corner prompt-corner-tl">${icon}</div>
        <div class="prompt-corner prompt-corner-br">${icon}</div>
        <div class="prompt-content">
          <p class="prompt-text">${prompt}</p>
          <textarea class="prompt-input" placeholder="TYPE HERE"></textarea>
        </div>
      </div>`;
  }

  function outroCardHTML(hasTyped) {
    const actionBtn = hasTyped
      ? `<button class="outro-action-btn outro-save-btn" id="outro-action-btn">
           <span class="outro-btn-fill"></span>
           <span class="outro-btn-label">Hold to save responses</span>
         </button>`
      : `<button class="outro-action-btn outro-exit-btn" id="outro-action-btn">Exit Sift</button>`;
    return `
      <div class="outro-parchment">
        <div class="outro-corner outro-corner-tl"></div>
        <div class="outro-corner outro-corner-br"></div>
        <div class="outro-content">
          <div class="outro-wordmark-row">
            <p class="outro-wordmark">sift</p>
            <div class="outro-dots" aria-hidden="true">
              <span class="outro-dot outro-dot-money"></span>
              <span class="outro-dot outro-dot-space"></span>
              <span class="outro-dot outro-dot-need"></span>
            </div>
          </div>
          ${!hasTyped ? `<p class="outro-body">That's it! The call is yours.</p>
          <p class="outro-body">If you go through with this purchase,</p>
          <div class="outro-cherish-row">
            <p class="outro-cherish">cherish it</p>
            <svg class="outro-heart" width="18" height="17" viewBox="0 0 24 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#c49a8a"/>
            </svg>
          </div>` : ''}
          ${actionBtn}
        </div>
      </div>`;
  }

  // ── Stack DOM renderer ────────────────────────────────────────
  // All cards start at (0,0) — perfectly stacked. Back cards fan out via
  // the .fanned class (applied after entrance). Front card is always on top.
  // cardSpec: { type: 'intro' } | { type: 'outro' } | { type: 'need', index: N, prompt: string }
  // cardAnswers: { need: string[] } — persists textarea values across card switches

  // activePillars drives the back-card colors: cycles through active pillar
  // colors so the peeking edges match the user's selection.
  // data-depth: 0=closest to front (smallest fan), 3=furthest (largest fan).
  function renderStack(stackEl, cardSpec, cardAnswers, activePillars) {
    stackEl.innerHTML = '';
    const backCount = BACK_COUNT;

    // Container sized to hold the card + maximum fan expansion room
    stackEl.style.width  = `${CARD_W + FAN_MAX}px`;
    stackEl.style.height = `${CARD_H + FAN_MAX}px`;

    // i=0: furthest back; i=backCount: front card
    for (let i = 0; i <= backCount; i++) {
      const isFront = (i === backCount);
      const card    = document.createElement('div');

      // All cards perfectly stacked at (0,0) — fan positions applied via .fanned
      card.style.left   = '0';
      card.style.top    = '0';
      card.style.zIndex = String(i + 1); // front gets highest

      if (isFront) {
        if (cardSpec.type === 'outro') {
          const hasTyped = Object.values(cardAnswers).some(arr => arr.some(v => v.trim() !== ''));
          card.className = 'card outro-card';
          card.innerHTML = outroCardHTML(hasTyped);
        } else if (PILLAR_META[cardSpec.type]) {
          const meta = PILLAR_META[cardSpec.type];
          card.className = 'card prompt-card';
          card.style.setProperty('--pillar-bg', meta.bg);
          card.innerHTML = promptCardHTML(cardSpec.type, cardSpec.prompt);
          const textarea = card.querySelector('.prompt-input');
          textarea.value = cardAnswers[cardSpec.type][cardSpec.index] || '';
          textarea.addEventListener('input', e => {
            cardAnswers[cardSpec.type][cardSpec.index] = e.target.value;
          });
        } else {
          card.className = 'card intro-card';
          card.innerHTML = introCardHTML();
        }
      } else {
        // Cycle through active pillars so the peek colors match the selection.
        // 1 pillar → same color on all 4 backs
        // 2 pillars → alternates A B A B
        // 3 pillars → cycles A B C A
        const pid = activePillars[i % activePillars.length];
        card.className = 'card back-card';
        card.style.setProperty('--back-bg', PILLAR_META[pid].bg);
        // depth 0 = closest to front (smallest fan), depth 3 = furthest (largest fan)
        card.dataset.depth = String(backCount - 1 - i);
      }

      stackEl.appendChild(card);
    }
  }

  // ── Pillar change animation: fade → rebuild → fade in ─────────

  // Pillar toggles: rebuild deck and update the stack.
  //
  // Key insight: the deck always resets to index 0 (the intro card). If the
  // front card is already the intro card, replacing it would destroy and recreate
  // identical DOM — causing a visible blink between destroy and repaint.
  // Fix: when the front card isn't changing, update only the back card colours
  // in-place (no innerHTML wipe). Only animate when the front card actually differs.
  function reshuffleStack(stackEl, deck, activePillars, prompts, cardAnswers, onDone) {
    // Reset any stackEl-level inline styles left over from navigateTo
    stackEl.style.transition = 'none';
    stackEl.style.opacity    = '';
    stackEl.style.transform  = '';

    // Determine whether the visible front card needs to change.
    // After reshuffle we always go to deck[0] = intro card.
    const frontIsAlreadyIntro = stackEl.lastElementChild?.classList.contains('intro-card');

    // Rebuild deck array (in-place mutation keeps existing callers working)
    const rebuilt = buildDeck(activePillars, prompts);
    deck.length = 0;
    deck.push(...rebuilt);
    onDone(); // currentDeckIndex → 0, updateNavButtons()

    if (frontIsAlreadyIntro) {
      // Front card is unchanged — update only the back card colours in-place.
      // No DOM replacement → no blink.
      stackEl.querySelectorAll('.back-card').forEach((card, i) => {
        const pid = activePillars[i % activePillars.length];
        card.style.setProperty('--back-bg', PILLAR_META[pid].bg);
      });
    } else {
      // Front card is a pillar or outro card; cross-fade to the intro card.
      const FADE_MS = 140;
      const oldFront = stackEl.lastElementChild;
      if (oldFront) {
        oldFront.style.transition = `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`;
        oldFront.style.opacity    = '0';
        oldFront.style.transform  = 'scale(0.93)';
      }

      setTimeout(() => {
        renderStack(stackEl, deck[0], cardAnswers, activePillars);
        applyFan(stackEl, false);

        const newFront = stackEl.lastElementChild;
        if (newFront) {
          newFront.style.transition = 'none';
          newFront.style.opacity    = '0';
          newFront.style.transform  = 'scale(0.93)';
          requestAnimationFrame(() => requestAnimationFrame(() => {
            newFront.style.transition = 'opacity 220ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
            newFront.style.opacity    = '1';
            newFront.style.transform  = 'scale(1)';
          }));
        }
      }, FADE_MS + 20);
    }
  }

  // ── Fan helpers ───────────────────────────────────────────────

  // Adds .fanned to all back cards in the stack.
  // stagger=true: back-to-front stagger (entrance); stagger=false: instant (reshuffle).
  function applyFan(stackEl, stagger) {
    stackEl.querySelectorAll('.back-card').forEach(card => {
      const depth = parseInt(card.dataset.depth, 10);
      if (stagger) {
        // depth=3 (furthest) fans first → delay=0; depth=0 (closest) fans last → delay=210ms
        card.style.transitionDelay = `${(BACK_COUNT - 1 - depth) * 70}ms`;
      } else {
        card.style.transitionDelay = '0ms';
      }
      card.classList.add('fanned');
    });
  }

  // ── Public API ───────────────────────────────────────────────

  window.SiftCards = {

    /**
     * Show the card experience.
     * @param {Element}   checkoutBtn   The intercepted H&M checkout button
     * @param {string[]}  activePillars Pillar IDs from storage
     * @param {Function}  onCheckout    Called when user completes the flow
     */
    async show(checkoutBtn, activePillars, onCheckout) {
      if (document.getElementById('sift-cards-host')) return;

      // Inject Google Fonts into document.head so they resolve inside closed Shadow DOM
      if (!document.getElementById('sift-fonts')) {
        const link = document.createElement('link');
        link.id   = 'sift-fonts';
        link.rel  = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Happy+Monkey&family=Geist:wght@300;400;600;700;900&family=Geist+Mono:wght@600&display=swap';
        document.head.appendChild(link);
      }

      const [css, prompts] = await Promise.all([loadCSS(), loadPrompts()]);

      let currentPillars = [...activePillars];
      const deck         = buildDeck(currentPillars, prompts);

      if (!deck.length) { onCheckout(); return; }

      // ── Scroll lock ──────────────────────────────────────────────
      // Capture originals so dismiss() can restore them exactly.
      const scrollbarWidth   = window.innerWidth - document.documentElement.clientWidth;
      const origHtmlOverflow = document.documentElement.style.overflow;
      const origBodyOverflow = document.body.style.overflow;
      const origBodyPadding  = document.body.style.paddingRight;

      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        // Compensate for scrollbar disappearing so the layout doesn't jump.
        const currentPadding = parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
        document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
      }

      // ── Shadow DOM host (full-viewport, transparent, pointer-events:none) ──
      // Individual interactive children opt back in with pointer-events:auto.
      const host = document.createElement('div');
      host.id    = 'sift-cards-host';
      host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
      document.body.appendChild(host);

      const shadow = host.attachShadow({ mode: 'closed' });
      const styleEl = document.createElement('style');
      styleEl.textContent = css;
      shadow.appendChild(styleEl);

      // ── Markup ───────────────────────────────────────────────
      const root = document.createElement('div');
      root.innerHTML = `

        <!-- Focus backdrop: darkens + blurs host page during Phase 2+ -->
        <div class="sift-backdrop" id="sift-backdrop"></div>

        <!-- Phase 1 / Phase 4: overlay on the checkout button itself -->
        <div class="sift-btn-overlay" id="sift-btn-overlay" aria-hidden="true">
          <div class="bounce-dots" id="bounce-dots">
            <span class="bounce-dot" style="--d:0ms;   --c:#e8c88d;"></span>
            <span class="bounce-dot" style="--d:160ms; --c:#a8b99a;"></span>
            <span class="bounce-dot" style="--d:320ms; --c:#c49a8a;"></span>
          </div>
          <div class="btn-done-row" id="btn-done-row">
            <span class="btn-done-label"><span class="sift-font-loop">Sifting</span></span>
            <span class="btn-done-dot" style="background:#e8c88d;"></span>
            <span class="btn-done-dot" style="background:#a8b99a;"></span>
            <span class="btn-done-dot" style="background:#c49a8a;"></span>
          </div>
        </div>

        <!-- Phase 2 / Phase 3: layout wrapper slides panel + control column in together -->
        <div class="sift-layout" id="sift-layout">

          <div class="sift-panel" id="sift-panel">
            <div class="main">
              <div class="deck-float-wrap">
                <div class="stack-wrap" id="stack-wrap"></div>
              </div>
              <div class="nav-wrap" id="nav-wrap">
                <button class="nav-arrow-btn" id="nav-back-btn" aria-label="Previous card" disabled>
                  <svg viewBox="0 0 24 24" fill="#f5ede4" aria-hidden="true">
                    <path d="M18 15h-6v4l-7-7 7-7v4h6v6z"/>
                  </svg>
                </button>
                <button class="nav-arrow-btn" id="nav-next-btn" aria-label="Next card">
                  <svg viewBox="0 0 24 24" fill="#f5ede4" aria-hidden="true">
                    <path d="M6 9h6V5l7 7-7 7v-4H6V9z"/>
                  </svg>
                </button>
              </div>
              <div class="nav-dots" id="nav-dots" aria-hidden="true"></div>
              <button class="ctrl-dismiss-btn" id="ctrl-close-btn">
                <span class="ctrl-dismiss-label">I don't need Sift today</span>
              </button>
            </div>

          </div>

          <!-- Control column: edit + dismiss icons, settings popover -->
          <div class="ctrl-col" id="ctrl-col">
            <button class="ctrl-edit-btn" id="ctrl-edit-btn" aria-label="Customize your Sift" aria-expanded="false">
              <span class="ctrl-edit-icon-wrap">
                <svg class="ctrl-edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                </svg>
              </span>
            </button>

          </div>

        </div>

        <!-- Gear modal — full-screen backdrop + centered popover card -->
        <div class="gear-backdrop" id="gear-backdrop" role="dialog" aria-modal="true" aria-label="Gut-check settings">
          <div class="gear-popover" id="gear-popover">
            <div class="gear-pop-header">
              <p class="gear-pop-title">What's on your mind?</p>
              <p class="gear-pop-sub">Pick what you care about</p>
            </div>
            <div class="gear-pillar-grid">
              ${Object.entries(PILLAR_META).map(([pid, meta]) => `
                <button
                  class="gear-pillar-card ${currentPillars.includes(pid) ? '' : 'off'}"
                  data-pid="${pid}"
                  style="--bg:${meta.bg};--text:${meta.text};"
                  aria-pressed="${currentPillars.includes(pid)}">
                  <div class="gear-pillar-dot"></div>
                  <div class="gear-pillar-bottom">
                    <span class="gear-pillar-label">${meta.label}</span>
                    <span class="gear-pillar-tagline">${meta.tagline}</span>
                  </div>
                </button>
              `).join('')}
            </div>
            <button class="gear-prev-sifts">
              View previous sifts
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4.5M9.5 2.5V7.5"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Dismiss modal — shown when "I don't need Sift today" is clicked -->
        <div class="dismiss-modal" id="dismiss-modal" role="dialog" aria-modal="true" aria-labelledby="dismiss-headline">
          <div class="dismiss-modal-card">
            <p class="dismiss-headline" id="dismiss-headline">That's okay!</p>
            <p class="dismiss-body">Love an intentional purchase! If you've thought it through and it feels right, it's all yours.</p>
            <p class="dismiss-body">If you change your mind, you can always wake Sift back up from your browser's toolbar.</p>
            <button class="dismiss-got-it-btn" id="dismiss-got-it-btn">Got it</button>
          </div>
        </div>`;
      shadow.appendChild(root);

      // ── Position button overlay exactly over the checkout button ──
      const btnRect    = checkoutBtn.getBoundingClientRect();
      const btnOverlay = shadow.getElementById('sift-btn-overlay');
      btnOverlay.style.top          = `${btnRect.top}px`;
      btnOverlay.style.left         = `${btnRect.left}px`;
      btnOverlay.style.width        = `${btnRect.width}px`;
      btnOverlay.style.height       = `${btnRect.height}px`;
      btnOverlay.style.borderRadius = window.getComputedStyle(checkoutBtn).borderRadius || '4px';

      const backdrop      = shadow.getElementById('sift-backdrop');
      const layout        = shadow.getElementById('sift-layout');
      const panel         = shadow.getElementById('sift-panel');
      const stackEl       = shadow.getElementById('stack-wrap');
      const navWrapEl     = shadow.getElementById('nav-wrap');
      const ctrlColEl     = shadow.getElementById('ctrl-col');
      const editBtn       = shadow.getElementById('ctrl-edit-btn');
      const skipBtn       = shadow.getElementById('ctrl-close-btn');
      const gearPop       = shadow.getElementById('gear-popover');
      const gearBackdrop  = shadow.getElementById('gear-backdrop');
      const bounceEl      = shadow.getElementById('bounce-dots');
      const doneEl        = shadow.getElementById('btn-done-row');
      const dismissModal  = shadow.getElementById('dismiss-modal');
      const gotItBtn      = shadow.getElementById('dismiss-got-it-btn');

      let currentDeckIndex = 0;
      const cardAnswers    = { need: ['', '', '', ''], money: ['', '', '', ''], space: ['', '', '', ''] };

      // ── Dismiss ──────────────────────────────────────────────
      function dismiss(cb, durationMs = 300) {

        // Restore host page scroll before removing the host node.
        document.documentElement.style.overflow = origHtmlOverflow;
        document.body.style.overflow            = origBodyOverflow;
        document.body.style.paddingRight        = origBodyPadding;

        layout.style.transition     = `transform ${durationMs}ms cubic-bezier(0.4, 0, 1, 1), opacity ${durationMs}ms ease`;
        layout.style.transform      = 'translateX(-100%) translateY(-50%)';
        layout.style.opacity        = '0';
        btnOverlay.style.transition = `opacity ${durationMs}ms ease`;
        btnOverlay.style.opacity    = '0';
        backdrop.classList.remove('visible');
        document.removeEventListener('keydown', onModalEsc, { capture: true });
        setTimeout(() => { host.remove(); cb?.(); }, durationMs + 20);
      }

      // Attach the correct click handler to the outro card's action button.
      // Called after every renderStack() so the button is always wired up.
      function wireOutroBtn() {
        const btn = stackEl.querySelector('#outro-action-btn');
        if (!btn) return;

        if (btn.classList.contains('outro-exit-btn')) {
          btn.addEventListener('click', () => {
            showDismissModal = true;
            dismissModal.classList.add('visible');
          });
          return;
        }

        if (!btn.classList.contains('outro-save-btn')) return;

        const fill  = btn.querySelector('.outro-btn-fill');
        const label = btn.querySelector('.outro-btn-label');
        let holdTimer = null;
        let saved     = false;

        function startHold() {
          if (saved) return;
          // Begin left-to-right fill over 2 seconds
          fill.style.transition = 'transform 2s linear';
          fill.style.transform  = 'scaleX(1)';
          label.style.color     = '#f5ede4';

          holdTimer = setTimeout(() => {
            saved = true;

            // Step 1: Save confirmation
            label.textContent = 'Sift saved ✓';

            // Subtle scale pulse
            btn.style.transition = 'transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1)';
            btn.style.transform  = 'scale(1.06)';
            setTimeout(() => { btn.style.transform = 'scale(1)'; }, 150);

            // Step 2: Trigger tuck-away after 1.5s confirmation window
            setTimeout(() => {

              // Restore scroll before animating out
              document.documentElement.style.overflow = origHtmlOverflow;
              document.body.style.overflow            = origBodyOverflow;
              document.body.style.paddingRight        = origBodyPadding;

              document.removeEventListener('keydown', onModalEsc, { capture: true });
              document.removeEventListener('keydown', onKeyDown);

              const TUCK_MS = 520;

              // Step 2: Tuck toward top-right corner (extension toolbar)
              layout.style.transition     = `transform ${TUCK_MS}ms cubic-bezier(0.36, 0, 0.66, -0.56), opacity ${TUCK_MS}ms ease`;
              layout.style.transform      = 'translateX(80vw) translateY(calc(-50% - 40vh)) scale(0.08)';
              layout.style.opacity        = '0';
              btnOverlay.style.transition = `opacity ${TUCK_MS}ms ease`;
              btnOverlay.style.opacity    = '0';
              backdrop.classList.remove('visible');

              // Steps 3 + 4 + 5: After animation fully completes, close UI then open history
              setTimeout(() => {
                host.remove();
                window.open(chrome.runtime.getURL('history.html'));
              }, TUCK_MS + 20);

            }, 1500);

          }, 2000);
        }

        function cancelHold() {
          if (saved) return;
          clearTimeout(holdTimer);
          // Reset fill
          fill.style.transition = 'transform 0.25s ease';
          fill.style.transform  = 'scaleX(0)';
          label.style.color     = '#b05538';
        }

        btn.addEventListener('pointerdown',  startHold);
        btn.addEventListener('pointerup',    cancelHold);
        btn.addEventListener('pointerleave', cancelHold);
        btn.addEventListener('pointercancel',cancelHold);
      }

      // ── Entrance timeline ────────────────────────────────────────
      // T=0ms    Phase 1: button overlay (loading state)
      // T=300ms  Phase 2: backdrop + layout slide-in
      // T=400ms  Phase 3: card deck renders + float-in
      // T=800ms           cards fan out
      // T=1200ms Phase 4: button → "Sifting" active state
      // T=1500ms          Back/Next nav arrows fade in
      // T=1800ms          Edit/Close side buttons fade in

      // Nav and ctrl are hidden until their stagger point so they don't
      // flash in during the card entrance. pointer-events blocked while invisible.
      navWrapEl.style.opacity       = '0';
      navWrapEl.style.transform     = 'translateY(10px)';
      navWrapEl.style.pointerEvents = 'none';
      ctrlColEl.style.opacity       = '0';
      ctrlColEl.style.transform     = 'translateY(10px)';
      ctrlColEl.style.pointerEvents = 'none';
      skipBtn.style.opacity         = '0';
      skipBtn.style.transform       = 'translateY(8px)';
      skipBtn.style.pointerEvents   = 'none';

      // Phase 1 — T=0ms
      requestAnimationFrame(() => requestAnimationFrame(() => {
        btnOverlay.classList.add('visible');
      }));

      // Phase 2 — T=300ms
      setTimeout(() => {
        backdrop.classList.add('visible');
        layout.classList.add('visible');

        // Phase 3 — T=400ms (100ms after layout starts sliding in)
        setTimeout(() => {
          renderStack(stackEl, deck[currentDeckIndex], cardAnswers, currentPillars);
          wireOutroBtn();
          updateNavButtons();

          stackEl.style.opacity   = '0';
          stackEl.style.transform = 'translateX(50px)';

          requestAnimationFrame(() => requestAnimationFrame(() => {
            // Float-in — T=400ms, 420ms duration
            stackEl.style.transition = 'opacity 420ms ease, transform 420ms cubic-bezier(0.22, 1, 0.36, 1)';
            stackEl.style.opacity    = '1';
            stackEl.style.transform  = 'translateX(0)';

            // Fan out — T=800ms (400ms after Phase 3)
            setTimeout(() => applyFan(stackEl, true), 400);

            // Phase 4 — T=1200ms: button → "Sifting" state
            setTimeout(() => {
              bounceEl.classList.add('hidden');
              doneEl.classList.add('visible');
            }, 800);

            // Nav arrows — T=1500ms
            setTimeout(() => {
              navWrapEl.style.transition    = 'opacity 320ms ease, transform 320ms cubic-bezier(0.22, 1, 0.36, 1)';
              navWrapEl.style.opacity       = '1';
              navWrapEl.style.transform     = 'translateY(0)';
              navWrapEl.style.pointerEvents = '';
            }, 1100);

            // Customize button — T=1800ms
            setTimeout(() => {
              ctrlColEl.style.transition    = 'opacity 320ms ease, transform 320ms cubic-bezier(0.22, 1, 0.36, 1)';
              ctrlColEl.style.opacity       = '1';
              ctrlColEl.style.transform     = 'translateY(0)';
              ctrlColEl.style.pointerEvents = '';
            }, 1400);

            // "I don't need Sift today" — T=2100ms (last)
            setTimeout(() => {
              skipBtn.style.transition  = 'opacity 320ms ease, transform 320ms cubic-bezier(0.22, 1, 0.36, 1)';
              skipBtn.style.opacity     = '1';
              skipBtn.style.transform   = 'translateY(0)';
              // Clean up inline styles after transition so .edit-open class can override
              setTimeout(() => {
                skipBtn.style.opacity       = '';
                skipBtn.style.transform     = '';
                skipBtn.style.transition    = '';
                skipBtn.style.pointerEvents = '';
              }, 340);
            }, 1700);
          }));
        }, 100); // 300 + 100 = T=400ms

      }, 300);

      // ── Button overlay shake (Phase 4 idle state) ────────────
      // Removing + re-adding the class resets the animation so each click fires it.
      btnOverlay.addEventListener('click', () => {
        btnOverlay.classList.remove('is-shaking');
        void btnOverlay.offsetWidth; // force reflow to reset animation
        btnOverlay.classList.add('is-shaking');
      });
      btnOverlay.addEventListener('animationend', () => {
        btnOverlay.classList.remove('is-shaking');
      });

      // ── "I don't need Sift today" → dismiss modal ────────────
      let showDismissModal = false;

      function closeDismissModal() {
        showDismissModal = false;
        dismissModal.classList.remove('visible');
      }

      function closeGearPopover() {
        gearOpen = false;
        gearPop.classList.remove('visible');
        gearBackdrop.classList.remove('visible');
        editBtn.setAttribute('aria-expanded', 'false');
        skipBtn.classList.remove('edit-open');
      }

      skipBtn.addEventListener('click', () => {
        showDismissModal = true;
        dismissModal.classList.add('visible');
      });

      gotItBtn.addEventListener('click', () => {
        dismiss();
      });

      // Backdrop click: clicking the overlay outside the card closes the dismiss modal.
      dismissModal.addEventListener('click', e => {
        if (e.target === dismissModal) closeDismissModal();
      });

      // ── Edit (settings) button ────────────────────────────────
      let gearOpen = false;

      editBtn.addEventListener('click', e => {
        e.stopPropagation();
        gearOpen = !gearOpen;
        gearPop.classList.toggle('visible', gearOpen);
        gearBackdrop.classList.toggle('visible', gearOpen);
        editBtn.setAttribute('aria-expanded', String(gearOpen));
        skipBtn.classList.toggle('edit-open', gearOpen);
      });

      // Backdrop click: clicking outside the card closes the gear modal.
      gearBackdrop.addEventListener('click', e => {
        if (e.target === gearBackdrop) closeGearPopover();
      });

      gearPop.querySelector('.gear-prev-sifts').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'OPEN_TAB', path: 'history.html' });
      });

      // ESC key: close whichever modal is open.
      // Capture phase + stopImmediatePropagation prevents the ESC hold (esc-hold.js) from
      // activating while a modal is open — hold should only fire when cards are the focus.
      function onModalEsc(e) {
        if (e.key !== 'Escape') return;
        if (showDismissModal) {
          e.stopImmediatePropagation();
          closeDismissModal();
        } else if (gearOpen) {
          e.stopImmediatePropagation();
          closeGearPopover();
        }
      }
      document.addEventListener('keydown', onModalEsc, { capture: true });

      // ── Gear: pillar toggles ──────────────────────────────────
      gearPop.querySelectorAll('.gear-pillar-card').forEach(btn => {
        btn.addEventListener('click', () => {
          const pid       = btn.dataset.pid;
          const turningOn = btn.classList.contains('off');

          if (!turningOn) {
            const next = currentPillars.filter(p => p !== pid);
            if (!next.length) return;
            currentPillars = next;
            btn.classList.add('off');
            btn.setAttribute('aria-pressed', 'false');
          } else {
            currentPillars = [...new Set([...currentPillars, pid])];
            btn.classList.remove('off');
            btn.setAttribute('aria-pressed', 'true');
          }

          SiftStorage.setPillars(currentPillars);
          reshuffleStack(stackEl, deck, currentPillars, prompts, cardAnswers, () => {
            currentDeckIndex = 0;
            wireOutroBtn();
            updateNavButtons();
          });
        });
      });

      // ── Card navigation ───────────────────────────────────────
      const backBtn = shadow.getElementById('nav-back-btn');
      const nextBtn = shadow.getElementById('nav-next-btn');
      let isAnimating = false;

      const dotsEl = shadow.getElementById('nav-dots');

      const SVG_NEXT = `<svg viewBox="0 0 24 24" fill="#f5ede4" aria-hidden="true"><path d="M6 9h6V5l7 7-7 7v-4H6V9z"/></svg>`;

      function updateNavDots() {
        const onBookend = currentDeckIndex === 0 || currentDeckIndex === deck.length - 1;
        dotsEl.classList.toggle('hidden', onBookend);
        if (onBookend) return;

        const dotCount = deck.length - 2; // exclude first + last
        dotsEl.innerHTML = '';
        for (let i = 0; i < dotCount; i++) {
          const dot = document.createElement('span');
          dot.className = 'nav-dot' + (currentDeckIndex === i + 1 ? ' active' : '');
          dotsEl.appendChild(dot);
        }
      }

      function updateNavButtons() {
        backBtn.disabled = currentDeckIndex === 0;

        const isLast = currentDeckIndex === deck.length - 1;
        nextBtn.disabled = isLast;
        nextBtn.classList.remove('nav-restart');
        nextBtn.setAttribute('aria-label', 'Next card');
        nextBtn.innerHTML = SVG_NEXT;

        updateNavDots();
      }

      // Physical deck animation.
      // direction:  1 = forward (Next), -1 = backward (Back)
      //
      // Strategy: lift the outgoing front card out of the stack into the
      // shadow root at a fixed position so it can animate over the top
      // while renderStack() rebuilds the deck beneath it cleanly.
      function navigateTo(newIndex, direction) {
        if (isAnimating || newIndex < 0 || newIndex >= deck.length || newIndex === currentDeckIndex) return;
        isAnimating = true;

        const ANIM_MS = 620;

        // ── Outgoing card ────────────────────────────────────────
        const oldFront = stackEl.lastElementChild;
        if (oldFront) {
          // Convert to fixed so it floats above the rebuilt stack.
          const r = oldFront.getBoundingClientRect();
          oldFront.style.position      = 'fixed';
          oldFront.style.top           = `${r.top}px`;
          oldFront.style.left          = `${r.left}px`;
          oldFront.style.width         = `${r.width}px`;
          oldFront.style.height        = `${r.height}px`;
          oldFront.style.margin        = '0';
          oldFront.style.zIndex        = '9999';
          oldFront.style.pointerEvents = 'none';
          root.appendChild(oldFront);

          requestAnimationFrame(() => {
            oldFront.classList.add(direction > 0 ? 'card-exit-fwd' : 'card-exit-back');
            setTimeout(() => oldFront.remove(), ANIM_MS);
          });
        }

        // ── Rebuild deck with incoming card ──────────────────────
        currentDeckIndex = newIndex;
        renderStack(stackEl, deck[currentDeckIndex], cardAnswers, currentPillars);
        wireOutroBtn();
        applyFan(stackEl, false);
        updateNavButtons();

        // ── Incoming card entrance ───────────────────────────────
        const newFront = stackEl.lastElementChild;
        if (newFront) {
          const enterClass = direction > 0 ? 'card-enter-fwd' : 'card-enter-back';
          newFront.classList.add(enterClass);
          newFront.addEventListener('animationend', () => {
            newFront.classList.remove(enterClass);
          }, { once: true });
        }

        setTimeout(() => { isAnimating = false; }, ANIM_MS);
      }

      backBtn.addEventListener('click', () => navigateTo(currentDeckIndex - 1, -1));
      nextBtn.addEventListener('click', () => navigateTo(currentDeckIndex + 1, 1));

      // ── Keyboard navigation ───────────────────────────────────
      // Guard: skip if focus is inside a textarea or input so arrow keys
      // still move the text cursor when the user is typing.
      function onKeyDown(e) {
        const tag = shadow.activeElement?.tagName?.toLowerCase();
        if (tag === 'textarea' || tag === 'input' || shadow.activeElement?.isContentEditable) return;

        if (e.key === 'ArrowRight') { e.preventDefault(); navigateTo(currentDeckIndex + 1,  1); }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); navigateTo(currentDeckIndex - 1, -1); }
      }

      document.addEventListener('keydown', onKeyDown);

      // Clean up keyboard listener when Sift is dismissed
      const _origDismiss = dismiss;
      dismiss = function(cb) {
        document.removeEventListener('keydown', onKeyDown);
        _origDismiss(cb);
      };

    },

  };

})();
