(() => {
  'use strict';

  const PANEL_ID = 'indexai-panel';
  const LIST_ID = 'indexai-list';
  const SEARCH_ID = 'indexai-search';
  const STATUS_ID = 'indexai-status';
  const TOGGLE_ID = 'indexai-toggle';
  const STORAGE_NAMESPACE = 'indexai';

  const state = {
    prompts: [],
    idToPrompt: new Map(),
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

  const storageKey = `${STORAGE_NAMESPACE}:${location.host}:${getConversationId()}`;

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

  function formatTime(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  // --------------- Sidebar UI ---------------
  function ensureSidebar() {
    if (document.getElementById(PANEL_ID)) return;

    const panel = document.createElement('aside');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'complementary');
    panel.setAttribute('aria-label', 'IndexAI ChatGPT Sidebar');

    panel.innerHTML = `
      <header class="indexai-header">
        <div class="indexai-title">IndexAI</div>
        <div class="indexai-actions">
          <button class="indexai-btn" id="indexai-export-md" title="Export as Markdown">MD</button>
          <button class="indexai-btn" id="indexai-export-txt" title="Export as Text">TXT</button>
          <button class="indexai-btn danger" id="indexai-clear" title="Clear index for this chat">Clear</button>
          <button class="indexai-btn ghost" id="${TOGGLE_ID}" title="Collapse">⇤</button>
        </div>
      </header>
      <div class="indexai-controls">
        <input id="${SEARCH_ID}" class="indexai-search" type="search" placeholder="Search prompts…" aria-label="Search prompts" />
        <div id="${STATUS_ID}" class="indexai-status" aria-live="polite"></div>
      </div>
      <ul id="${LIST_ID}" class="indexai-list" role="list"></ul>
    `;

    document.documentElement.appendChild(panel);

    // Listeners
    const search = panel.querySelector(`#${SEARCH_ID}`);
    search.addEventListener('input', () => renderList(search.value));

    panel.querySelector('#indexai-export-md').addEventListener('click', () => exportIndex('md'));
    panel.querySelector('#indexai-export-txt').addEventListener('click', () => exportIndex('txt'));
    panel.querySelector('#indexai-clear').addEventListener('click', () => clearIndex());
    panel.querySelector(`#${TOGGLE_ID}`).addEventListener('click', () => {
      panel.classList.toggle('collapsed');
    });
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
          <span class="indexai-item-time">${formatTime(prompt.time)}</span>
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
    let id = el.getAttribute('data-message-id') || el.dataset.messageId || el.getAttribute('id');
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
    el.setAttribute('data-indexai-id', id);
    return id;
  }

  function addPromptFromElement(el) {
    const text = extractText(el);
    if (!text) return;
    const id = getOrAssignId(el);
    if (state.idToPrompt.has(id)) return;

    const prompt = { id, text, time: Date.now() };
    state.prompts.push(prompt);
    state.idToPrompt.set(id, prompt);

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
        <span class="indexai-item-time">${formatTime(prompt.time)}</span>
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
    storageSet(storageKey, payload).catch(() => {});
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
    await storageSet(storageKey, { prompts: [], savedAt: Date.now(), url: location.href, title: document.title });
    renderList('');
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

    try {
      const saved = await storageGet(storageKey);
      if (saved && Array.isArray(saved.prompts)) {
        state.prompts = saved.prompts;
        state.idToPrompt.clear();
        for (const p of state.prompts) state.idToPrompt.set(p.id, p);
      }
    } catch (_) {}

    renderList('');
    scanForUserMessages(document.body);
    observe();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();


