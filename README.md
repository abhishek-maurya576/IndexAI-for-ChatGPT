<div align="center">

# 🚀 IndexAI for ChatGPT

### *Your Personal ChatGPT Conversation Navigator*

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/Version-1.1.0-brightgreen?style=for-the-badge)](https://github.com/abhishekmaurya/IndexAI)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![ChatGPT](https://img.shields.io/badge/ChatGPT-Compatible-00A67E?style=for-the-badge&logo=openai&logoColor=white)](https://chat.openai.com)

*Automatically builds a clickable, searchable index of your user prompts in any ChatGPT conversation. Quickly navigate, filter, and export your conversation outline to Markdown or TXT.*

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔍 **Smart Indexing**
- 🤖 Real-time prompt detection with MutationObserver
- 🎯 Robust de-duplication system
- 📍 SPA navigation detection
- 💾 Persistent storage per conversation

</td>
<td width="50%">

### 🎨 **Modern Interface**
- 🌟 Full-screen overlay panel
- 🎈 Draggable floating action button
- 🔍 Instant search & filtering
- ✨ Liquid glass morphic styling

</td>
</tr>
<tr>
<td width="50%">

### 🚀 **Navigation**
- ⚡ One-click jump to any prompt
- ⌨️ Keyboard shortcuts (`Alt+I`)
- 🎯 Smooth scrolling to messages
- 📱 Mobile-friendly interface

</td>
<td width="50%">

### 📤 **Export Options**
- 📝 Export to Markdown (`.md`)
- 📄 Export to Text (`.txt`)
- 🗂️ Organized conversation outlines
- 💼 Perfect for documentation

</td>
</tr>
</table>

---

## 🚀 Quick Start

### 📦 Installation (Developer Mode)

1. **Open Chrome Extensions**
   ```
   Navigate to: chrome://extensions
   ```

2. **Enable Developer Mode**
   - Toggle "Developer mode" (top-right corner)

3. **Load Extension**
   - Click "Load unpacked"
   - Select the `IndexAI` folder

4. **Start Using**
   - Visit [ChatGPT](https://chat.openai.com) or [ChatGPT.com](https://chatgpt.com)
   - Look for the purple 🎈 IndexAI floating button
   - Click to open the overlay panel!

---

## 🎯 How to Use

| Action | Method |
|--------|--------|
| **Open Panel** | Click the floating button or press `Alt+I` |
| **Search Prompts** | Use the search bar for instant filtering |
| **Jump to Message** | Click any item in the index list |
| **Export Conversation** | Use `MD` or `TXT` export buttons |
| **Clear Index** | Reset current conversation index |
| **Close Panel** | Press `Esc` or click outside the panel |

---

## 📁 Project Structure

```
IndexAI/
├── 📄 manifest.json      # Chrome Extension configuration
├── 🎨 style.css          # Liquid glass morphic styling
├── ⚙️ content.js         # Core functionality & UI
├── 📖 README.md          # This file
└── 🖼️ images/
    └── IndexAI_icon.png  # Extension icon
```

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 configuration, permissions, and icons |
| `content.js` | Injected script handling indexing, UI, and exports |
| `style.css` | Modern glass morphism styling for the interface |

---

## 🛠️ Technical Details

<details>
<summary><strong>🔧 Configuration & Customization</strong></summary>

### DOM Selector Updates
If ChatGPT's interface changes and breaks prompt detection:
```javascript
// Update USER_MESSAGE_SELECTORS in content.js
const USER_MESSAGE_SELECTORS = [
  // Add new selectors here
];
```

### Storage Management
- **Scope**: Per-conversation storage using URL path `/c/<id>`
- **Fallback**: Session-based storage when conversation ID unavailable
- **API**: Chrome Storage Local API for persistence

### Icon Resources
- **Location**: `images/IndexAI_icon.png`
- **Accessibility**: Declared in `web_accessible_resources`
- **Formats**: 16x16, 32x32, 48x48, 128x128

</details>

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. 🍴 Fork the repository
2. 🌿 Create a feature branch (`git checkout -b feature/amazing-feature`)
3. 💾 Commit your changes (`git commit -m 'Add amazing feature'`)
4. 📤 Push to the branch (`git push origin feature/amazing-feature`)
5. 🎉 Open a Pull Request

---

## 📋 Requirements

- ![Chrome](https://img.shields.io/badge/Chrome-4285F4?style=flat&logo=googlechrome&logoColor=white) **Chrome Browser** (or Chromium-based)
- ![Manifest](https://img.shields.io/badge/Manifest-V3-green?style=flat) **Manifest V3** support
- ![ChatGPT](https://img.shields.io/badge/ChatGPT-Account-00A67E?style=flat&logo=openai&logoColor=white) **ChatGPT** access

---

## 📞 Support

Having issues? We're here to help!

- 🐛 [Report a Bug](https://github.com/abhishekmaurya/IndexAI/issues/new?template=bug_report.md)
- 💡 [Request a Feature](https://github.com/abhishekmaurya/IndexAI/issues/new?template=feature_request.md)
- 💬 [Join Discussions](https://github.com/abhishekmaurya/IndexAI/discussions)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

### 🌟 Star this repo if you find it helpful!

[![GitHub stars](https://img.shields.io/github/stars/abhishekmaurya/IndexAI?style=social)](https://github.com/abhishekmaurya/IndexAI/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/abhishekmaurya/IndexAI?style=social)](https://github.com/abhishekmaurya/IndexAI/network/members)

**Made with ❤️ by Abhishek Maurya for the ChatGPT community**

</div>
