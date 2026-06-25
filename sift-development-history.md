# Sift — Development History & Feature Evolution

*Internal reference doc for the Sift UX/HCI case study. Compiled from commit history, product spec, and build notes.*

---

## 1. Project Overview

**Sift** is an interface designed to introduce intentional friction into online clothing shopping — a deliberate pause at the moment of highest impulse: checkout.

Rather than blocking a purchase outright, Sift intercepts the "Continue to checkout" action on H&M (the proof-of-concept retailer) and replaces the immediate transition to payment with a short, reflective ritual: a deck of playing cards, each carrying a prompt grounded in one of three psychological "pillars" —

- **Money** — *Can I actually swing this?*
- **Space** — *Will this have a home?*
- **Need** — *Do I want it or need it?*

The user reads and optionally responds to a few cards drawn from their chosen pillars, then either proceeds to checkout (cards bypassed via a 5-second ESC hold, or after explicitly deciding to buy) or walks away. Nothing is ever forced — Sift positions itself as a "companion, not a blocker": it never deletes a cart, never shames a purchase, and always leaves the final decision with the user. The product's tone of voice and visual language (warm parchment tones, hand-set typography, a tactile deck-of-cards metaphor) were deliberately chosen to feel reflective and calm rather than punitive.

The project began as a working Manifest V3 Chrome extension scoped to a single retailer (H&M) as a feasibility proof-of-concept. Multi-retailer support and a fully wired settings/storage system were explicitly descoped from the outset. Partway through development, the project's end goal was **re-scoped from "shipping browser extension" to "high-fidelity, recordable web prototype"** for use in a UX design portfolio — shifting priorities toward visual polish, animation fidelity, and demo-readiness over production correctness (real persistence, live-site testing, etc.).

---

## 2. Feature Evolution & Architecture

### 2.1 Foundational Architecture (Initial build)

The extension was built as a Manifest V3 Chrome extension with no build step and no frameworks — vanilla JS, HTML, and CSS throughout. Two architectural decisions shaped everything that followed:

- **Checkout interception.** A capture-phase click listener on H&M's "Continue to checkout" button calls `preventDefault()` + `stopImmediatePropagation()`, fully suppressing the default navigation before Sift's experience renders. To later let the user proceed, a `_bypassed` flag is set and the original button is `.click()`-ed again programmatically — React's handlers, blocked on the first click, run normally on the re-fired second click.
- **Shadow DOM isolation.** Every injected surface (cards, exit modal, topbar) renders inside a **closed Shadow DOM** host, so none of H&M's page styles can leak in or be leaked onto, and Sift's own styles can't collide with the host page. Fonts (Google Fonts: Happy Monkey, Geist, Geist Mono) are injected into the real `document.head` rather than the shadow root, since `@font-face` resolution doesn't otherwise cross the shadow boundary.

Because MV3 content scripts can't reliably use ES module `import`, the codebase uses a **dependency-ordered content-script chain** instead: each file is a self-contained IIFE that exposes its API as a global on `window` (`SiftStorage`, `SiftCheckout`, `SiftEscHold`, `SiftCards`, `SiftExit`), and `manifest.json` loads them in the order each depends on the last, with `content.js` as the final orchestrator. CSS files and the prompts JSON are fetched lazily at runtime via `chrome.runtime.getURL()` and cached after first load, rather than bundled.

Persistent state (which pillars are active) is stored via a single `chrome.storage.local` key, `sift_pillars`, accessed through a small wrapper module (`utils/storage.js`) exposing `getState()` / `setPillars()`.

### 2.2 Onboarding (built, then scrapped)

An early version of the product spec (`sift-prd-v2.md`) called for a one-time onboarding overlay on first visit — wordmark, tagline, pillar pre-selection, an optional "what brought you here today" intention field, and a "Let's go" / "Not today" choice. This was implemented (`onboarding/onboarding.js`) but later **scrapped entirely**: the popup became the only pre-checkout settings surface, and the onboarding module is now dead code awaiting cleanup.

### 2.3 Card Experience — Core Interaction

The centerpiece of the product: a four-phase entrance sequence, all timed relative to the checkout-button click, designed so the transition from "shopping" to "reflecting" feels like one continuous motion rather than a hard cut:

