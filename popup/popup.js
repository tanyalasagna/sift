// Sift — Toolbar Popup
// Reads and writes chrome.storage.local directly.
// Changes save immediately on toggle — no confirm step.

'use strict';

const PILLARS = [
  { id: 'money', label: 'MONEY', tagline: 'Can I actually swing this?', bg: '#e8c88d', text: '#5c3d2e' },
  { id: 'space', label: 'SPACE', tagline: 'Will it all have a home?',   bg: '#a8b99a', text: '#ffffff' },
  { id: 'need',  label: 'NEED',  tagline: 'Do I want it or need it?',   bg: '#c49a8a', text: '#f5ede4' },
];

// ── Storage helpers ────────────────────────────────────────────

function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function storageSet(items) {
  return new Promise(resolve => chrome.storage.local.set(items, resolve));
}

// ── Render ─────────────────────────────────────────────────────

async function render() {
  const data = await storageGet(['sift_pillars']);
  let active = Array.isArray(data.sift_pillars) && data.sift_pillars.length
    ? data.sift_pillars
    : ['money', 'space', 'need'];

  const container = document.getElementById('pillars');
  container.innerHTML = PILLARS.map(p => `
    <button
      class="pillar-card ${active.includes(p.id) ? '' : 'off'}"
      data-id="${p.id}"
      style="--bg:${p.bg};--text:${p.text};"
      aria-pressed="${active.includes(p.id)}">
      <span class="pillar-dot"></span>
      <span class="pillar-label">${p.label}</span>
      <span class="pillar-tagline">${p.tagline}</span>
    </button>
  `).join('');

  container.querySelectorAll('.pillar-card').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pid      = btn.dataset.id;
      const isActive = !btn.classList.contains('off');

      if (isActive) {
        // Turning off — ensure at least one remains
        const next = active.filter(p => p !== pid);
        if (!next.length) return;
        active = next;
      } else {
        active = [...new Set([...active, pid])];
      }

      await storageSet({ sift_pillars: active });
      render();
    });
  });
}

// ── Boot ───────────────────────────────────────────────────────

render();
