# Sift — Product Requirements Document (MVP v2)

## Overview

**Sift** is a Chrome extension that helps users curb impulse clothing purchases on **H&M** (proof of concept). It intercepts the checkout flow with card-based reflection prompts grounded in three pillars: **Money**, **Space**, and **Need**.

This MVP assumes the user is already logged into H&M as a member.

---

## Target User

H&M online shoppers who want help making more intentional purchases.

---

## Core Concept

Three reflection pillars:

- **Money** — Can I actually swing this?
- **Space** — Will this have a home?
- **Need** — Do I want it or need it?

Prompts appear as playing cards at the checkout transition point, creating a moment of reflection before purchase.

---

## User Flow (MVP v2)

### 1. Installation & First-Time Onboarding

When the user installs Sift and visits H&M for the first time:

- A **one-time onboarding overlay** appears over the page.
- Wordmark: *"Sift."* at the top.
- Tagline: *"Before you dive in, pick your gut-check."*
- User selects which pillar(s) they want active (all three pre-selected by default):
  - 💰 Money — *"Can I actually swing this?"*
  - 🏠 Space — *"Will this have a home?"*
  - 🪞 Need — *"Do I want it or need it?"*
- Optional intention field: *"What brought you here today?"*
- CTA: *"Let's go"*
- Skip: *"Not today"* (defaults to all three pillars)
- Footer: *"Everything here stays between you and you."*
- Settings note: *"You can change your preferences anytime in settings."*

**This overlay never appears again.** Pillar selections saved to `chrome.storage.local`.

### 2. Changing Pillars Later

- Via the **extension popup** (toolbar icon) — reads/writes `chrome.storage.local` directly.
- Via the **gear icon (⚙)** during the card experience — live pillar changes with reshuffle animation.

### 3. Uninterrupted Shopping

- After onboarding, Sift is completely invisible while the user browses H&M.

### 4. Checkout Hijack — Card Experience

When the user clicks **"Continue to checkout"** on H&M's bag/cart page:

- The click is intercepted (`preventDefault` + `stopImmediatePropagation`).
- A **full-viewport overlay** appears with a warm pastel gradient: `linear-gradient(114.327deg, rgba(232,200,141,0.85) 11%, rgba(167,185,154,0.85) 67.7%, rgba(196,154,138,0.85) 94.2%)` — the three pillar colors blended at 85% opacity.
- The **card experience** loads on top of this overlay.

#### Card Experience Layout

- **Top-right: Gear icon (⚙)** — opens a popover to toggle active pillars. Changing pillars triggers a fade → reshuffle → fade-in animation on the stack. At least one pillar must remain active.
- **Center-left: Solitaire card stack** — cards stacked with 7px offset per depth (up to 5 cards visible). Front card is fully interactive; back cards are decorative with a crosshatch texture and "SIFT" watermark.
- **Below the stack: Two buttons side by side**
  - **🔀 Shuffle** — rotates the top card to the bottom with a fly-out/enter animation.
  - **I've decided to buy these items** — proceeds to the exit flow.
- **Bottom-right: ESC ring** — visible progress indicator while holding ESC.

#### Front Card Anatomy

- Pillar accent color bar at top (6px)
- Pillar emoji + label (uppercased)
- Prompt question
- Textarea for reflection (placeholder = input nudge)
- Footer: *"This stays between you and you."*

#### Deck Logic

- 2 cards randomly selected from each active pillar's pool of 4.
- All selected cards shuffled together (pillars intermixed).
- No fixed first or last card — deck is fully shuffled.

| Active pillars | Cards in deck |
|---|---|
| 1 pillar | 2 cards |
| 2 pillars | 4 cards |
| 3 pillars | 6 cards |

#### ESC Hold to Exit

- Hold ESC for 5 seconds to bypass Sift and proceed directly to checkout.
- SVG circular ring in the bottom-right fills as a progress indicator during hold.
- Releasing ESC before 5 seconds cancels.

### 5. Exit Flow — "I've decided to buy"

When the user clicks **"I've decided to buy these items"**:

- Card overlay fades out.
- A centered modal replaces it with a dark translucent backdrop.
- Content:
  > **Before you leave, think about:**
  > · If it's worth the money
  > · If you have the space
  > · How often you'll use the item
  >
  > **We hope you cherish your items!**
