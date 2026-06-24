(function () {
  'use strict';

  // Simple line-art clothing icons, matching the rest of the app's SVG
  // convention (24x24 viewBox, stroke-based, no fill). No network requests.
  const CLOTHING_ICONS = [
    // T-shirt
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M7 4 4 7v3l3-1v11h10V9l3 1V7l-3-3h-3l-2 2-2-2H7z"/></svg>',
    // Pants
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M6 4h12l-1 16h-4l-1-10-1 10H7L6 4z"/></svg>',
    // Dress
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M9 4h6l1 4-3 1 4 11H6l4-11-3-1 1-4z"/></svg>',
    // Sneaker
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M3 14v3a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-2l-4-1-2-3-4 2-3-1-2 1-2-2v2z"/></svg>',
  ];

  // Sample data only — this page is a hi-fi visual/interaction prototype,
  // not wired to chrome.storage.local. No real entries are ever persisted.
  const SAMPLE_ENTRIES = [
    {
      date: 'April 14, 2026',
      items: 4,
      pillars: ['money', 'need'],
      reflections: [
        { pillar: 'money', prompt: 'Does this cart feel like an investment in yourself, or a temporary fix?', response: 'Temporary fix honestly. I’m just bored today.' },
        { pillar: 'need', prompt: 'If this cart disappeared and you had to find every item again, would you bother?', response: 'Probably not for most of it. Maybe the jacket.' },
      ],
    },
    {
      date: 'April 8, 2026',
      items: 2,
      pillars: ['space'],
      reflections: [
        { pillar: 'space', prompt: 'Is your closet a curated collection or just…crowded? Where does this addition fit in?', response: 'I actually need a new white tee. My old one is worn out. This fits.' },
      ],
    },
    {
      date: 'March 29, 2026',
      items: 6,
      pillars: ['money', 'space', 'need'],
      reflections: [],
    },
    {
      date: 'March 22, 2026',
      items: 1,
      pillars: ['need'],
      reflections: [
        { pillar: 'need', prompt: 'If you couldn’t wear this for two weeks, would you still be excited for it to arrive?', response: '100%. This is a staple, not a mood purchase.' },
      ],
    },
    {
      date: 'March 15, 2026',
      items: 1,
      pillars: ['money', 'need'],
      reflections: [
        { pillar: 'money', prompt: 'If you had the cash equivalent of this cart in your hand right now, would you still trade it for these clothes?', response: 'Yes. I’ve been wanting this for months. It’s not impulsive.' },
        { pillar: 'need', prompt: 'Did you come here looking for this, or did it find you?', response: 'I was actively looking. Needed a replacement.' },
      ],
    },
    {
      date: 'March 3, 2026',
      items: 3,
      pillars: ['space', 'need'],
      reflections: [
        { pillar: 'space', prompt: 'Can you picture exactly which hangers or drawer dividers are currently empty and waiting for this?', response: 'Nope. That’s the problem lol' },
      ],
    },
    {
      date: 'February 18, 2026',
      items: 5,
      pillars: ['money'],
      reflections: [],
    },
    {
      date: 'February 2, 2026',
      items: 2,
      pillars: ['space'],
      reflections: [
        { pillar: 'space', prompt: 'Where exactly will this item go when it arrives? Can you picture a spot?', response: 'Top shelf, next to the other knits. There’s room.' },
      ],
    },
  ];

  const PILLAR_LABEL = { money: 'Money', space: 'Space', need: 'Need' };

  // Unsplash API — real garment photography for the cart placeholders.
  // This is a client-side demo key for this prototype only; falls back to
  // the line-art icons above if the request fails or rate-limits.
  const UNSPLASH_ACCESS_KEY = 'ed12Yf5m7_nfTW-wxQPf32gDNBgEhusF0AYQDm57u5Y';

  async function fetchUnsplashPhotos(count) {
    const url = `https://api.unsplash.com/photos/random?query=garment&orientation=portrait&count=${count}&client_id=${UNSPLASH_ACCESS_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Unsplash API ${res.status}`);
    return res.json();
  }

  // Required by Unsplash's API guidelines: ping the download endpoint once
  // per photo actually used/displayed. Fire-and-forget, never blocks render.
  function trackUnsplashDownload(photo) {
    if (!photo?.links?.download_location) return;
    fetch(`${photo.links.download_location}&client_id=${UNSPLASH_ACCESS_KEY}`).catch(() => {});
  }

  // Random sample prices/icons, generated once at load (not on every
  // render) so they stay stable while filtering/searching.
  function randomPrice() {
    return Math.round((Math.random() * (49.99 - 7.99) + 7.99) * 100) / 100;
  }

  SAMPLE_ENTRIES.forEach((entry) => {
    entry.products = Array.from({ length: entry.items }, () => ({
      price: randomPrice(),
      icon: CLOTHING_ICONS[Math.floor(Math.random() * CLOTHING_ICONS.length)],
      photo: null, // filled in by loadProductPhotos() if the Unsplash fetch succeeds
    }));
    entry.total = entry.products.reduce((sum, p) => sum + p.price, 0);
  });

  const ALL_PRODUCTS = SAMPLE_ENTRIES.flatMap((e) => e.products);

  // Fetches real garment photos and assigns one per product. Times out
  // after 4s so a slow/blocked network doesn't delay the first render —
  // products simply keep their icon fallback in that case.
  async function loadProductPhotos() {
    try {
      const photos = await Promise.race([
        fetchUnsplashPhotos(ALL_PRODUCTS.length),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
      ]);
      ALL_PRODUCTS.forEach((product, i) => {
        if (photos[i]) product.photo = photos[i];
      });
    } catch (err) {
      // Network failure, rate limit, or timeout — products keep their icon fallback.
      console.warn('Unsplash photo load failed, using icon fallback:', err.message);
    }
  }

  const entriesEl = document.getElementById('entries');
  const footerCountEl = document.getElementById('footer-count');
  const searchInput = document.getElementById('search-input');
  const chips = Array.from(document.querySelectorAll('.filter-chip'));

  let activePillars = new Set();
  let searchTerm = '';

  function productPlaceholderHTML(p) {
    if (p.photo) {
      const imgUrl = `${p.photo.urls.raw}&w=300&h=400&fit=crop&q=80`;
      const credit = `${p.photo.user.links.html}?utm_source=sift&utm_medium=referral`;
      return `
        <div class="product-placeholder has-photo">
          <img src="${imgUrl}" alt="Photo by ${p.photo.user.name} on Unsplash" loading="lazy">
          <span class="product-price">$${p.price.toFixed(2)}</span>
          <a class="product-credit" href="${credit}" target="_blank" rel="noopener">${p.photo.user.name}</a>
        </div>`;
    }
    return `
      <div class="product-placeholder">
        ${p.icon}
        <span class="product-price">$${p.price.toFixed(2)}</span>
      </div>`;
  }

  function productGridHTML(products) {
    return products.slice(0, 6).map(productPlaceholderHTML).join('');
  }

  function reflectionsHTML(entry) {
    if (!entry.reflections.length) {
      return '<div class="no-reflections">No reflections saved for this sift.</div>';
    }
    return entry.reflections
      .map(
        (r) => `
        <div class="reflection-item ${r.pillar}">
          <div class="reflection-prompt">"${r.prompt}"</div>
          <div class="reflection-response">${r.response}</div>
        </div>`
      )
      .join('');
  }

  function entryCardHTML(entry) {
    const pillarTags = entry.pillars
      .map((p) => `<span class="pillar-tag ${p}">${PILLAR_LABEL[p]}</span>`)
      .join('');

    return `
      <div class="entry-card">
        <div class="entry-top">
          <div class="entry-left">
            <div class="entry-date">${entry.date}</div>
            <div class="entry-site">H&amp;M — ${entry.items} item${entry.items === 1 ? '' : 's'}</div>
            <div class="entry-pillars">${pillarTags}</div>
          </div>
          <div class="entry-right">
            <div class="entry-arrow">▾</div>
          </div>
        </div>
        <div class="entry-details">
          <div class="entry-details-inner">
            <div class="entry-products">
              <div class="entry-products-label">Cart items</div>
              <div class="product-grid">${productGridHTML(entry.products)}</div>
              <div class="product-total">
                <span class="product-total-label">Total</span>
                <span class="product-total-amount">$${entry.total.toFixed(2)}</span>
              </div>
            </div>
            <div class="entry-reflections">
              <div class="entry-reflections-label">Your reflections</div>
              ${reflectionsHTML(entry)}
            </div>
          </div>
        </div>
      </div>`;
  }

  function matchesFilters(entry) {
    if (activePillars.size && !entry.pillars.some((p) => activePillars.has(p))) {
      return false;
    }
    if (!searchTerm) return true;
    const haystack = [
      entry.date,
      'h&m',
      ...entry.pillars.map((p) => PILLAR_LABEL[p]),
      ...entry.reflections.flatMap((r) => [r.prompt, r.response]),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(searchTerm);
  }

  function render() {
    const filtered = SAMPLE_ENTRIES.filter(matchesFilters);

    if (!filtered.length) {
      entriesEl.innerHTML = '<div class="entries-empty">No sifts match your search.</div>';
    } else {
      entriesEl.innerHTML = filtered.map(entryCardHTML).join('');
      Array.from(entriesEl.querySelectorAll('.entry-card')).forEach((card, i) => {
        const entry = filtered[i];
        card.style.animationDelay = `${i * 60}ms`;
        card.addEventListener('click', () => {
          const opening = !card.classList.contains('open');
          card.classList.toggle('open');
          // Only ping Unsplash's download endpoint for photos the user has
          // actually opened a card to see — and only once per photo, ever.
          if (opening) {
            entry.products.forEach((p) => {
              if (p.photo && !p.tracked) {
                p.tracked = true;
                trackUnsplashDownload(p.photo);
              }
            });
          }
        });
      });
    }

    const isFiltered = activePillars.size > 0 || searchTerm.length > 0;
    footerCountEl.textContent = isFiltered
      ? `Showing ${filtered.length} of ${SAMPLE_ENTRIES.length} sifts`
      : `${SAMPLE_ENTRIES.length} sifts saved`;
  }

  // Re-render with a brief fade so filter changes feel like a transition,
  // not an instant DOM swap.
  function rerenderWithTransition() {
    entriesEl.classList.add('filtering');
    setTimeout(() => {
      render();
      entriesEl.classList.remove('filtering');
    }, 150);
  }

  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    rerenderWithTransition();
  });

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const pillar = chip.dataset.pillar;
      if (activePillars.has(pillar)) {
        activePillars.delete(pillar);
        chip.classList.remove('active');
      } else {
        activePillars.add(pillar);
        chip.classList.add('active');
      }
      rerenderWithTransition();
    });
  });

  loadProductPhotos().then(render);
})();
