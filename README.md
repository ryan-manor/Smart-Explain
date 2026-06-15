# Smart Explain

An [Obsidian](https://obsidian.md) plugin that gives you AI-powered explanations for any selected text. Select a word, phrase, or passage, and Smart Explain opens a popover with a concise, context-aware explanation streamed from Google Gemini.

## Features

- **Context-aware explanations** — sends the note title, heading hierarchy, and surrounding text so the AI understands *what* you're reading, not just the highlighted words
- **Streaming responses** — answers appear token-by-token in a popover positioned right next to your selection
- **Right-click or hotkey** — access via the editor context menu ("Smart Explain") or assign a keyboard shortcut through Obsidian's hotkeys settings
- **Markdown rendering** — responses are rendered as full Obsidian markdown (bold, lists, code blocks, etc.)
- **Click outside to dismiss** — lightweight, non-intrusive UX
- **Secure key storage** — your API key is kept in Obsidian's encrypted keychain (Secret Storage), never in plaintext in the plugin's `data.json`

## Installation

### Manual

1. Download the latest release (`main.js`, `manifest.json`, `styles.css`) from the [Releases](https://github.com/tooape/Smart-Explain/releases) page.
2. Create a folder called `smart-explain` inside your vault's `.obsidian/plugins/` directory.
3. Copy the three files into that folder.
4. In Obsidian, go to **Settings → Community plugins** and enable **Smart Explain**.

### Build from source

```bash
git clone git@github.com:tooape/Smart-Explain.git
cd Smart-Explain
npm install
npm run build
```

Then copy `main.js`, `manifest.json`, and `styles.css` into your vault's `.obsidian/plugins/smart-explain/` directory.

## Setup

1. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Open **Settings → Smart Explain** and paste your API key into the **Gemini API Key** field.

That's it — the field writes your key directly into Obsidian's keychain.

### Where your key is stored

Smart Explain uses Obsidian's built-in [Secret Storage](https://docs.obsidian.md/plugins/guides/secret-storage) (added in Obsidian 1.11.4), the same store surfaced under **Settings → Keychain**. The key is encrypted at rest via the OS keychain and is **never** written to the plugin's `data.json`, so it won't end up in plaintext in a synced or backed-up file. It's kept under a **plugin-scoped entry** (`smart-explain-gemini-key`) so it can't collide with — or be read by — other plugins that use the shared keychain namespace.

A few consequences worth knowing:

- **Keys are per-device and do not sync.** Secret Storage is local to each device and vault. Set your API key once on each desktop where you use the plugin.
- **Desktop only.** Secret Storage requires the OS keychain, which is unavailable on mobile (iOS/Android). On mobile the settings tab shows a notice instead of a key field; configure the key on a desktop device.
- **Upgrading from an older version?** Smart Explain migrates your key into the plugin-scoped entry automatically on first load — from a plaintext `data.json` key, or from the earlier vault-shared `gemini-api-key` entry — after verifying the write succeeded, then removes any plaintext copy. To rotate the key afterward, just paste a new one into the settings field.
- **Removing the key.** The Secret Storage API can set but not delete entries, so the plugin can't remove the old shared `gemini-api-key` entry left behind by an upgrade. To delete that (or any) stored key, use **Settings → Keychain** in Obsidian.

## Usage

1. Select any text in a note.
2. Either:
   - **Right-click** and choose **Smart Explain**, or
   - Open the command palette (`Ctrl/Cmd + P`) and run **Smart Explain Selection**
3. A popover appears near your selection with a streamed explanation.
4. Click anywhere outside the popover to dismiss it.

## How It Works

Smart Explain sends more than just your highlighted text to the LLM. It builds a context object that includes:

| Signal | Purpose |
|---|---|
| **Selected text** | The passage to explain |
| **Note title** | Tells the model what document you're in |
| **Heading path** | The full `H1 > H2 > H3` hierarchy above the selection |
| **Surrounding text** | ~100 characters before and after the selection |

This context helps the model produce explanations that are relevant to *your* notes rather than generic definitions.

## Architecture

```
src/
├── main.ts              # Plugin lifecycle, context menu & command registration
├── GeminiClient.ts      # Gemini API wrapper (streaming + non-streaming)
├── ExplainModal.ts      # Positioned popover with live markdown rendering
├── ContextExtractor.ts  # Extracts heading path, surrounding text, note title
└── SettingsTab.ts       # Settings UI; reads/writes the API key via Obsidian's keychain
```

## License

[MIT](https://opensource.org/licenses/MIT)