- Single button: **"Continue to checkout"** — fires the original H&M checkout button click, navigation proceeds.

### 6. Session Behavior

- The card experience triggers **every time** the user clicks "Continue to checkout."
- Pillar selections persist across sessions.

---

## Technical Architecture (Chrome Extension — Manifest V3)

### File Structure (actual)

```
sift/
├── manifest.json              # MV3 — *.hm.com only
├── background.js              # Minimal service worker (logs install/update)
├── content.js                 # 47-line orchestrator
├── onboarding/
│   ├── onboarding.js          # window.SiftOnboarding — Shadow DOM overlay
│   └── onboarding.css
├── cards/
│   ├── cards.js               # window.SiftCards — full card experience
│   └── cards.css
├── exit/
│   ├── exit.js                # window.SiftExit — "Before you leave" modal
│   └── exit.css
├── popup/
│   ├── popup.html             # Toolbar popup (pillar toggles + reset)
│   ├── popup.css
│   └── popup.js
├── prompts/
│   └── prompts.json           # 12 prompts (4 per pillar)
├── styles/
│   └── global.css             # CSS token reference (not injected)
├── assets/
│   └── icons/                 # Empty — icons not yet created
└── utils/
    ├── storage.js             # window.SiftStorage — chrome.storage.local helpers
    ├── checkout-detection.js  # window.SiftCheckout — click interceptor
    └── esc-hold.js            # window.SiftEscHold — 5s ESC hold with SVG ring
```

### Content Script Load Order

`manifest.json` loads all JS as separate content scripts in dependency order (no ES module imports):

```
utils/storage.js          → window.SiftStorage
utils/checkout-detection.js → window.SiftCheckout
utils/esc-hold.js         → window.SiftEscHold
onboarding/onboarding.js  → window.SiftOnboarding
cards/cards.js            → window.SiftCards
exit/exit.js              → window.SiftExit
content.js                ← orchestrator
```

### Key Technical Decisions

**Checkout bypass**: `_bypassed = true` flag + `btn.click()` re-fires the original button. H&M's React handlers are blocked on the first capture-phase click, then run normally on the programmatic second click.

**Shadow DOM**: All overlays (onboarding, cards, exit) use closed Shadow DOM to prevent style conflicts with H&M.

**CSS + prompts**: Fetched via `chrome.runtime.getURL()` at runtime, cached after first load.

**Gear icon pillar changes**: Saves to storage, calls `reshuffleStack()` — fade out → rebuild deck → fade in.

**ESC hold**: `SiftEscHold.start()` drives `stroke-dashoffset` on an SVG circle at 50ms ticks. Returns a cleanup function called on dismiss.

---

## Pillar Accent Colors (in-code)

| Pillar | Accent | Light | Dark | Card back |
|--------|--------|-------|------|-----------|
| Money | `#4caf7d` | `#e8f5ee` | `#2e7d52` | `#0f2018` |
| Space | `#4a90d9` | `#e8f0fa` | `#2c5f9e` | `#0f1a28` |
| Need  | `#e8962e` | `#fdf0e0` | `#b56b0f` | `#281a0f` |

---

## Prompt Content

12 total prompts (4 per pillar) in `prompts/prompts.json`. Each has: `id`, `prompt`, `nudge`.

**Money** (tone: direct & punchy): M1–M4
**Space** (tone: warm & grounding): S1–S4
**Need** (tone: cheeky & playful): N1–N4

---

## What's Left

- **Extension icons** — `assets/icons/` is empty; no `"icons"` field in `manifest.json`. Need 16×16, 48×48, 128×128 PNGs.
- **Live H&M testing** — checkout button selector and `bypass()` re-click mechanism need smoke testing against hm.com.
- **Orphaned v1 files** — safe to delete: `popup.html`, `popup.js` (root level), `splash/splash.js`, `utils/site-detection.js`, `prompts/prompts.js`.
- **Visual design implementation** — Figma designs being implemented frame by frame (in progress).
- **Figma → code alignment** — card accent colors, button copy, and deck structure in-code diverge from the Figma master file; being reconciled during design implementation.

---

## Out of Scope (MVP)

- Any site other than H&M
- Mobile support
- User accounts or cloud sync
- Analytics or data collection
- Prompt customization by the user
- Card dragging
