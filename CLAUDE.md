# Sift — Chrome Extension

## What This Is
Sift is a Chrome extension that helps users curb impulse clothing purchases by intercepting the H&M checkout flow with reflection prompts delivered as playing cards. Read `sift-prd-v2.md` for the full product spec and `sift-card-content-v1.md` for finalized prompt copy.

**Scope: H&M only (proof of concept).** Multi-retailer support was descoped in v2.

---

## Tech Stack
- Chrome Extension (Manifest V3)
- Vanilla JS, HTML, CSS — no frameworks
- Shadow DOM for all injected UI (prevents H&M style conflicts)
- `chrome.storage.local` for persistent pillar selections (`sift_pillars` key)
- Content scripts loaded in dependency order; each module sets a global on `window`
- CSS and JSON resources fetched at runtime via `chrome.runtime.getURL()`
- Google Fonts (`Happy Monkey`, `Geist`, `Geist Mono`) injected into `document.head` (not shadow root) so fonts resolve inside closed shadow DOMs

---

## Critical Architectural Constraint

**`content.js` cannot use ES module `import`.** MV3 content scripts don't support it reliably. The workaround: `manifest.json` loads all JS files as separate content scripts in dependency order. Each file is an IIFE that exposes its API on `window`:

```
utils/storage.js            → window.SiftStorage
utils/checkout-detection.js → window.SiftCheckout
utils/esc-hold.js           → window.SiftEscHold
cards/cards.js              → window.SiftCards
exit/exit.js                → window.SiftExit
content.js                  ← last; orchestrates via the globals above
```

CSS files and `prompts.json` are listed in `web_accessible_resources` and fetched lazily inside each module's `show()` call with `fetch(chrome.runtime.getURL(...))`. Results are cached in module-scoped variables after the first fetch.

**Note: onboarding was scrapped entirely.** There is no onboarding flow. The popup is the only settings UI before checkout is triggered.

---

## Code Conventions
- Every injected overlay (cards, exit) uses a closed Shadow DOM host
- Pillar IDs are lowercase strings: `'money'`, `'space'`, `'need'`
- All storage keys are prefixed `sift_` (e.g. `sift_pillars`)
- Module files are IIFEs wrapped in `(function() { 'use strict'; ... })()`
- Comment H&M-specific selectors in checkout-detection.js so they're easy to find
- Pillar toggle state uses `.off` class for deactivated (not `.active` for activated)

---

## Brand & Design System

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Parchment | `#f5ede4` | Backgrounds, panel fills |
| Stone | `#d4c4b0` | Dashed borders |
| Terracotta | `#b05538` | CTAs, gear button, accent |
| Espresso | `#5c3d2e` | Body text |
| Money | `#e8c88d` | Money pillar card bg |
| Space | `#a8b99a` | Space pillar card bg |
| Need | `#c49a8a` | Need pillar card bg |

### Typography
- `Happy Monkey` — wordmark/logo only
- `Geist` — body, UI copy (weights: 300 Light, 400 Regular, 600 SemiBold)
- `Geist Mono` — pillar labels (weight: 600 SemiBold)

### Spacing
- All spacing in multiples of 8px
- Figma frame dimensions are NOT true to size — match proportions, not exact px values

### Pillar metadata (defined in `PILLAR_META` in `cards/cards.js`)
Each pillar has: `label`, `emoji`, `accent`, `accentLight`, `accentDark`, `backBg`, `bg`, `text`, `tagline`

---

## Current File Map

| File | Purpose |
|------|---------|
| `manifest.json` | MV3; `*.hm.com`; loads content scripts in order; web_accessible_resources: cards.css, exit.css, prompts.json |
| `utils/storage.js` | `chrome.storage.local` wrapper — `getState()`, `setPillars()` |
| `utils/checkout-detection.js` | Capture-phase click interceptor for H&M checkout button; `setup()` / `bypass()` |
| `utils/esc-hold.js` | ESC hold detection; drives SVG ring animation; returns cleanup fn |
| `cards/cards.js` | 4-phase card experience: button hijack → panel slide-in → deck float+fan → button final state |
| `cards/cards.css` | All card experience styles (button overlay, backdrop, panel, card stack, gear popover) |
| `exit/exit.js` | "Before you leave" modal; single CTA that calls `onCheckout()` |
| `exit/exit.css` | Exit modal styles |
| `popup/popup.html` | Toolbar popup — pillar toggles |
| `popup/popup.css` | Popup styles |
| `popup/popup.js` | Reads/writes `chrome.storage.local` directly |
| `prompts/prompts.json` | 12 prompts (4 per pillar) |
| `content.js` | Orchestrator: checkout intercept → cards → exit |
| `background.js` | Minimal service worker |

