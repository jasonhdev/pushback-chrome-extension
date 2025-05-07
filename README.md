# Pushback - Bringing Pushbullet Back

This is a Chrome extension that brings Pushbullet functionality back to your browser after the original was discontinued due to Manifest V3 changes. It allows seamless messaging, file sharing, and one-click link pushing between your devices using the Pushbullet API.

> **Note**: This extension is unnoficial, and not affiliated with or endorsed by Pushbullet.

---

## ✨ Features

- Real-time two-way messaging between your phone and computer via WebSocket.
- Receive desktop notifications upon incoming pushes
- Send and receive file attachments directly in your browser.
- Instantly push URLs from your browser to your phone with a single click.

---

## 🚀 Installation

To install and use this extension, you'll need:

- A Pushbullet account
- Your Pushbullet Access Token (from your [Pushbullet Account Settings](https://www.pushbullet.com/#settings))
- Chrome browser with Developer Mode enabled

1. **Clone or download** this repository to your computer.
2. Open `chrome://extensions/` in your Chrome browser.
3. Enable **Developer Mode** (toggle switch in the top right).
4. Click **Load unpacked** and select the folder where you saved the extension files.
5. Once loaded, click the extension icon in your toolbar to open it.
6. **Enter your Pushbullet Access Token** when prompted.

---

## 📡 How It Works

This extension establishes a persistent WebSocket connection to the Pushbullet API, keeping your devices in sync in real time.

To help stay within Pushbullet's free-tier limits, the extension caches data in `localStorage` to minimize API calls and keep things efficient.

> Pushbullet API usage details can be found [here](https://docs.pushbullet.com/)