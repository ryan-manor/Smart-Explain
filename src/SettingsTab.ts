import { App, PluginSettingTab, Setting } from 'obsidian';
import type SmartExplainPlugin from './main';

// Plugin-scoped secret ID in Obsidian's keychain. Must be lowercase
// alphanumeric with optional dashes. Scoped to this plugin so it can't collide
// with (or be read by) other plugins sharing the keychain namespace.
export const SECRET_ID = 'smart-explain-gemini-key';

// Previous, vault-shared ID. Read once during migration so existing installs
// don't appear to lose their key when upgrading to the scoped ID.
export const LEGACY_SHARED_SECRET_ID = 'gemini-api-key';

export interface SmartExplainSettings {
  // Legacy plaintext key. Retained ONLY so loadSettings() can migrate it into
  // Obsidian's secret storage and then delete it. Never read this directly —
  // call plugin.getApiKey() instead.
  apiKey?: string;
}

export const DEFAULT_SETTINGS: SmartExplainSettings = {};

export class SmartExplainSettingsTab extends PluginSettingTab {
  plugin: SmartExplainPlugin;

  constructor(app: App, plugin: SmartExplainPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Smart Explain Settings' });

    // secretStorage is typed as always-present, but it is absent at runtime on
    // platforms without OS-backed secure storage (e.g. mobile).
    const secretStorage = this.app.secretStorage;

    if (!secretStorage) {
      new Setting(containerEl)
        .setName('Gemini API Key')
        .setDesc(
          'Secure key storage is only available on desktop. Open Smart Explain ' +
          'settings on a desktop device to set your key.'
        );
      return;
    }

    new Setting(containerEl)
      .setName('Gemini API Key')
      .setDesc(
        'Stored securely in Obsidian’s keychain, not in this plugin’s ' +
        'data file. Get a key at https://aistudio.google.com/apikey'
      )
      .addText(text => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder('Enter your API key')
          .setValue(secretStorage.getSecret(SECRET_ID) ?? '')
          .onChange((value) => {
            secretStorage.setSecret(SECRET_ID, value.trim());
          });
      });
  }
}