---

## User Flow

1. User browses H&M — Sift is invisible
2. Clicks "Continue to checkout" → click intercepted (`preventDefault` + `stopImmediatePropagation`)
3. **Phase 1 (t=0ms):** Terracotta overlay covers the checkout button; three pillar-coloured dots bounce in sequence
4. **Phase 2 (t=300ms):** Focus backdrop fades in (dark wash + blur); `.sift-layout` slides in from the left as one unit
5. **Phase 3 (t=720ms):** Card deck renders — floats in from the right, then back cards fan out toward bottom-right
6. **Phase 4 (t=1860ms):** Button overlay transitions to "Sifting" + looping font animation + staggered pillar-dot pulse
7. User reflects on prompts; can shuffle, change pillars via Edit button (settings popover), or hold ESC 5s to skip
8. **Close button** → scroll restored, Sift dismissed, returns user to cart (no checkout redirect)
9. **ESC hold (5s)** → scroll restored, panel + button overlay dismiss; `bypass(btn)` fires, checkout proceeds

---

## Key Technical Decisions

- **Checkout bypass**: `_bypassed = true` flag + `btn.click()` re-fires the original button. H&M's React handlers are blocked on the first click, then run normally on the programmatic re-click.
- **Focus backdrop**: `.sift-backdrop` is the first child of `root` (DOM order = lowest layer). `position:fixed;inset:0`, `background:rgba(0,0,0,0.4)`, `backdrop-filter:blur(4px)`. `pointer-events:none` until `.visible`. Fades in at Phase 2 onset, removed on dismiss.
- **Scroll lock**: Applied in `show()` immediately after `buildDeck`. Saves `document.documentElement.style.overflow`, `document.body.style.overflow`, and `document.body.style.paddingRight`, then sets `overflow:hidden` on both. Scrollbar width calculated via `window.innerWidth - documentElement.clientWidth` and added to `body.paddingRight` to prevent layout shift. Restored at the top of `dismiss()`.
- **Ghost panel**: `.sift-panel` has no background, border, or box-shadow — it is a pure transparent flex wrapper. Cards and controls float directly over the backdrop. `left: 5vw` on `.sift-layout` offsets the deck from the screen edge.
- **Button hijack positioning**: `getBoundingClientRect()` on the intercepted button → `position:fixed` overlay with matched `borderRadius` from `getComputedStyle`. Perfect pixel alignment over H&M's button.
- **Layout wrapper**: `.sift-layout` is `position:fixed; left:5vw; display:flex; flex-direction:row; gap:16px`. Slides via `translateX(-100%) translateY(-50%)` ↔ `translateX(0) translateY(-50%)`. `overflow:visible` so the settings popover and card fans extend beyond the box without clipping.
- **Card dimensions**: `CARD_W=300, CARD_H=420` (5:7 playing-card ratio). `FAN_MAX=28`. Stack-wrap sized to `300+28 × 420+28` inline in `renderStack()`.
- **Fan-out animation**: All back cards start at `(0,0)`. `applyFan(stackEl, stagger)` adds `.fanned` with `data-depth`-driven CSS transforms. Furthest fans first (0ms), closest last (210ms). Each card transitions 380ms.
- **Card float-in**: Stack starts at `translateX(50px) opacity:0`, transitions to `translateX(0) opacity:1` over 420ms.
- **Phase 4 timing**: `setTimeout` fires at 1140ms after Phase 3 start (fan start 550ms + last stagger 210ms + fan duration 380ms = 1140ms).
- **Button shake**: Clicking the `.sift-btn-overlay` in Phase 4 triggers a `subtleShake` CSS animation. Class removed/re-added via `void offsetWidth` reflow trick on each click; cleaned up by `animationend` listener.
- **"Sifting" looping animation**: `.sift-font-loop` span cycles Happy Monkey → Geist → Geist Mono (uppercase) via `@keyframes fontSwap` with `steps(1)` snap. Per-step `font-size` tuning (1.2rem / 1.125rem / 0.92rem) keeps optical width stable. Three pillar dots pulse with `@keyframes blink` staggered 0s / 0.2s / 0.4s via `nth-child(2/3/4)`.
- **Prompts**: 2 randomly selected per active pillar from a pool of 4, deck shuffled. Fetched once and cached.
- **Deck rules**: 1 pillar → 4 cards; 2 pillars → 3+3; 3 pillars → 2+2+2. Sequence: `[intro, ...shuffled pillar cards, outro]`.
- **Settings panel pillar toggles**: saves to storage immediately, calls `reshuffleStack()` which fades out → rebuilds deck → fades in with fan immediately re-applied (no stagger).
- **ESC hold**: `SiftEscHold.start()` drives `stroke-dashoffset` on an SVG circle at 50ms ticks. Returns a cleanup fn.
- **Pillar toggle guard**: cannot deactivate the last active pillar (blocked in both popup and settings panel).
- **Modal ESC guard**: capture-phase `keydown` listener (`onModalEsc`) runs `stopImmediatePropagation()` when dismiss modal or gear modal is open, preventing ESC-hold from firing while a modal is up.
- **`position:fixed` inside transformed ancestor**: `.sift-layout` has `transform: translateY(-50%)`, which makes it the containing block for any `position:fixed` children. Both modals (gear + dismiss) are therefore placed as root-level siblings of `.sift-layout`, not inside it.
- **`dismiss(cb, durationMs = 300)`**: parameterized exit duration. Normal dismissal uses 300ms; post-save slow exit uses 900ms. Scroll is restored synchronously before the animation starts.
- **Outro card conditional button**: `outroCardHTML(hasTyped)` checks `Object.values(cardAnswers).some(arr => arr.some(v => v.trim() !== ''))`. If user typed anything → "HOLD TO SAVE RESPONSES" save button; otherwise → "EXIT SIFT" button that opens dismiss modal.
- **Hold-to-save state machine**: `pointerdown` starts a `scaleX` CSS fill animation (2s linear) + `setTimeout(2000)`. `pointerup`/`pointerleave`/`pointercancel` cancels and resets. On completion: label → "Sift saved ✓", scale pulse (1.06 → 1), then `dismiss(null, 900)` after 1500ms.
- **Outro card glow**: `.outro-card` has `box-shadow: 0 0 80px 6px rgba(176, 85, 56, 0.10)` — Terracotta aura only, does not replace the standard `.card` depth shadow.

