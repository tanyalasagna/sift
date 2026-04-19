// Splash screen overlay — shown on first visit to a clothing site each session.
// All UI lives inside a Shadow DOM container to prevent style leakage.

const PILLARS = [
  {
    id: 'affordability',
    label: 'Affordability',
    tagline: 'Can I actually afford this?',
    accent: '#4caf7d',
    accentLight: '#e8f5ee',
    accentDark: '#2e7d52',
    symbol: '◈',
  },
  {
    id: 'space',
    label: 'Space',
    tagline: 'Do I have room for this?',
    accent: '#4a90d9',
    accentLight: '#e8f0fa',
    accentDark: '#2c5f9e',
    symbol: '◉',
  },
  {
    id: 'need',
    label: 'Need',
    tagline: 'Do I genuinely need this?',
    accent: '#e8962e',
    accentLight: '#fdf0e0',
    accentDark: '#b56b0f',
    symbol: '◆',
  },
];

const CSS = `
  :host {
    --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    all: initial;
    display: block;
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    font-family: var(--font);
  }

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 15, 30, 0.55);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
  }

  .modal {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -48%) scale(0.97);
    opacity: 0;
    width: min(460px, calc(100vw - 32px));
    background: #faf9f6;
    border-radius: 20px;
    padding: 36px 32px 28px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.10);
    transition:
      opacity 0.35s cubic-bezier(0.22, 1, 0.36, 1),
      transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .modal.visible {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }

  /* ── Header ── */
  .header {
    text-align: center;
    margin-bottom: 28px;
  }

  .wordmark {
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -1.5px;
    color: #1a1a2e;
    line-height: 1;
  }

  .wordmark .dot {
    color: #4caf7d;
  }

  .tagline {
    margin-top: 8px;
    font-size: 14px;
    color: #6b7280;
    line-height: 1.45;
  }

  /* ── Pillar cards ── */
  .pillars-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #9ca3af;
    margin-bottom: 10px;
  }

  .pillars {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 22px;
  }

  .pillar-card {
    position: relative;
    border-radius: 12px;
    border: 2px solid #e5e0d8;
    background: #ffffff;
    padding: 14px 10px 12px;
    text-align: center;
    cursor: pointer;
    transition:
      border-color 0.18s ease,
      background 0.18s ease,
      transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.18s ease;
    user-select: none;
    -webkit-user-select: none;
  }

  .pillar-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.10);
  }

  .pillar-card:active {
    transform: scale(0.96);
  }

  .pillar-card.selected {
    border-color: var(--pillar-accent);
    background: var(--pillar-accent-light);
  }

  .pillar-card.selected .pillar-check {
    opacity: 1;
    transform: scale(1);
  }

  .pillar-symbol {
    font-size: 22px;
    margin-bottom: 6px;
    color: var(--pillar-accent-dark);
    display: block;
  }

  .pillar-name {
    font-size: 13px;
    font-weight: 700;
    color: #1a1a2e;
    display: block;
    margin-bottom: 3px;
  }

  .pillar-hint {
    font-size: 10.5px;
    color: #9ca3af;
    line-height: 1.3;
    display: block;
  }

  .pillar-check {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--pillar-accent);
    color: #fff;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transform: scale(0.5);
    transition:
      opacity 0.18s ease,
      transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* ── Intention input ── */
  .intention-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #9ca3af;
    margin-bottom: 8px;
  }

  .intention-wrap {
    position: relative;
    margin-bottom: 24px;
  }

  .intention-input {
    width: 100%;
    padding: 11px 14px;
    border: 1.5px solid #e5e0d8;
    border-radius: 10px;
    font-size: 14px;
    font-family: var(--font);
    color: #1a1a2e;
    background: #ffffff;
    outline: none;
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
    appearance: none;
    -webkit-appearance: none;
  }

  .intention-input::placeholder {
    color: #c0bab2;
  }

  .intention-input:focus {
    border-color: #4caf7d;
    box-shadow: 0 0 0 3px rgba(76, 175, 125, 0.15);
  }

  /* ── Actions ── */
  .actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .btn-activate {
    width: 100%;
    padding: 14px;
    border-radius: 12px;
    border: none;
    background: #1a1a2e;
    color: #ffffff;
    font-size: 15px;
    font-weight: 700;
    font-family: var(--font);
    cursor: pointer;
    letter-spacing: -0.2px;
    transition: background 0.18s ease, transform 0.12s ease, box-shadow 0.18s ease;
    box-shadow: 0 4px 14px rgba(26, 26, 46, 0.25);
  }

  .btn-activate:hover {
    background: #2d2d4a;
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(26, 26, 46, 0.30);
  }

  .btn-activate:active {
    transform: scale(0.98);
  }

  .btn-activate:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .btn-skip {
    background: none;
    border: none;
    font-size: 13px;
    font-family: var(--font);
    color: #9ca3af;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: color 0.15s ease;
  }

  .btn-skip:hover {
    color: #6b7280;
  }

  /* ── Validation nudge ── */
  .nudge {
    font-size: 12px;
    color: #e8962e;
    text-align: center;
    height: 16px;
    transition: opacity 0.2s;
    opacity: 0;
  }
  .nudge.show { opacity: 1; }
`;

