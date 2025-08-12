# IndexAI for ChatGPT (Chrome Extension)

IndexAI automatically builds a clickable, searchable index of your user prompts in any ChatGPT conversation. Quickly navigate, filter, and export your conversation outline to Markdown or TXT.

## Features
- Real-time detection of user prompts (MutationObserver)
- Sidebar with search and a scrollable index
- Click to jump to any prompt
- Persists per conversation via `chrome.storage.local`
- Export to `.md` or `.txt`

## Install (Developer Mode)
1. Open Chrome and go to `chrome://extensions`
2. Toggle on Developer mode (top-right)
3. Click "Load unpacked" and select this folder (`IndexAI`)
4. Open ChatGPT (`https://chat.openai.com` or `https://chatgpt.com`). The IndexAI sidebar should appear automatically

## Usage
- Prompts are indexed automatically as you send them
- Use the search bar to filter the list instantly
- Click a list item to jump to that message in the page
- Use MD/TXT buttons to export the index
- Use Clear to reset the index for the current conversation only

## Files
- `manifest.json`: Manifest V3 config
- `content.js`: Injected content script (indexing, sidebar, export)
- `style.css`: Sidebar styling, light/dark friendly

## Notes
- If ChatGPT’s DOM changes break detection, update `USER_MESSAGE_SELECTORS` in `content.js`
- Conversation-scoped storage key is derived from the URL path `/c/<id>`; if absent, it falls back to `session`