---

## Animation Architecture

### Four-Phase Entrance Sequence (all timings relative to button click)

| Phase | t= | What happens |
|-------|----|-------------|
| 1 | 0ms | `.sift-btn-overlay.visible` — terracotta cover + `@keyframes sift-bounce` dots |
| 2 | 300ms | `.sift-backdrop.visible` (fade in) + `.sift-layout` slides in from left over 420ms |
| 3 | 720ms | `renderStack()` + float-in from right (420ms) + fan-out (550ms delay, staggered) |
| 4 | 1860ms | `.bounce-dots.hidden` + `.btn-done-row.visible` — "Sifting" font loop + dot pulse |

### Card Fan-Out (Phase 3 detail)

Back cards sit at `(0,0)` behind the front card. `.fanned` class triggers CSS transitions:
```
depth 0 (closest): translateX(5px)  translateY(5px)  rotate(0.3deg)
depth 1:           translateX(11px) translateY(11px) rotate(0.8deg)
depth 2:           translateX(17px) translateY(17px) rotate(1.4deg)
depth 3 (furthest):translateX(24px) translateY(24px) rotate(2.0deg)
```
Fan direction is bottom-right — toward the open page since the layout is left-anchored at `5vw`.

### Dismiss
Scroll restored immediately → backdrop fades out + panel slides left (`translateX(-100%)`) + button overlay fades out simultaneously over 300ms → `host.remove()`.

---

