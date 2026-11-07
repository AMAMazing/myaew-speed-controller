// ==UserScript==
// @name         MyAEW Homescreen Customizer (v8.3 - Static Header & Pill Bar)
// @match        https://www.watchaew.com/*
// @match        https://*.myaew.com/*
// @run-at       document-start
// ==/UserScript==

(() => {
  const CONFIG = {
    removeHero: true,
    removeFastChannel: true,
    hidePromoBanners: true,
    enableContinueWatching: true,
  };

  const HERO_ID = 'fc7b02e2-2c71-44c3-81bd-11cd3e6348ab_block';
  const ROW_SELECTOR = 'main > div > div.w-full.flex.flex-col';
  const FAST_RE = /watch aew fast channel/i;

  const SECTION_PRIORITY = [
    { match: /what's new/i, order: 10, category: 'aew', cleanTitle: "What's New" },
    { match: /live & upcoming/i, order: 15, category: 'live', cleanTitle: 'Live & Upcoming' },
    { match: /full gear|on sale now/i, order: 20, category: 'ppv', cleanTitle: 'Featured Event: Full Gear' },
    { match: /upcoming pay per views/i, order: 25, category: 'ppv', cleanTitle: 'Upcoming Pay-Per-Views' },
    { match: /dynamite & collision archive/i, order: 30, category: 'aew', cleanTitle: 'Dynamite & Collision' },
    { match: /ring of honor/i, order: 31, category: 'aew', cleanTitle: 'Ring of Honor' },
    { match: /2026 ppvs/i, order: 35, category: 'ppv', cleanTitle: '2026 Pay-Per-Views' },
    { match: /ppv archive/i, order: 40, category: 'ppv', cleanTitle: 'PPV Archive' },
    { match: /previous ppv events/i, order: 45, category: 'ppv', cleanTitle: 'Partner & Previous PPVs' },
    { match: /memorable matches/i, order: 55, category: 'aew', cleanTitle: 'Memorable Matches' },
    { match: /blood and guts/i, order: 60, category: 'aew', cleanTitle: 'Blood & Guts' },
    { match: /full gear.*saturday/i, order: 65, category: 'ppv', cleanTitle: 'Road to Full Gear' },
    { match: /aew dark & elevation/i, order: 70, category: 'aew', cleanTitle: 'Dark & Elevation' },
    { match: /close up/i, order: 75, category: 'originals', cleanTitle: 'Close Up w/ Renee Paquette' },
    { match: /hey! \(ew\)/i, order: 80, category: 'originals', cleanTitle: 'Hey! (EW)' },
    { match: /podcasts/i, order: 85, category: 'originals', cleanTitle: 'Podcasts' },
    { match: /cmll/i, order: 90, category: 'indies', cleanTitle: 'CMLL Lucha Libre' },
    { match: /maple leaf pro/i, order: 95, category: 'indies', cleanTitle: 'Maple Leaf Pro Wrestling' },
    { match: /pro wrestling: eve/i, order: 100, category: 'indies', cleanTitle: 'Pro-Wrestling: EVE' },
    { match: /1fw/i, order: 105, category: 'indies', cleanTitle: '1FW (Atlanta)' },
    { match: /myaew\+ matches/i, order: 110, category: 'indies', cleanTitle: 'MyAEW+ Partner Spotlight' },
    { match: /full schedule/i, order: 130, category: 'live', cleanTitle: 'Broadcast Schedule' },
  ];

  // ------------------------------------------------------------------ 1. INSTANT CSS
  function injectStyles() {
    if (document.getElementById('myaew-plus-styles')) return;

    const font = document.createElement('link');
    font.id = 'myaew-plus-font';
    font.rel = 'stylesheet';
    font.href =
      'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&display=swap';
    (document.head || document.documentElement).appendChild(font);

    const style = document.createElement('style');
    style.id = 'myaew-plus-styles';
    style.textContent = `
      :root {
        --aew-bg: #0a0a0b;
        --aew-bg-lift: #101012;
        --aew-surface: #16161a;
        --aew-surface-2: #1f1f25;
        --aew-gold: #f2c230;
        --aew-gold-dim: #b88f1c;
        --aew-gold-soft: rgba(242, 194, 48, 0.14);
        --aew-line: rgba(255, 255, 255, 0.08);
        --aew-line-strong: rgba(255, 255, 255, 0.16);
        --aew-text: #f4f4f5;
        --aew-muted: #8b8d96;
        --aew-display: 'Barlow Condensed', 'Arial Narrow', 'Helvetica Neue', system-ui, sans-serif;
        --aew-body: 'Barlow', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
        --aew-edge: 24px;
        --aew-radius: 8px;
        --aew-ease: cubic-bezier(0.22, 0.8, 0.24, 1);
      }

      html, body {
        background-color: var(--aew-bg) !important;
        background-image: linear-gradient(180deg, var(--aew-bg-lift) 0, var(--aew-bg) 420px) !important;
        background-repeat: no-repeat !important;
        overflow-x: clip !important;
      }

      /* Hide hero immediately via CSS before JS runs */
      ${CONFIG.removeHero ? `[id="${HERO_ID}"], div:has(> [id="${HERO_ID}"]) { display: none !important; }` : ''}
      .myaew-hidden { display: none !important; }

      /* Fix the site's lazy-load opacity/transform bug */
      main > div > div > div.w-full.flex.flex-col.relative {
        opacity: 1 !important;
        transform: none !important;
      }

      /* Kill native scrollbars under rows */
      .schedule-carousel *, .video-list-container *, .swiper, .swiper-wrapper {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      .schedule-carousel *::-webkit-scrollbar,
      .video-list-container *::-webkit-scrollbar,
      .swiper::-webkit-scrollbar,
      .swiper-wrapper::-webkit-scrollbar {
        display: none !important;
        height: 0 !important;
        width: 0 !important;
      }

      /* Visible keyboard focus everywhere we touch */
      .myaew-tab:focus-visible,
      .myaew-cw-btn:focus-visible,
      .schedule-tile:focus-visible,
      .schedule-tile a:focus-visible {
        outline: 2px solid var(--aew-gold) !important;
        outline-offset: 3px !important;
      }

      /* ---------- Static Floating Pill Nav ---------- */
      #myaew-hub-bar {
        position: sticky;
        top: calc(var(--u-total-nav-height, 55px) + 12px);
        z-index: 800;
        align-self: center;
        box-sizing: border-box;
        width: fit-content;
        max-width: calc(100% - (var(--aew-edge) * 2));
        margin: 14px auto 6px;
        padding: 6px;
        border-radius: 999px;
        background: rgba(34, 34, 38, 0.78);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06);
        backdrop-filter: blur(18px) saturate(150%);
        -webkit-backdrop-filter: blur(18px) saturate(150%);
      }

      .myaew-hub-pills {
        display: flex;
        align-items: center;
        gap: 4px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .myaew-hub-pills::-webkit-scrollbar { display: none; }

      .myaew-tab {
        background: transparent;
        border: 0;
        border-radius: 999px;
        color: #c9cad1;
        padding: 10px 22px;
        font-family: var(--aew-display);
        font-weight: 600;
        font-size: 18px;
        letter-spacing: 0.02em;
        white-space: nowrap;
        cursor: pointer;
        transition: background 0.2s var(--aew-ease), color 0.2s ease;
      }
      .myaew-tab:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }
      .myaew-tab.active,
      .myaew-tab.active:hover {
        background: var(--aew-gold);
        color: #0a0a0b;
      }

      /* ---------- Rows ---------- */
      .schedule-carousel,
      .video-list-container,
      .myaew-custom-row,
      main > div > div.w-full.flex.flex-col > div > div {
        padding-left: var(--aew-edge) !important;
        padding-right: var(--aew-edge) !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        box-sizing: border-box !important;
      }

      .schedule-carousel, .video-list-container, .myaew-custom-row {
        padding-top: 18px !important;
        padding-bottom: 4px !important;
      }

      /* Section titles: condensed display type with a rule that runs to the edge */
      .heading-font-size {
        font-family: var(--aew-display) !important;
        font-size: 28px !important;
        font-weight: 700 !important;
        line-height: 1.1 !important;
        letter-spacing: 0.01em !important;
        text-transform: none !important;
        color: var(--aew-text) !important;
        display: flex !important;
        align-items: center !important;
        gap: 16px !important;
      }
      .heading-font-size::before { content: none !important; }
      .heading-font-size::after {
        content: "" !important;
        flex: 1 1 auto;
        height: 1px;
        background: linear-gradient(90deg, var(--aew-line-strong), transparent);
      }

      /* Room for hover-lift without triggering scrollbars */
      .schedule-carousel .swiper,
      .video-list-container .swiper {
        padding: 10px 0 14px 0 !important;
        margin: 0 !important;
        overflow: visible !important;
      }
      .schedule-carousel, .video-list-container {
        overflow-x: clip !important;
      }

      /* ---------- Cards ---------- */
      .schedule-tile {
        border-radius: var(--aew-radius) !important;
        padding: 0 !important;
        transition: transform 0.22s var(--aew-ease) !important;
        will-change: transform;
      }
      .schedule-tile:hover {
        transform: translateY(-3px) !important;
        z-index: 25;
      }
      .schedule-tile .top-half,
      .schedule-tile .inner-tile {
        border-radius: var(--aew-radius) !important;
        overflow: hidden !important;
        background: var(--aew-surface);
        box-shadow: 0 0 0 1px var(--aew-line), 0 8px 20px rgba(0, 0, 0, 0.5);
        transition: box-shadow 0.22s var(--aew-ease);
      }
      .schedule-tile:hover .top-half,
      .schedule-tile:hover .inner-tile {
        box-shadow: 0 0 0 2px var(--aew-gold), 0 14px 30px rgba(0, 0, 0, 0.7) !important;
      }
      .schedule-tile img {
        transition: transform 0.5s var(--aew-ease), filter 0.3s ease;
      }
      .schedule-tile:hover img {
        transform: scale(1.04);
        filter: brightness(1.06);
      }

      .schedule-tile h2 {
        font-family: var(--aew-body) !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        line-height: 1.35 !important;
        margin-top: 10px !important;
        display: -webkit-box !important;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        color: var(--aew-text) !important;
        transition: color 0.16s ease;
      }
      .schedule-tile:hover h2 { color: #fff !important; }
      .schedule-tile p {
        font-family: var(--aew-body) !important;
        font-size: 12.5px !important;
        color: var(--aew-muted) !important;
        margin-top: 3px !important;
        font-weight: 400 !important;
      }

      /* Progress bar: thin gold fill */
      .progress-bar-container {
        height: 3px !important;
        margin: 10px 0 2px !important;
        border-radius: 3px;
        overflow: hidden;
      }
      .progress-bar {
        background: rgba(255, 255, 255, 0.14) !important;
        height: 100% !important;
      }
      .progress-bar .progress {
        background: var(--aew-gold) !important;
        height: 100% !important;
        border-radius: 3px;
      }

      /* ---------- Continue Watching ---------- */
      #myaew-continue-watching {
        width: 100%;
        box-sizing: border-box;
      }
      .myaew-cw-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 2px;
      }
      .myaew-cw-header .heading-font-size { flex: 1 1 auto; }
      .myaew-cw-nav {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }
      .myaew-cw-btn {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 1px solid var(--aew-line-strong);
        background: transparent;
        color: var(--aew-text);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        line-height: 1;
        transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease;
      }
      .myaew-cw-btn:hover {
        background: var(--aew-gold);
        color: #0a0a0b;
        border-color: var(--aew-gold);
      }
      .myaew-custom-scroller {
        display: flex;
        gap: 16px;
        overflow-x: auto;
        padding: 10px 0 14px 0;
        scroll-behavior: smooth;
        scrollbar-width: none;
      }
      .myaew-custom-scroller::-webkit-scrollbar { display: none; }
      .myaew-custom-card {
        flex: 0 0 290px;
        width: 290px;
        max-width: 290px;
      }

      @media (max-width: 768px) {
        :root { --aew-edge: 14px; }
        .myaew-tab { padding: 8px 16px; font-size: 16px; }
        .myaew-custom-card { flex: 0 0 230px; width: 230px; max-width: 230px; }
        .heading-font-size { font-size: 23px !important; }
      }

      @media (prefers-reduced-motion: reduce) {
        .schedule-tile, .schedule-tile img, .myaew-tab, .myaew-custom-scroller {
          transition: none !important;
          scroll-behavior: auto !important;
        }
        .schedule-tile:hover, .schedule-tile:hover img { transform: none !important; }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  injectStyles();

  // --------------------------------------------------------------- 2. HELPERS
  const getMain = () => document.querySelector(ROW_SELECTOR);
  const getRows = () =>
    Array.from(document.querySelectorAll('[data-myaew-category]')).filter(
      (el) => el.id !== 'myaew-continue-watching'
    );

  // ------------------------------------------------------ 3. ORGANIZE SECTIONS
  function organizeAndTagSections() {
    const mainColumn = getMain();
    if (!mainColumn) return;

    const children = mainColumn.children;
    for (let i = 0; i < children.length; i++) {
      const wrapper = children[i];
      if (wrapper.id && wrapper.id.startsWith('myaew-')) continue;
      if (wrapper.dataset.myaewTagged === '1') continue;

      const blockEl = wrapper.firstElementChild;
      if ((blockEl && blockEl.id === HERO_ID) || wrapper.querySelector('#' + CSS.escape(HERO_ID))) {
        if (CONFIG.removeHero) wrapper.classList.add('myaew-hidden');
        wrapper.style.order = '1';
        wrapper.dataset.myaewTagged = '1';
        continue;
      }

      const headingEl = wrapper.querySelector('h2');
      if (!headingEl) {
        const hasContent = wrapper.querySelector('.schedule-tile, .swiper-slide');
        if (CONFIG.hidePromoBanners && !hasContent) wrapper.classList.add('myaew-hidden');
        wrapper.style.order = '200';
        continue;
      }

      const rawTitle = (headingEl.dataset.myaewRaw || headingEl.textContent).trim();
      if (!rawTitle) continue;
      headingEl.dataset.myaewRaw = rawTitle;

      if (CONFIG.removeFastChannel && FAST_RE.test(rawTitle)) {
        wrapper.classList.add('myaew-hidden');
        wrapper.dataset.myaewTagged = '1';
        continue;
      }

      if (
        CONFIG.hidePromoBanners &&
        (/coming soon/i.test(rawTitle) || /click here!/i.test(rawTitle))
      ) {
        wrapper.classList.add('myaew-hidden');
        wrapper.dataset.myaewTagged = '1';
        continue;
      }

      const cfg = SECTION_PRIORITY.find((c) => c.match.test(rawTitle)) || {
        order: 115,
        category: 'aew',
        cleanTitle: rawTitle,
      };

      wrapper.style.order = String(cfg.order);
      wrapper.dataset.myaewCategory = cfg.category;
      wrapper.dataset.myaewTagged = '1';

      const textNode = Array.from(headingEl.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
      if (textNode) textNode.nodeValue = cfg.cleanTitle;
      else headingEl.textContent = cfg.cleanTitle;
    }
  }

  // -------------------------------------------------------- 4. CONTINUE WATCHING
  const cwSeenTitles = new Set();

  function updateContinueWatchingRow() {
    if (!CONFIG.enableContinueWatching) return;
    const mainColumn = getMain();
    if (!mainColumn) return;

    const newTiles = [];
    const tiles = document.querySelectorAll('.schedule-tile');

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      if (tile.closest('#myaew-continue-watching')) continue;

      const bar = tile.querySelector('.progress-bar .progress');
      if (!bar || !bar.style.width) continue;

      const pct = parseFloat(bar.style.width);
      if (!(pct > 1 && pct < 95)) continue;

      const title = tile.querySelector('h2')?.textContent.trim();
      if (!title || cwSeenTitles.has(title)) continue;

      cwSeenTitles.add(title);
      newTiles.push(tile);
    }

    if (!newTiles.length) return;

    let row = document.getElementById('myaew-continue-watching');
    if (!row) {
      row = document.createElement('div');
      row.id = 'myaew-continue-watching';
      row.className = 'myaew-custom-row';
      row.style.order = '5';
      row.dataset.myaewCategory = 'all';
      row.innerHTML = `
        <div class="myaew-cw-header">
          <h2 class="heading-font-size">Continue Watching</h2>
          <div class="myaew-cw-nav">
            <button class="myaew-cw-btn" id="myaew-cw-prev" aria-label="Scroll Left">&#8249;</button>
            <button class="myaew-cw-btn" id="myaew-cw-next" aria-label="Scroll Right">&#8250;</button>
          </div>
        </div>
        <div class="myaew-custom-scroller"></div>
      `;
      mainColumn.appendChild(row);

      const scroller = row.querySelector('.myaew-custom-scroller');
      row.querySelector('#myaew-cw-prev').addEventListener('click', () => {
        scroller.scrollBy({ left: -620, behavior: 'smooth' });
      });
      row.querySelector('#myaew-cw-next').addEventListener('click', () => {
        scroller.scrollBy({ left: 620, behavior: 'smooth' });
      });
    }

    const scroller = row.querySelector('.myaew-custom-scroller');
    newTiles.forEach((tile) => {
      const card = document.createElement('div');
      card.className = 'myaew-custom-card';
      const clone = tile.cloneNode(true);
      clone.addEventListener('click', (e) => {
        e.preventDefault();
        const link = tile.querySelector('a') || tile;
        link.click();
      });
      card.appendChild(clone);
      scroller.appendChild(card);
    });
  }

  // ------------------------------------------------------------ 5. HUB & SEARCH
  function buildHubAndSearchBar() {
    const mainColumn = getMain();
    if (!mainColumn || document.getElementById('myaew-hub-bar')) return;

    const hub = document.createElement('div');
    hub.id = 'myaew-hub-bar';
    hub.style.order = '2';

    const categories = [
      { id: 'all', label: 'All' },
      { id: 'aew', label: 'AEW TV' },
      { id: 'ppv', label: 'Pay-Per-Views' },
      { id: 'indies', label: 'Partners' },
      { id: 'originals', label: 'Originals' },
      { id: 'live', label: 'Live & Schedule' },
    ];

    const pills = document.createElement('div');
    pills.className = 'myaew-hub-pills';
    pills.setAttribute('role', 'tablist');

    categories.forEach((cat, i) => {
      const btn = document.createElement('button');
      btn.className = 'myaew-tab' + (i === 0 ? ' active' : '');
      btn.dataset.cat = cat.id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      btn.textContent = cat.label;
      btn.addEventListener('click', () => {
        pills.querySelectorAll('.myaew-tab').forEach((p) => {
          p.classList.remove('active');
          p.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        applyFilters();
      });
      pills.appendChild(btn);
    });

    hub.appendChild(pills);
    mainColumn.appendChild(hub);
  }

  function applyFilters() {
    const cat = document.querySelector('.myaew-tab.active')?.dataset.cat || 'all';

    const cw = document.getElementById('myaew-continue-watching');
    if (cw) cw.classList.toggle('myaew-hidden', cat !== 'all');

    getRows().forEach((row) => {
      const catOk = cat === 'all' || row.dataset.myaewCategory === cat;
      row.classList.toggle('myaew-hidden', !catOk);
    });
  }

  function dismissUpgradeModal() {
    document.querySelectorAll('div.fixed.bottom-0').forEach((m) => {
      if (m.textContent.includes('Get more for less!')) m.style.display = 'none';
    });
  }

  // ---------------------------------------------------------------- 6. FAST ENGINE
  let rafScheduled = false;

  function runUpdate() {
    rafScheduled = false;
    injectStyles();
    if (!getMain()) return;

    buildHubAndSearchBar();
    organizeAndTagSections();
    updateContinueWatchingRow();
    dismissUpgradeModal();
    applyFilters();
  }

  function scheduleUpdate() {
    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(runUpdate);
    }
  }

  function boot() {
    if (getMain()) {
      runUpdate();
    } else {
      requestAnimationFrame(boot);
    }
  }

  boot();

  const startObserver = () => {
    const observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        if (mutations[i].addedNodes.length > 0) {
          scheduleUpdate();
          break;
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, { once: true });
})();