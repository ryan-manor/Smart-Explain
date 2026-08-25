import { App, PluginSettingTab, Setting } from 'obsidian';
import type SmartExplainPlugin from './main';

// Plugin-scoped secret ID in Obsidian's keychain. Must be lowercase
// alphanumeric with optional dashes. Scoped to this plugin so it can't collide
// with (or be read by) other plugins sharing the keychain namespace.
export const SECRET_ID = 'smart-explain-gemini-key';

// Previous, vault-shared ID. Read once during migration so existing installs
// don't appear to lose their key when upgrading to the scoped ID.
export const LEGACY_SHARED_SECRET_ID = 'gemini-api-key';

// Stable, cheapest model that still supports MINIMAL thinking — the level
// GeminiClient requests. Swapping this for a model without `minimal` support
// (e.g. gemini-3.7-flash) makes the API reject the request.
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

export interface SmartExplainSettings {
  // Legacy plaintext key. Retained ONLY so loadSettings() can migrate it into
  // Obsidian's secret storage and then delete it. Never read this directly —
  // call plugin.getApiKey() instead.
  apiKey?: string;
  // Gemini model ID. May be blank while the user is mid-edit in settings —
  // read it through plugin.getModel(), which falls back to DEFAULT_MODEL.
  model: string;
}

export const DEFAULT_SETTINGS: SmartExplainSettings = {
  model: DEFAULT_MODEL,
};

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

    this.displayApiKeySetting();
    this.displayModelSetting();
  }

  private displayApiKeySetting(): void {
    // secretStorage is typed as always-present, but it is absent at runtime on
    // platforms without OS-backed secure storage (e.g. mobile).
    const secretStorage = this.app.secretStorage;

    if (!secretStorage) {
      new Setting(this.containerEl)
        .setName('Gemini API Key')
        .setDesc(
          'Secure key storage is only available on desktop. Open Smart Explain ' +
          'settings on a desktop device to set your key.'
        );
      return;
    }

    new Setting(this.containerEl)
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

  private displayModelSetting(): void {
    new Setting(this.containerEl)
      .setName('Model ID')
      .setDesc(
        `The Gemini model used for explanations and footnote summaries. ` +
        `Leave blank to use ${DEFAULT_MODEL}. Model IDs are listed at ` +
        `https://ai.google.dev/gemini-api/docs/models — pick one that supports ` +
        `the MINIMAL thinking level.`
      )
      .addText(text => {
        text
          .setPlaceholder(DEFAULT_MODEL)
          .setValue(this.plugin.settings.model ?? '')
          .onChange(async (value) => {
            // Store the raw trimmed value rather than coercing blanks to the
            // default — coercing mid-edit would fight the user as they clear
            // the field to retype. getModel() resolves the blank at call time.
            this.plugin.settings.model = value.trim();
            await this.plugin.saveSettings();
          });
      });
  }
}