## Control Column (`.ctrl-col`, right of panel)

Dedicated control column sits to the right of `.sift-panel` inside the shared `.sift-layout` flex wrapper. `gap: 16px` separates panel from column.

### Global button system
All interactive buttons share: `border-radius: 8px`, 3D tactile shadow (`0 2px 0 <bottom-edge-color>, 0 3px 6px rgba(0,0,0,...)`) + `translateY(2px)` press effect that collapses the bottom shadow on `:active`.

### Dismiss button (`.ctrl-dismiss-btn`)
- Parchment (`#f5ede4`) bg, Terracotta icon + label, `padding: 8px`, `gap: 4px`, Stone bottom-edge shadow
- Label: "I DON'T NEED SIFT TODAY" — Geist Mono, 13px, 600, uppercase
- Icon: 26px container, 16px SVG
- Hidden (`opacity:0; pointer-events:none`) via `.edit-open` class while Edit modal is open
- Click: `dismiss()` — restores scroll, removes host, returns user to cart (no checkout redirect)

### Edit button (`.ctrl-edit-btn`)
- Terracotta (`#b05538`) bg, Parchment icon + label — color inversion of dismiss button
- Label: "CUSTOMIZE YOUR SIFT" — Geist Mono, 13px, 600, uppercase
- Icon: 26px container, 16px SVG, dark Terracotta bottom-edge shadow
- Click: toggles `.gear-backdrop.visible` (settings modal centered on viewport)

### Settings Modal (`.gear-backdrop` / `.gear-popover`)
Moved **outside `.sift-layout`** (root level, sibling of layout) to avoid `position:fixed` containment-block issue caused by CSS `transform` on `.sift-layout`. Centered via flex on `.gear-backdrop` (`position:fixed; inset:0; display:flex; align-items:center; justify-content:center`).
- 480px wide, Parchment bg, 3px dashed Stone border, 20px radius, 28px padding
- Scales in from `scale(0.95) translateY(8px)` → `scale(1) translateY(0)` on `.visible`
- Backdrop click closes modal; ESC key (capture phase) closes modal before ESC-hold fires
- Header: "What's on your mind?" + "Pick what you care about"
- Three pillar cards in a 3-column grid
- "View previous sifts" ghost link with ↗ arrow

### Dismiss Modal (`.dismiss-modal` / `.dismiss-modal-card`)
Also root-level, centered via flex. Matches gear modal dimensions exactly (480px, 28px padding, 3px dashed Stone, 20px radius, same box-shadow).
- All content center-aligned
- Headline: 20px, 600 weight, Espresso
- Body: 16px, 300 weight, Espresso, `line-height:1.3` — two separate `<p class="dismiss-body">` paragraphs
- Copy: "Love an intentional purchase! If you've thought it through and it feels right, it's all yours." + "If you change your mind, you can always wake Sift back up from your browser's toolbar."
- Disabled "NEXT" button: Geist Mono 13px uppercase, Terracotta bg, Parchment text, `opacity:0.4`, `box-shadow:none`, `pointer-events:none` — visual placeholder only
- "Got it" button: Terracotta bg, Parchment text, Geist Mono 13px uppercase, same 3D shadow system
- ESC key and backdrop click close modal

---

## Card Dimensions & Internal Layout

- **Card**: 300×420px, `border-radius: 20px`
- **Parchment inset**: 12px all sides, `border-radius: 16px`
- **Corner blocks**: 71×64px, `border-radius: 16px 0 16px 0`
- **Parchment padding**: `64px 26px` (64px top/bottom clears corner height)
- **Primary text**: 18px (`prompt-text`), 20px (`card-question`), 16px (intro/outro body), 40px (wordmarks)
- **Inputs**: 14px (`prompt-input`), 18px (`card-input`)
- **Pillar corner icons**: 26px (heart/dollar/warehouse SVGs)
- **Panel ghost wrapper**: 400px wide, `padding: 32px 24px 28px`, no background/shadow

---

## Popup (toolbar icon → popup.html)

- 296px wide, Parchment bg, dashed Stone border card
- "sift." in Happy Monkey + dots SVG (5 circles, all r=15, viewBox="0 0 141 127")
- Three pillar cards in a 3-column grid (square aspect ratio)
- Footer strip: "Change these anytime in settings ⚙"