/**
 * Injects the splash screen overlay into the page.
 *
 * @param {(result: SplashResult) => void} onComplete
 *   Called when the user submits or dismisses. Never throws.
 *
 * @typedef {{ optedOut: boolean, pillars: string[], intention: string }} SplashResult
 */
export function showSplash(onComplete) {
  // Prevent duplicates
  if (document.getElementById('sift-splash-host')) return;

  // ── Create shadow host ──────────────────────────────────────────────────────
  const host = document.createElement('div');
  host.id = 'sift-splash-host';
  // The host itself must not block pointer events (the modal handles its own)
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  // ── Inject styles ───────────────────────────────────────────────────────────
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  shadow.appendChild(styleEl);

  // ── Build DOM ───────────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;pointer-events:auto;';

  root.innerHTML = `
    <div class="backdrop" id="backdrop"></div>

    <div class="modal" id="modal" role="dialog" aria-modal="true" aria-label="Sift — Set up your session">

      <div class="header">
        <div class="wordmark">Sift<span class="dot">.</span></div>
        <div class="tagline">A quick check-in before you shop.<br>Pick what you want to reflect on today.</div>
      </div>

      <div class="pillars-label">What matters to you today?</div>

      <div class="pillars" id="pillars">
        ${PILLARS.map(p => `
          <button
            class="pillar-card selected"
            data-pillar="${p.id}"
            style="--pillar-accent:${p.accent};--pillar-accent-light:${p.accentLight};--pillar-accent-dark:${p.accentDark};"
            aria-pressed="true"
            aria-label="${p.label}"
          >
            <span class="pillar-check">✓</span>
            <span class="pillar-symbol">${p.symbol}</span>
            <span class="pillar-name">${p.label}</span>
            <span class="pillar-hint">${p.tagline}</span>
          </button>
        `).join('')}
      </div>

      <div class="intention-label">What are you shopping for? <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#c0bab2;">(optional)</span></div>
      <div class="intention-wrap">
        <input
          class="intention-input"
          id="intention"
          type="text"
          placeholder="e.g. a white t-shirt for work"
          maxlength="140"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <div class="nudge" id="nudge">Select at least one pillar to activate Sift.</div>

      <div class="actions">
        <button class="btn-activate" id="btn-activate">Activate Sift</button>
        <button class="btn-skip" id="btn-skip">Not today</button>
      </div>

    </div>
  `;

  shadow.appendChild(root);

  // ── Animate in ──────────────────────────────────────────────────────────────
  const modal = shadow.getElementById('modal');
  // Double rAF ensures the initial transform is painted before we add .visible
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      modal.classList.add('visible');
    });
  });

  // ── Pillar toggle logic ─────────────────────────────────────────────────────
  const pillarButtons = shadow.querySelectorAll('.pillar-card');

  pillarButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const isSelected = btn.classList.contains('selected');
      btn.classList.toggle('selected', !isSelected);
      btn.setAttribute('aria-pressed', String(!isSelected));
      updateActivateButton();
    });
  });

  function getSelectedPillars() {
    return [...shadow.querySelectorAll('.pillar-card.selected')].map(b => b.dataset.pillar);
  }

  function updateActivateButton() {
    const btn = shadow.getElementById('btn-activate');
    const nudge = shadow.getElementById('nudge');
    const hasSelection = getSelectedPillars().length > 0;
    btn.disabled = !hasSelection;
    nudge.classList.toggle('show', !hasSelection);
  }

  updateActivateButton();

  // ── Dismiss helper ──────────────────────────────────────────────────────────
  function dismiss(result) {
    modal.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    modal.style.opacity = '0';
    modal.style.transform = 'translate(-50%, -48%) scale(0.97)';

    const backdrop = shadow.getElementById('backdrop');
    backdrop.style.transition = 'opacity 0.25s ease';
    backdrop.style.opacity = '0';

    setTimeout(() => {
      host.remove();
      onComplete(result);
    }, 260);
  }

  // ── Button handlers ─────────────────────────────────────────────────────────
  shadow.getElementById('btn-activate').addEventListener('click', () => {
    const pillars = getSelectedPillars();
    if (pillars.length === 0) return;
    const intention = shadow.getElementById('intention').value.trim();
    dismiss({ optedOut: false, pillars, intention });
  });

  shadow.getElementById('btn-skip').addEventListener('click', () => {
    dismiss({ optedOut: true, pillars: [], intention: '' });
  });

  // Close on backdrop click
  shadow.getElementById('backdrop').addEventListener('click', () => {
    dismiss({ optedOut: true, pillars: [], intention: '' });
  });

  // Trap Escape key
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', onKey);
      dismiss({ optedOut: true, pillars: [], intention: '' });
    }
  });
}
