(() => {
  'use strict';

  const PANEL_ID = 'indexai-panel';
  const OVERLAY_ID = 'indexai-overlay';
  const FAB_ID = 'indexai-fab';
  const LIST_ID = 'indexai-list';
  const SEARCH_ID = 'indexai-search';
  const STATUS_ID = 'indexai-status';
  const TOGGLE_ID = 'indexai-toggle';
  const STORAGE_NAMESPACE = 'indexai';

  const state = {
    prompts: [],
    idToPrompt: new Map(),
    textHashToId: new Map(),
    canonicalToId: new Map(),
    initialized: false,
  };

  // --------------- Utils ---------------
  function getConversationId() {
    try {
      const match = location.pathname.match(/\/c\/([\w-]+)/i);
      if (match && match[1]) return match[1];
    } catch (_) {}
    return 'session';
  }

  function getStorageKey() {
    return `${STORAGE_NAMESPACE}:${location.host}:${getConversationId()}`;
  }

  function promisifyChrome(fn, ...args) {
    return new Promise((resolve, reject) => {
      try {
        fn(...args, (result) => {
          const lastError = chrome.runtime && chrome.runtime.lastError;
          if (lastError) reject(lastError);
          else resolve(result);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  function storageGet(key) {
    return promisifyChrome(chrome.storage.local.get, key).then((res) => res && res[key]);
  }

  function storageSet(key, value) {
    return promisifyChrome(chrome.storage.local.set, { [key]: value });
  }

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function truncate(text, max = 100) {
    if (!text) return '';
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    return clean.slice(0, max - 1) + '…';
  }

  function normalizePromptText(text) {
    let t = String(text || '');
    t = t.replace(/\s+/g, ' ').trim();
    t = t.replace(/^you said[:,]?\s*/i, '');
    return t;
  }

  function simpleHash(input) {
    // FNV-1a 32-bit
    let hash = 0x811c9dc5;
    const str = String(input || '');
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(36);
  }

  function canonicalKey(text) {
    let t = normalizePromptText(text).toLowerCase();
    // Trim trailing segment markers like "(2/2)", "2/2", "part 2 of 2"
    t = t.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '');
    t = t.replace(/\s*\b\d+\s*\/\s*\d+\s*$/i, '');
    t = t.replace(/\s*\bpart\s*\d+\s*of\s*\d+\s*$/i, '');
    // Remove terminal punctuation and excess whitespace
    t = t.replace(/[\s\-–—·.,;:!]+$/g, '');
    t = t.replace(/[.,!?;:()\[\]{}"'`]+/g, '');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  function isNearDuplicate(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const shortLen = Math.min(a.length, b.length);
    const longLen = Math.max(a.length, b.length);
    if (shortLen < 16) return false;
    const ratio = shortLen / longLen;
    return (a.includes(b) || b.includes(a)) && ratio >= 0.9;
  }

  function normalizePromptText(text) {
    let t = String(text || '');
    t = t.replace(/\s+/g, ' ').trim();
    t = t.replace(/^you said[:,]?\s*/i, '');
    return t;
  }

  function simpleHash(input) {
    // FNV-1a 32-bit
    let hash = 0x811c9dc5;
    const str = String(input || '');
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(36);
  }

  // Removed visible time due to site rendering variance; keep helper if needed later

  // --------------- Sidebar UI ---------------
  function ensureSidebar() {
    if (document.getElementById(PANEL_ID)) return;
    // Create overlay container
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.setAttribute('aria-hidden', 'true');
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideOverlay();
      });
      document.documentElement.appendChild(overlay);
      // ESC closes overlay
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideOverlay();
      });
    }

    const panel = document.createElement('aside');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'IndexAI ChatGPT Sidebar');

    panel.innerHTML = `
      <header class="indexai-header">
        <div class="indexai-title">IndexAI</div>
        <div class="indexai-actions">
          <button class="indexai-btn" id="indexai-export-md" title="Export as Markdown">MD</button>
          <button class="indexai-btn" id="indexai-export-txt" title="Export as Text">TXT</button>
          <button class="indexai-btn danger" id="indexai-clear" title="Clear index for this chat">Clear</button>
          <button class="indexai-btn ghost" id="${TOGGLE_ID}" title="Close">✕</button>
        </div>
      </header>
      <div class="indexai-controls">
        <input id="${SEARCH_ID}" class="indexai-search" type="search" placeholder="Search prompts…" aria-label="Search prompts" />
        <div id="${STATUS_ID}" class="indexai-status" aria-live="polite"></div>
      </div>
      <ul id="${LIST_ID}" class="indexai-list" role="list"></ul>
    `;

    overlay.appendChild(panel);

    // Listeners
    const search = panel.querySelector(`#${SEARCH_ID}`);
    search.addEventListener('input', () => renderList(search.value));

    panel.querySelector('#indexai-export-md').addEventListener('click', () => exportIndex('md'));
    panel.querySelector('#indexai-export-txt').addEventListener('click', () => exportIndex('txt'));
    panel.querySelector('#indexai-clear').addEventListener('click', () => clearIndex());
    panel.querySelector(`#${TOGGLE_ID}`).addEventListener('click', () => hideOverlay());
  }

  function showOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function hideOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function toggleOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    if (overlay.classList.contains('visible')) hideOverlay();
    else showOverlay();
  }

  // Floating action button (FAB)
  function ensureFloatingButton() {
    if (document.getElementById(FAB_ID)) return;
    const fab = document.createElement('button');
    fab.id = FAB_ID;
    fab.className = 'indexai-fab';
    fab.title = 'IndexAI';
    fab.setAttribute('aria-label', 'Open IndexAI');
    fab.innerText = 'IndexAI';
    // Append to body (more reliable stacking in some pages)
    (document.body || document.documentElement).appendChild(fab);

    // Try to brand the FAB with the extension icon using <img>
    try {
      const iconUrl = chrome?.runtime?.getURL?.('images/IndexAI_icon.png');
      if (iconUrl) {
        fab.classList.add('icon-only');
        fab.textContent = '';
        const img = document.createElement('img');
        img.src = iconUrl;
        img.alt = 'IndexAI';
        img.width = 28;
        img.height = 28;
        img.style.width = '28px';
        img.style.height = '28px';
        img.style.display = 'block';
        img.style.pointerEvents = 'none';
        fab.appendChild(img);
      }
    } catch (_) {}

    // Ensure visible even if CSS fails to load (fallback inline style)
    try {
      const computed = window.getComputedStyle(fab);
      if (!computed || computed.position !== 'fixed') {
        fab.style.position = 'fixed';
        fab.style.right = '16px';
        fab.style.bottom = '16px';
        fab.style.zIndex = '2147483647';
        if (!fab.style.backgroundImage) fab.style.background = '#8b5cf6';
        fab.style.color = '#ffffff';
        fab.style.border = 'none';
        fab.style.borderRadius = '999px';
        if (fab.textContent) {
          fab.style.padding = '10px 14px';
        } else {
          fab.style.width = '48px';
          fab.style.height = '48px';
          fab.style.padding = '0';
          fab.style.backgroundRepeat = 'no-repeat';
          fab.style.backgroundPosition = 'center';
          fab.style.backgroundSize = '26px 26px';
        }
        fab.style.fontWeight = '700';
        fab.style.boxShadow = '0 6px 18px rgba(0,0,0,0.25)';
        fab.style.cursor = 'pointer';
        fab.style.userSelect = 'none';
      }
    } catch (_) {}

    // Restore position
    loadFabPosition().then((pos) => {
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        const clampedX = clamp(pos.x, 8, window.innerWidth - fab.offsetWidth - 8);
        const clampedY = clamp(pos.y, 8, window.innerHeight - fab.offsetHeight - 8);
        setFabPositionStyle(fab, clampedX, clampedY);
      }
    });

    let dragging = false;
    let startX = 0, startY = 0, originX = 0, originY = 0;

    const onPointerDown = (e) => {
      dragging = true;
      fab.classList.add('dragging');
      const point = getPoint(e);
      startX = point.x; startY = point.y;
      const rect = fab.getBoundingClientRect();
      originX = rect.left; originY = rect.top;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp, { once: true });
    };

    const onPointerMove = (e) => {
      if (!dragging) return;
      const point = getPoint(e);
      const dx = point.x - startX;
      const dy = point.y - startY;
      const x = clamp(originX + dx, 8, window.innerWidth - fab.offsetWidth - 8);
      const y = clamp(originY + dy, 8, window.innerHeight - fab.offsetHeight - 8);
      setFabPositionStyle(fab, x, y);
    };

    const onPointerUp = async () => {
      dragging = false;
      fab.classList.remove('dragging');
      window.removeEventListener('pointermove', onPointerMove);
      // Save
      const rect = fab.getBoundingClientRect();
      await saveFabPosition({ x: rect.left, y: rect.top });
    };

    fab.addEventListener('pointerdown', onPointerDown);
    fab.addEventListener('click', (e) => {
      if (dragging) return; // ignore click if dragging
      e.preventDefault();
      toggleOverlay();
    });

    // Keep in view on resize
    window.addEventListener('resize', () => {
      const rect = fab.getBoundingClientRect();
      const x = clamp(rect.left, 8, window.innerWidth - fab.offsetWidth - 8);
      const y = clamp(rect.top, 8, window.innerHeight - fab.offsetHeight - 8);
      setFabPositionStyle(fab, x, y);
    });
  }

  function getPoint(e) {
    return {
      x: e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0,
      y: e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0,
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setFabPositionStyle(el, x, y) {
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.style.position = 'fixed';
  }

  async function loadFabPosition() {
    try {
      const key = `${STORAGE_NAMESPACE}:fab:${location.host}`;
      const res = await storageGet(key);
      return res || null;
    } catch (_) { return null; }
  }

  async function saveFabPosition(pos) {
    try {
      const key = `${STORAGE_NAMESPACE}:fab:${location.host}`;
      await storageSet(key, pos);
    } catch (_) {}
  }

  function setStatus(text) {
    const el = document.getElementById(STATUS_ID);
    if (el) el.textContent = text || '';
  }

  function renderList(filterText = '') {
    const list = document.getElementById(LIST_ID);
    if (!list) return;
    list.innerHTML = '';

    const needle = (filterText || '').toLowerCase();
    const filtered = needle
      ? state.prompts.filter((p) => p.text.toLowerCase().includes(needle))
      : state.prompts;

    for (const prompt of filtered) {
      const item = document.createElement('li');
      item.className = 'indexai-item';
      item.dataset.id = prompt.id;
      item.innerHTML = `
        <button class="indexai-item-btn" title="Jump to message">
          <span class="indexai-item-text">${escapeHtml(truncate(prompt.text, 160))}</span>
        </button>
      `;
      item.querySelector('button').addEventListener('click', () => jumpToPrompt(prompt.id, prompt.text));
      list.appendChild(item);
    }

    setStatus(filtered.length ? `${filtered.length} prompt${filtered.length === 1 ? '' : 's'}` : 'No prompts');
  }

  function escapeHtml(str) {
    return str
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // --------------- Indexing ---------------
  const USER_MESSAGE_SELECTORS = [
    'div[data-message-author-role="user"]',
    'div[data-testid="user"]',
    'div[data-author="user"]',
    'article:has([data-message-author-role="user"])',
    'div[class*="markdown"] div.whitespace-pre-wrap'
  ];

  function findUserMessageElements(root) {
    const results = [];
    const seen = new Set();
    for (const sel of USER_MESSAGE_SELECTORS) {
      let nodes = [];
      try {
        nodes = root.querySelectorAll(sel);
      } catch (_) {
        // ignore selector errors on older Chrome (e.g., :has), attempt next selectors
        continue;
      }
      nodes.forEach((node) => {
        const container = normalizeUserMessageContainer(node);
        if (container && !seen.has(container)) {
          seen.add(container);
          results.push(container);
        }
      });
    }
    return results;
  }

  function normalizeUserMessageContainer(el) {
    if (!(el instanceof Element)) return null;
    const container = el.closest('[data-message-author-role="user"], [data-message-id], article, section, div');
    return container || null;
  }

  function extractText(el) {
    if (!(el instanceof Element)) return '';
    let text = '';
    try {
      text = el.innerText || el.textContent || '';
    } catch (_) {}
    text = (text || '').replace(/\s+/g, ' ').trim();
    if (text.length > 4000) text = text.slice(0, 4000);
    return text;
  }

  function getOrAssignId(el) {
    if (!(el instanceof Element)) return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    // Prefer stable IndexAI id if we have already assigned one
    let id = el.getAttribute('data-indexai-id')
      || el.getAttribute('data-message-id')
      || el.dataset.messageId
      || el.getAttribute('id');
    if (!id) id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    el.setAttribute('data-indexai-id', id);
    return id;
  }

  function addPromptFromElement(el) {
    const textRaw = extractText(el);
    const text = normalizePromptText(textRaw);
    if (!text) return;
    if (el instanceof Element && el.getAttribute('data-indexai-processed') === '1') return;
    const id = getOrAssignId(el);
    // Text-based dedupe using canonical key and hash
    const canonical = canonicalKey(text);
    const h = simpleHash(canonical);
    if (state.textHashToId.has(h) || state.canonicalToId.has(canonical)) {
      // Map element to existing id for navigation and mark processed
      const existingId = state.textHashToId.get(h) || state.canonicalToId.get(canonical);
      if (el instanceof Element) {
        el.setAttribute('data-indexai-id', existingId);
        el.setAttribute('data-indexai-processed', '1');
      }
      return;
    }
    // Fuzzy near-duplicate: check existing canonical keys
    for (const [canonExisting, existingId] of state.canonicalToId.entries()) {
      if (isNearDuplicate(canonical, canonExisting)) {
        if (el instanceof Element) {
          el.setAttribute('data-indexai-id', existingId);
          el.setAttribute('data-indexai-processed', '1');
        }
        return;
      }
    }
    if (state.idToPrompt.has(id)) {
      if (el instanceof Element) el.setAttribute('data-indexai-processed', '1');
      return;
    }

    const prompt = { id, text };
    state.prompts.push(prompt);
    state.idToPrompt.set(id, prompt);
    state.textHashToId.set(h, id);
    state.canonicalToId.set(canonical, id);
    if (el instanceof Element) el.setAttribute('data-indexai-processed', '1');

    // Incremental render
    appendListItem(prompt);
    saveDebounced();
  }

  function appendListItem(prompt) {
    const list = document.getElementById(LIST_ID);
    if (!list) return;
    const item = document.createElement('li');
    item.className = 'indexai-item';
    item.dataset.id = prompt.id;
    item.innerHTML = `
      <button class="indexai-item-btn" title="Jump to message">
        <span class="indexai-item-text">${escapeHtml(truncate(prompt.text, 160))}</span>
      </button>
    `;
    item.querySelector('button').addEventListener('click', () => jumpToPrompt(prompt.id, prompt.text));
    list.appendChild(item);
    setStatus(`${state.prompts.length} prompt${state.prompts.length === 1 ? '' : 's'}`);
  }

  function scanForUserMessages(root) {
    const elements = findUserMessageElements(root);
    elements.forEach(addPromptFromElement);
  }

  function saveState() {
    const payload = {
      prompts: state.prompts,
      savedAt: Date.now(),
      url: location.href,
      title: document.title,
      host: location.host,
      conversationId: getConversationId(),
      version: '0.1.0',
    };
    storageSet(getStorageKey(), payload).catch(() => {});
  }

  const saveDebounced = debounce(saveState, 500);

  // --------------- Navigation ---------------
  function jumpToPrompt(id, fallbackText = '') {
    let target = document.querySelector(`[data-indexai-id="${CSS.escape(id)}"]`);
    if (!target) target = document.querySelector(`[data-message-id="${CSS.escape(id)}"]`);

    if (!target && fallbackText) {
      // Fallback: find by text includes
      const candidates = findUserMessageElements(document.body);
      const needle = fallbackText.slice(0, 64).toLowerCase();
      target = candidates.find((el) => (el.innerText || '').toLowerCase().includes(needle));
    }

    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      flashElement(target);
    }
  }

  function flashElement(el) {
    try {
      el.classList.add('indexai-flash');
      setTimeout(() => el.classList.remove('indexai-flash'), 1200);
    } catch (_) {}
  }

  // --------------- Export ---------------
  function exportIndex(format = 'md') {
    const title = document.title || 'ChatGPT Conversation';
    const url = location.href;
    const now = new Date();
    const header = format === 'md'
      ? `# ChatGPT Conversation Index\n\n- Title: ${escapeMd(title)}\n- URL: ${escapeMd(url)}\n- Exported: ${now.toISOString()}\n\n---\n\n`
      : `ChatGPT Conversation Index\nTitle: ${title}\nURL: ${url}\nExported: ${now.toISOString()}\n\n`;

    const lines = state.prompts.map((p, i) => {
      const line = `${String(i + 1).padStart(3, ' ')}. ${p.text.replace(/\s+/g, ' ').trim()}`;
      return format === 'md' ? escapeMd(line) : line;
    });

    const content = header + lines.join('\n') + '\n';
    const filenameBase = `indexai_${getConversationId()}_${now.toISOString().replaceAll(':', '').replaceAll('.', '')}`;
    const filename = format === 'md' ? `${filenameBase}.md` : `${filenameBase}.txt`;
    const mime = format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
    downloadFile(filename, content, mime);
  }

  function escapeMd(str) {
    return (str || '').replace(/[\\`*_{}\[\]()#+\-.!|>]/g, '\\$&');
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // --------------- Clear ---------------
  async function clearIndex() {
    state.prompts = [];
    state.idToPrompt.clear();
    state.textHashToId.clear();
    await storageSet(getStorageKey(), { prompts: [], savedAt: Date.now(), url: location.href, title: document.title });
    renderList('');
  }

  // --------------- Navigation between chats (SPA) ---------------
  let lastConversationKey = '';

  async function handleNavigationChange() {
    const key = getStorageKey();
    if (key === lastConversationKey) return;
    lastConversationKey = key;

    // Reset current state
    state.prompts = [];
    state.idToPrompt.clear();
    state.textHashToId.clear();
    state.canonicalToId.clear();
    renderList('');

    // Load saved prompts for this conversation
    try {
      const saved = await storageGet(key);
      if (saved && Array.isArray(saved.prompts)) {
        state.prompts = saved.prompts;
        state.idToPrompt.clear();
        state.textHashToId.clear();
        state.canonicalToId.clear();
        for (const p of state.prompts) {
          state.idToPrompt.set(p.id, p);
          const canon = canonicalKey(p.text);
          state.textHashToId.set(simpleHash(canon), p.id);
          state.canonicalToId.set(canon, p.id);
        }
      }
    } catch (_) {}

    // Re-scan the page for user messages
    scanForUserMessages(document.body);
  }

  function installRouteListener() {
    const wrap = (type) => {
      const original = history[type];
      return function () {
        const ret = original.apply(this, arguments);
        window.dispatchEvent(new Event('indexai:navigation'));
        return ret;
      };
    };
    try {
      history.pushState = wrap('pushState');
      history.replaceState = wrap('replaceState');
    } catch (_) {}
    window.addEventListener('popstate', () => setTimeout(handleNavigationChange, 0));
    window.addEventListener('indexai:navigation', () => setTimeout(handleNavigationChange, 0));
  }

  // Fallback URL change detection (poller)
  let lastHref = location.href;
  let urlPollerId = null;
  function startUrlPoller() {
    if (urlPollerId) return;
    urlPollerId = window.setInterval(() => {
      const current = location.href;
      if (current !== lastHref) {
        lastHref = current;
        handleNavigationChange();
      }
    }, 800);
  }

  // --------------- Observer ---------------
  function observe() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
          m.addedNodes.forEach((node) => {
            if (node && node.nodeType === 1) {
              scanForUserMessages(node);
            }
          });
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // --------------- Bootstrap ---------------
  async function init() {
    if (state.initialized) return;
    state.initialized = true;
    ensureSidebar();
    ensureFloatingButton();

    // Keyboard shortcut: Alt+I toggles
    document.addEventListener('keydown', (e) => {
      const key = (e.key || '').toLowerCase();
      if (e.altKey && key === 'i') {
        e.preventDefault();
        toggleOverlay();
      }
    });

    // First-time load key and data
    lastConversationKey = getStorageKey();
    try {
      const saved = await storageGet(lastConversationKey);
      if (saved && Array.isArray(saved.prompts)) {
        state.prompts = saved.prompts;
        state.idToPrompt.clear();
        state.textHashToId.clear();
        state.canonicalToId.clear();
        for (const p of state.prompts) {
          state.idToPrompt.set(p.id, p);
          const canon = canonicalKey(p.text);
          state.textHashToId.set(simpleHash(canon), p.id);
          state.canonicalToId.set(canon, p.id);
        }
      }
    } catch (_) {}

    renderList('');
    scanForUserMessages(document.body);
    observe();
    installRouteListener();

    // Fallback URL poller to catch SPA transitions reliably
    startUrlPoller();

    // Cross-tab sync: when storage for this conversation changes, update UI
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        const key = getStorageKey();
        if (changes[key]) {
          const newVal = changes[key].newValue;
          if (newVal && Array.isArray(newVal.prompts)) {
            state.prompts = newVal.prompts;
            state.idToPrompt.clear();
            state.textHashToId.clear();
            state.canonicalToId.clear();
            for (const p of state.prompts) {
              state.idToPrompt.set(p.id, p);
              const canon = canonicalKey(p.text);
              state.textHashToId.set(simpleHash(canon), p.id);
              state.canonicalToId.set(canon, p.id);
            }
            renderList(document.getElementById('indexai-search')?.value || '');
          }
        }
      });
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();


