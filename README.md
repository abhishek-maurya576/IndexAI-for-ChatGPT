# IndexAI for ChatGPT (Chrome Extension)

IndexAI automatically builds a clickable, searchable index of your user prompts in any ChatGPT conversation. Quickly navigate, filter, and export your conversation outline to Markdown or TXT.

Version: 1.1.0

Now includes a full-screen overlay panel and a draggable floating button (FAB) to open/close it.

## Features
- Real-time detection of user prompts (MutationObserver)
- Sidebar overlay with search and a scrollable index
- Click to jump to any prompt
- Persists per conversation via `chrome.storage.local`
- Export to `.md` or `.txt`
 - Robust de-duplication of prompts (canonical and near-duplicate detection)
 - SPA navigation detection (switching chats refreshes the list automatically)

## Install (Developer Mode)
1. Open Chrome and go to `chrome://extensions`
2. Toggle on Developer mode (top-right)
3. Click "Load unpacked" and select this folder (`IndexAI`)
4. Open ChatGPT (`https://chat.openai.com` or `https://chatgpt.com`). The purple IndexAI floating button (with icon) appears; click it to open the overlay panel

## Usage
- Prompts are indexed automatically as you send them
- Use the search bar to filter the list instantly
- Click a list item to jump to that message in the page
- Use MD/TXT buttons to export the index
- Use Clear to reset the index for the current conversation only
 - Press Esc or click outside the panel to close the overlay
 - Keyboard shortcut: Alt+I toggles the overlay

## Files
- `manifest.json`: MV3 config, icons, and web accessible icon
- `content.js`: Injected content script (indexing, overlay, floating button with icon, SPA navigation, export)
- `style.css`: Liquid glass morphic styling and FAB styles

## Notes
- If ChatGPT’s DOM changes break detection, update `USER_MESSAGE_SELECTORS` in `content.js`
- Conversation-scoped storage key is derived from the URL path `/c/<id>`; if absent, it falls back to `session`
 - Icon file lives at `images/IndexAI_icon.png` and is declared under `web_accessible_resources`
