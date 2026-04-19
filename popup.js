// Sift v2 — Popup
// Reads/writes chrome.storage.local directly (no content script relay needed).

const PILLARS = [
  { id: 'money', label: 'Money', hint: 'Can I actually swing this?', accent: '#4caf7d', accentLight: '#e8f5ee' },
  { id: 'space', label: 'Space', hint: 'Will this have a home?',     accent: '#4a90d9', accentLight: '#e8f0fa' },
  { id: 'need',  label: 'Need',  hint: 'Do I want it or need it?',   accent: '#e8962e', accentLight: '#fdf0e0' },
];

async function getStorage(keys) {
  return new Promise(res => chrome.storage.local.get(keys, res));
}

async function setStorage(items) {
  return new Promise(res => chrome.storage.local.set(items, res));
}

async function render() {
  const data = await getStorage(['sift_pillars']);
  let active = Array.isArray(data.sift_pillars) ? data.sift_pillars : ['money', 'space', 'need'];

  const list = document.getElementById('pillar-list');
  list.innerHTML = PILLARS.map(p => `
    <button
      class="pillar-toggle ${active.includes(p.id) ? 'on' : ''}"
      data-id="${p.id}"
      style="--ac:${p.accent};--al:${p.accentLight};"
      aria-pressed="${active.includes(p.id)}">
      <span class="dot"></span>
      <span class="pillar-name">${p.label}</span>
      <span class="pillar-hint">${p.hint}</span>
    </button>`).join('');

  list.querySelectorAll('.pillar-toggle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pid = btn.dataset.id;
      const isOn = btn.classList.contains('on');
      let next = isOn
        ? active.filter(p => p !== pid)
        : [...active, pid];
      if (!next.length) return; // must keep at least one
      active = next;
      await setStorage({ sift_pillars: active });
      render();
    });
  });
}

document.getElementById('reset-onboarding').addEventListener('click', async () => {
  await new Promise(res => chrome.storage.local.remove(['sift_onboarded', 'sift_pillars', 'sift_intention'], res));
  render();
});

render();
