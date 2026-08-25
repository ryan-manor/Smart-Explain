import { App, Editor, Modal, MarkdownRenderer, MarkdownView, Component, Notice } from 'obsidian';
import { GeminiClient } from './GeminiClient';

function findNextFootnoteNumber(editorContent: string): number {
  const regex = /\[\^(\d+)\]/g;
  let max = 0;
  let match;
  while ((match = regex.exec(editorContent)) !== null) {
    const num = parseInt(match[1], 10);
    if (num > max) max = num;
  }
  return max + 1;
}

export class ExplainModal extends Modal {
  private content: string = '';
  private isLoading: boolean = true;
  private isStreaming: boolean = false;
  private error: string | null = null;
  private targetCoords: { x: number; y: number };
  private renderComponent: Component;
  private clickHandler: (e: MouseEvent) => void;
  private contentWrapper: HTMLElement | null = null;
  private scrollContainer: HTMLElement | null = null;
  private editor: Editor;
  private view: MarkdownView;
  private selectedText: string;
  private apiKey: string;
  private selectionEnd: { line: number; ch: number };
  private model: string;

  constructor(
    app: App,
    coords: { x: number; y: number },
    editor: Editor,
    view: MarkdownView,
    selectedText: string,
    apiKey: string,
    selectionEnd: { line: number; ch: number },
    model: string
  ) {
    super(app);
    this.targetCoords = coords;
    this.editor = editor;
    this.view = view;
    this.selectedText = selectedText;
    this.apiKey = apiKey;
    this.selectionEnd = selectionEnd;
    this.model = model;
    this.renderComponent = new Component();

    this.clickHandler = (e: MouseEvent) => {
      // Small delay to avoid closing immediately on the opening click
      setTimeout(() => {
        if (!this.containerEl.contains(e.target as Node)) {
          this.close();
        }
      }, 0);
    };
  }

  onOpen() {
    this.containerEl.addClass('smart-explain-modal');
    this.modalEl.addClass('smart-explain-modal-inner');

    // Position near the selection
    this.positionModal();

    // Render initial state
    this.render();

    // Register click-outside handler with delay
    setTimeout(() => {
      document.addEventListener('click', this.clickHandler);
    }, 100);

    this.renderComponent.load();
  }

  onClose() {
    document.removeEventListener('click', this.clickHandler);
    this.renderComponent.unload();
    this.contentEl.empty();
  }

  setLoading(loading: boolean) {
    this.isLoading = loading;
    this.render();
  }

  setContent(content: string) {
    this.content = content;
    this.isLoading = false;
    this.isStreaming = false;
    this.error = null;
    this.render();
  }

  startStreaming() {
    this.content = '';
    this.isLoading = true;  // Keep showing "Thinking..." until first chunk
    this.isStreaming = true;
    this.error = null;
    this.render();
  }

  appendChunk(chunk: string) {
    // On first chunk, switch from loading to content view
    if (this.isLoading) {
      this.isLoading = false;
      this.content = chunk;
      this.render();
    } else {
      this.content += chunk;
      this.rerenderContent();
    }
  }

  finishStreaming() {
    this.isStreaming = false;
    // Final re-render to remove any streaming indicators
    this.rerenderContent();
  }

  setError(error: string) {
    this.error = error;
    this.isLoading = false;
    this.isStreaming = false;
    this.render();
  }

  private positionModal() {
    const modalEl = this.modalEl;

    // Remove default centering
    modalEl.style.position = 'fixed';
    modalEl.style.margin = '0';

    // Position below the selection
    let top = this.targetCoords.y + 10;
    let left = this.targetCoords.x;

    // Ensure modal stays within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const modalWidth = 400; // Approximate width
    const modalHeight = 300; // Approximate max height

    // Adjust horizontal position
    if (left + modalWidth > viewportWidth - 20) {
      left = viewportWidth - modalWidth - 20;
    }
    if (left < 20) {
      left = 20;
    }

    // If not enough space below, show above
    if (top + modalHeight > viewportHeight - 20) {
      top = this.targetCoords.y - modalHeight - 10;
      if (top < 20) {
        top = 20;
      }
    }

    modalEl.style.top = `${top}px`;
    modalEl.style.left = `${left}px`;
    modalEl.style.transform = 'none';
  }

  private render() {
    const { contentEl } = this;
    contentEl.empty();

    if (this.isLoading) {
      const loadingEl = contentEl.createEl('div', { cls: 'smart-explain-loading' });
      loadingEl.createEl('div', { cls: 'smart-explain-spinner' });
      loadingEl.createEl('span', { text: 'Thinking...' });
      return;
    }

    if (this.error) {
      const errorEl = contentEl.createEl('div', { cls: 'smart-explain-error' });
      errorEl.createEl('span', { text: this.error });
      return;
    }

    // Create scrollable container
    const scrollContainer = contentEl.createEl('div', { cls: 'smart-explain-scroll-container' });
    this.scrollContainer = scrollContainer;
    this.contentWrapper = scrollContainer.createEl('div', { cls: 'smart-explain-content' });

    if (this.content) {
      MarkdownRenderer.render(
        this.app,
        this.content,
        this.contentWrapper,
        '',
        this.renderComponent
      );
    }

    this.renderFootnoteButton();
  }

  private renderFootnoteButton() {
    if (!this.scrollContainer) return;

    const existing = this.scrollContainer.querySelector('.smart-explain-actions');
    if (existing) existing.remove();

    if (!this.isLoading && !this.isStreaming && !this.error && this.content) {
      const actions = this.scrollContainer.createEl('div', { cls: 'smart-explain-actions' });
      const btn = actions.createEl('button', {
        cls: 'smart-explain-footnote-btn',
        text: 'Add as Footnote',
      });
      btn.addEventListener('click', () => this.addFootnote(btn));
    }
  }

  private async addFootnote(btn: HTMLButtonElement) {
    try {
      btn.disabled = true;
      btn.textContent = 'Adding...';

      const client = new GeminiClient(this.apiKey, this.model);
      const oneSentence = await client.summarize(this.content);

      const editorContent = this.editor.getValue();
      const footnoteNum = findNextFootnoteNumber(editorContent);
      const ref = `[^${footnoteNum}]`;

      // Append definition at end of file FIRST — inserting at the end
      // doesn't shift any positions above, keeping selectionEnd valid.
      // (Reversed order avoids CM6 transaction conflicts that silently
      // dropped the second replaceRange call.)
      const lastLine = this.editor.lastLine();
      const lastLineContent = this.editor.getLine(lastLine);
      const endPos = { line: lastLine, ch: lastLineContent.length };
      this.editor.replaceRange(`\n\n${ref}: ${oneSentence}`, endPos);

      // Insert inline reference at the stored selection end position
      this.editor.replaceRange(ref, this.selectionEnd);

      new Notice('Footnote added');
      this.close();
    } catch (error) {
      btn.disabled = false;
      btn.textContent = 'Add as Footnote';
      const message = error instanceof Error ? error.message : 'Failed to add footnote';
      new Notice(message);
    }
  }

  private rerenderContent() {
    if (!this.contentWrapper) return;

    // Clear and re-render markdown content
    this.contentWrapper.empty();

    if (this.content) {
      MarkdownRenderer.render(
        this.app,
        this.content,
        this.contentWrapper,
        '',
        this.renderComponent
      );
    }

    this.renderFootnoteButton();
  }
}