---

## `SiftCards.show()` Signature

```javascript
// cards/cards.js — window.SiftCards
show(checkoutBtn, activePillars, onCheckout)
//   ^Element      ^string[]      ^Function
```

`checkoutBtn` is passed from `content.js` via `SiftCheckout.setup(async (interceptedBtn) => { ... })`.

---

## Outro Card

`.outro-card` is the last card in the deck (`cardSpec.type === 'outro'`). It has a Terracotta background (`#b05538`) with a Terracotta aura glow. The parchment inset (`.outro-parchment`) fills 12px inset with centered column layout.

Content: wordmark row → body copy → "cherish it" row with heart SVG → conditional action button.

Action button states (`.outro-action-btn`):
- **"EXIT SIFT"** (`.outro-exit-btn`): Terracotta bg, Parchment text — opens dismiss modal
- **"HOLD TO SAVE RESPONSES"** (`.outro-save-btn`): Parchment bg, Terracotta text, Terracotta border — hold-to-save interaction with `scaleX` fill animation

`floatWrapEl.classList.add('outro-active')` is toggled when the outro card is active (can be used to suppress or modify float animation for outro state).

---

## Session 9 Recap

### Dismiss Modal
- Body text reduced from 18px → 16px
- SVG refresh icon removed from footer
- Footer replaced with disabled "NEXT" button (Terracotta bg, Parchment text, Geist Mono uppercase, `opacity:0.4`, flat/no shadow, `pointer-events:none`)
- Copy rewritten: headline stays "That's okay!"; body split into two paragraphs with new intentional-purchase tone

### History Page (`history.html`)
- "View previous sifts" button in the Edit/Gear modal now opens `history.html` in a new tab
- Implementation: content script sends `{ type: 'OPEN_TAB', path: 'history.html' }` to background service worker (content scripts can't call `chrome.tabs.create` directly); background worker handles it
- `"tabs"` permission added to `manifest.json`; `history.html` added to `web_accessible_resources`
- WIP banner removed from `history.html`

### Hold-to-Save → Tuck-Away Exit
- On successful 2s hold, replaced slow `dismiss(null, 900)` with `dismissTuckAway()`
- Animation: layout scales to `0.08`, translates toward top-right corner (extension toolbar), `opacity:0` over 520ms using `cubic-bezier(0.36, 0, 0.66, -0.56)` (anticipate/backIn feel)
- After animation: host removed, `history.html` opens in new tab via background worker
- "Exit Sift" (no-save) path unchanged — still opens dismiss modal

### Navigation Arrows (Back / Next)
- Active state: Terracotta bg (`#b05538`), Parchment icon (`#f5ede4`), `1.5px solid #b05538` border, 3D tactile shadow (`0 2px 0 #7a3521`), `translateY(2px)` press effect
- Disabled state: Parchment bg (`#f5ede4`), Terracotta icon (via `.nav-arrow-btn:disabled svg { fill: #b05538 }`), `opacity:0.4`, `box-shadow:none`, `pointer-events:none` — icon flip handled purely in CSS, single `SVG_NEXT` constant in JS
- Next button disabled (not restart) on last card; Back button disabled on first card
- `.nav-restart` class and `SVG_RESTART` constant removed

### Control Column Button Order
- **Edit/Customize** button moved to top, **Dismiss** button moved to bottom — DOM swap (not CSS order)
- All IDs, event listeners, and `.edit-open` hide logic unaffected

---

## What's Next (Session 10)

- **"I've decided" proceed CTA** — button to complete flow and proceed to checkout (distinct from dismiss which exits Sift without proceeding)
- **Front card micro-interactions** — hover lift, card flip animation
- **Pillar card micro-interactions** — click ripple on pillar toggles in settings modal
- **Extension icons** — `assets/icons/` is empty; need 16×16, 48×48, 128×128 PNGs
- **Live H&M testing** — confirm checkout button selector fires; `bypass()` may need a selector tweak
- **Cleanup** — delete orphaned v1 files: root-level `popup.html`, `popup.js`, `splash/splash.js`, `utils/site-detection.js`, `prompts/prompts.js`