| Phase | Timing | What happens |
|---|---|---|
| 1 | t=0ms | The real checkout button is visually replaced by a terracotta overlay (pixel-matched via `getBoundingClientRect()` + the button's own border-radius), with three pillar-colored dots bouncing in sequence |
| 2 | t=300ms | A blurred dark backdrop fades in and the card panel slides in from the screen edge |
| 3 | t=720ms | The card deck floats in from the right, then the back cards fan out toward the bottom-right in a staggered cascade |
| 4 | t=1860ms | The button overlay's label cycles through "Sifting" rendered in three different typefaces in a loop, with the pillar dots pulsing in sequence |

**Deck logic:** cards are drawn from a pool of 4 prompts per pillar; 1 active pillar → 4 cards, 2 pillars → 3+3, 3 pillars → 2+2+2, sequenced as `[intro, ...shuffled pillar cards, outro]`. Two cards are randomly chosen from each pillar's pool and the whole deck is shuffled together (no fixed first/last position for the prompt cards). Prompts and their copy live in `prompts/prompts.json`, fetched once and cached.

**Card anatomy:** each prompt card carries a pillar accent color bar, pillar icon, the prompt question, and a free-text reflection field, with a closing line ("This stays between you and you.") reinforcing the product's non-judgmental tone. An **intro card** and **outro card** bookend the deck — the outro's copy and call-to-action change depending on whether the user typed anything (see 2.4).

**Navigation & shuffle:** the deck is browsable via Back/Next arrow buttons (disabled at either end rather than wrapping), and a shuffle action exists to reorder the remaining stack.

### 2.4 Exit Paths — Bypass, Buy, and Dismiss

Sift was deliberately built with **three distinct ways to leave the experience**, each with different intent and a different visual treatment:

- **ESC hold-to-bypass (5s).** Holding ESC drives an SVG ring's `stroke-dashoffset` at 50ms ticks as a visible progress indicator; releasing early cancels. Completing the hold restores scroll, tears down the overlay, and fires the real checkout button — the fastest, lowest-friction exit, reserved for users who deliberately want to skip the ritual.
- **"I've decided to buy" → outro card.** The natural end of the deck. The outro card's action button is **conditional on whether the user typed any reflection**: if they wrote something, the action is "hold to save responses" (a 2-second deliberate hold, with a fill animation, that confirms save and then exits with a "tuck-away" animation toward the browser toolbar before opening the history page); if they wrote nothing, the action is "exit Sift," which opens a confirmation modal rather than saving anything.
- **"Exit Sift" via the dismiss modal / topbar close.** A centered modal ("That's okay! ... it's all yours.") that explicitly validates the user's choice rather than guilting them, before returning to the cart with no checkout redirect. The entry point to this modal moved over time from a standalone "I don't need Sift today" text link to a persistent **top banner with a × close button** (Session 12), reducing the number of distinct dismiss affordances on screen at once.

### 2.5 Customization — Popup & In-Experience Settings

Two surfaces let the user choose which pillars are active, both writing to the same `chrome.storage.local` state:

- **Toolbar popup** (`popup/popup.html`) — the only settings UI before checkout is ever triggered; three pillar toggle cards in a grid.
- **In-experience "gear"/Edit settings popover** — opens mid-session over the card experience, lets the user toggle pillars live. Changing pillars triggers a `reshuffleStack()`: fade out → rebuild the deck from the new pillar set → fade back in with the fan-out re-applied immediately (no re-stagger). Both surfaces share a guard that blocks deactivating the *last* remaining active pillar.

### 2.6 Visual Design System Pass (Sessions 9–12)

A multi-session effort to take the product from "functionally complete" to a single, cohesive visual language, rather than a per-screen patchwork:

- **Dismiss modal rewrite** — copy softened into an intentional-purchase tone, body text resized, footer simplified to a single disabled "NEXT" placeholder button (signaling more steps were originally planned for this flow).
- **History page entry point** — "View previous sifts" added to the settings popover, opening a new `history.html` tab via a background-worker message (content scripts can't call `chrome.tabs.create` directly).
- **Hold-to-save → "tuck-away" exit** — replaced a generic slow fade-out with a custom animation: the whole layout scales down to 8% and flies toward the browser's toolbar corner using an anticipate/overshoot easing curve, visually suggesting "this is being filed away," before the history page opens.
- **Navigation arrow redesign** — Back/Next buttons reworked to a shared tactile button system (3D edge-shadow, press-state, disabled-state) used consistently across the product.
- **Customize button restyle + entrance choreography** — reshaped to match the nav arrows' footprint; the whole control column was given a staggered fade-in sequence (loader → cards → nav arrows → Customize → dismiss link) rather than appearing all at once.
- **Persistent top banner** — replaced the standalone dismiss text link with a fixed, animated-gradient top banner with a × close button, consolidating the "leave" affordance into one place and freeing the control column.
- **Animated gradient borders** — a terracotta/espresso diagonal gradient (via the CSS padding-box/border-box double-background technique) applied consistently to modals and cards, replacing the earlier static dashed border, to visually unify every "framed" surface in the product.
- **Typography & input unification** — all text inputs and placeholders standardized to lowercase Geist Mono in the body text color, replacing an earlier uppercase/pillar-colored/italic treatment that read as inconsistent with the rest of the UI.
- **Outro card copy branching** — the outro card's body copy itself (not just its button) now differs by flow: the "hold to save" path shows a clean wordmark + action only, while the "exit without saving" path retains the full reflective copy ("That's it. The call is yours...cherish it ♥").

### 2.7 History Page (standalone feature, June 2026)

A dedicated "previous sifts" review surface, the first part of the product built explicitly as a **portfolio-recordable artifact** rather than a wired extension feature:

- Built from `history.html` (now a thin shell) plus dedicated `history.js`/`history.css`, refactored out of a monolithic single-file prototype.
- Entries are **sample data only** — intentionally not connected to real `chrome.storage.local` history — covering date, item count, active pillars, and saved reflections per past "sift."
- **Cart item visuals** pull real garment photography from the Unsplash API (random-photo endpoint, lazy-loaded), with a graceful fallback to hand-drawn line-art clothing icons (t-shirt/pants/dress/sneaker) if the request fails, rate-limits, or times out (4s budget). Unsplash's required download-tracking ping is fired lazily — once per photo, only when a card is actually expanded — after an earlier version fired ~25 pings per page load against a 50-requests/hour quota.
- **Filtering & search** — pillar filter chips and a text search both operate over the sample entries, with a brief fade transition between filter states so changes read as a transition rather than an instant DOM swap.
- **Store name diversity** — initially every entry hardcoded "H&M" as the retailer; later updated so each sample entry carries its own `store` field (Zara, Target, Shein, Uniqlo distributed across entries) to make the mock data feel less repetitive on screen, with the search index updated to match.

### 2.8 Design System Formalization (Figma)

In parallel with the in-code visual pass, the same visual language was reverse-engineered and formalized into a standalone Figma design system file ("Capstone — Master Design File"), across dedicated Cover, Foundations, Button, Tooltip, Modal, Card, and Animation Reference pages — consolidating brand decisions (color tokens, type scale, spacing, component states) that had organically accreted in code across many sessions into one reusable, documented source of truth.

### 2.9 Portfolio Re-scoping (June 2026)

The project's end goal was formally changed: rather than continuing toward a shippable, fully-wired Chrome extension (real storage persistence, live H&M selector testing, extension icon assets, toolbar popup functional parity), the codebase's purpose became producing a **high-fidelity, recordable web prototype** for a UX design portfolio reel. This re-scoped remaining backlog items — work like the toolbar popup refresh is now framed around visual/interaction polish for recording rather than functional/production correctness.

---

## Architecture Reference

```
sift/
├── manifest.json              MV3, *.hm.com, content-script load order
├── background.js              minimal service worker (tab-opening for history.html)
├── content.js                 orchestrator: checkout intercept → cards → exit
├── cards/
│   ├── cards.js                window.SiftCards — 4-phase card experience
│   └── cards.css
├── exit/
│   ├── exit.js                 window.SiftExit — "before you leave" modal
│   └── exit.css
├── popup/
│   ├── popup.html / .css / .js toolbar popup — pillar toggles
├── prompts/
│   └── prompts.json            12 prompts (4 per pillar)
├── utils/
│   ├── storage.js               window.SiftStorage — chrome.storage.local wrapper
│   ├── checkout-detection.js    window.SiftCheckout — click interceptor
│   └── esc-hold.js               window.SiftEscHold — 5s ESC hold + SVG ring
├── history.html / .js / .css    "previous sifts" review page (sample data)
└── onboarding/, splash/, popup.html, popup.js (root)   orphaned v1 files, slated for deletion
```

**Brand system:** Parchment `#f5ede4` / Stone `#d4c4b0` / Terracotta `#b05538` / Espresso `#5c3d2e`, plus a distinct accent per pillar (Money `#e8c88d`, Space `#a8b99a`, Need `#c49a8a`). Typography: Happy Monkey for the wordmark, Geist for body/UI copy, Geist Mono for pillar labels and form inputs. All spacing in multiples of 8px.

---

## 3. Design Decisions & Rationale

Several decisions recur across sessions and reflect deliberate trade-offs rather than defaults — worth calling out explicitly in a case study:

- **Playing-card metaphor over a checklist or warning banner.** A deck of cards was chosen over a conventional "are you sure?" interstitial because it borrows the tactile, low-stakes feel of solitaire — something to do with your hands while you think, not an alarm. The float-in, fan-out, and shuffle animations all serve this metaphor; the deck isn't decorative for its own sake.
- **"Companion, not blocker."** This framing shaped several otherwise-unrelated decisions: the exit-path design (three distinct, low-friction ways to leave, including a fast ESC-hold bypass), the copy tone (the dismiss modal validates the choice to buy — "Love an intentional purchase!" — rather than discouraging it), and the decision to never delete or modify the actual cart contents.
- **Conditional outro copy by flow.** Rather than one generic "you're done" card, the outro's copy and CTA are gated on whether the user actually typed a reflection (§2.3, §2.6). This was a deliberate signal that *engagement*, not just exposure to the prompts, is what the product rewards.
- **Shadow DOM for every injected surface.** Since Sift overlays a live third-party retailer page, style isolation wasn't optional — any leak in either direction would undermine trust in the product immediately. This constraint also forced the decision to inject Google Fonts into the real `document.head` rather than the shadow root, since the alternative (no custom typography in the overlay) was worse for the brand than the extra global side effect.
- **Three distinct exit affordances, not one.** Bypass (ESC hold), buy/save (outro card), and dismiss (topbar ×) map to three different user intents — skip Sift entirely, finish reflecting and proceed, or change your mind about the purchase — and were kept visually and behaviorally distinct rather than collapsed into a single "close" button.

## 4. Technical Challenges & Constraints

- **No ES modules in MV3 content scripts.** Forced the dependency-ordered IIFE/global pattern (`window.SiftCards`, etc., §2.1) — a constraint specific to the Chrome extension platform rather than something a typical web app would have to solve.
- **`position: fixed` inside a transformed ancestor.** `.sift-layout` uses `transform: translateY(-50%)` for vertical centering, which — per the CSS spec — makes it the containing block for any `position: fixed` descendants, silently breaking true-viewport positioning for both modals. Fixed by moving both modals to be root-level siblings of `.sift-layout` rather than children of it.
- **CSS animated gradient borders.** Browsers only accept `<image>` values in multi-layer `background`, so a flat color can't be mixed with a gradient on the same property. Solved with the padding-box/border-box double-background technique: `linear-gradient(color, color) padding-box, linear-gradient(...) border-box`.
- **Unsplash API rate limits.** The free tier's 50-requests/hour quota was being exhausted in roughly two page loads because every garment placeholder fired its required download-tracking ping on load. Fixed by deferring the ping until a user actually expands a given card, firing it at most once per photo, ever.
- **Figma scripting gotchas**, surfaced while building the formal design system: `frame.resize(w, 1)` silently locks *both* axes to `FIXED` rather than just the one being resized, collapsing auto-layout frames; and rebinding `fills`/`strokes` to a variable on an already-existing node doesn't visually re-resolve in the plugin environment unless the literal placeholder color matches the bound value.

## 5. Current State & Next Steps

As of this writing, Sift is a working, polished prototype of the full checkout-interception flow plus a standalone history-review page, backed by a matching Figma design system. Following the portfolio re-scoping (§2.9), the remaining backlog is framed around recording/demo readiness rather than shipping:

- **Toolbar popup refresh** — a visual/interaction polish pass, not a functional rebuild; the earlier plan to wire it to `utils/storage.js`'s real `getState()`/`setPillars()` API is no longer the priority.
- **Front-card micro-interactions** — hover lift, flip animation.
- **Pillar-toggle micro-interactions** — click ripple in the settings popover.
- **Cleanup** — delete the confirmed-dead v1 files (root-level `popup.html`/`popup.js`, `splash/splash.js`, `utils/site-detection.js`, `prompts/prompts.js`, the scrapped `onboarding/` module).
- **De-prioritized by the portfolio pivot** — extension icon assets (16/48/128px) and live-H&M selector smoke-testing; both were shipping-extension concerns rather than demo concerns.

---

*Compiled from `git log`, `CLAUDE.md` session recaps, `sift-prd-v2.md`, and project memory as of 2026-06-24.*
