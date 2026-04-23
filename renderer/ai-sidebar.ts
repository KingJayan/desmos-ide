import { createIcons, Plus, Trash2, SlidersHorizontal } from 'lucide';

type ConvMessage = { role: 'user' | 'assistant'; content: string };
type ApplyAction = { type: 'insert' | 'replace'; code: string };
type Chat = { id: string; title: string; history: ConvMessage[] };

type AIProvider = 'openai-compatible' | 'openrouter' | 'ollama';

type ProviderConfig = {
  model: string;
  baseUrl: string;
  apiKey: string;
};

type ProviderConfigMap = Record<AIProvider, ProviderConfig>;

const PROVIDERS: Array<{ id: AIProvider; label: string }> = [
  { id: 'openai-compatible', label: 'OpenAI-compatible' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'ollama', label: 'Ollama' },
];

const PROVIDER_DEFAULTS: ProviderConfigMap = {
  'openai-compatible': {
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
  },
  openrouter: {
    model: 'openai/gpt-4o-mini',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
  },
  ollama: {
    model: 'llama3.2',
    baseUrl: 'http://127.0.0.1:11434/v1',
    apiKey: '',
  },
};

const MAX_HISTORY        = 20;
const MAX_CHATS          = 10;
const MAX_CHAT_BYTES     = 40_000;
const CONTEXT_CHAR_LIMIT = 1_500;
const PRUNE_THRESHOLD    = 18;

const SLASH_COMMANDS = [
  { cmd: '/help',         desc: 'Show all available commands',       arg: '' },
  { cmd: '/clear',        desc: 'Clear chat history',                arg: '' },
  { cmd: '/compact',      desc: 'Summarize & compress conversation', arg: '' },
  { cmd: '/memory add',   desc: 'Save a fact to memory',             arg: '<fact>' },
  { cmd: '/memory list',  desc: 'List saved memories',               arg: '' },
  { cmd: '/memory clear', desc: 'Clear all memories',                arg: '' },
];

export class AISidebar {
  private chats: Chat[] = [];
  private activeChat!: Chat;
  private provider: AIProvider;
  private providerConfigs: ProviderConfigMap;
  private memories: string[] = [];
  private sendContext: boolean;
  private streaming = false;
  private streamMap = new Map<string, { chat: Chat; accum: string; textEl: HTMLElement | null; bubble: HTMLElement | null }>();

  private onApply: (action: ApplyAction) => void;
  private getContext: () => { dsl: string; selection: string };

  private el: HTMLElement;
  private messagesEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private chatSelectEl!: HTMLSelectElement;
  private providerEl!: HTMLSelectElement;
  private providerLabelEl!: HTMLElement;
  private providerStateEl!: HTMLElement;
  private configBtnEl!: HTMLButtonElement;
  private configEl!: HTMLElement;
  private cfgModelEl!: HTMLInputElement;
  private cfgBaseUrlEl!: HTMLInputElement;
  private cfgApiKeyEl!: HTMLInputElement;
  private cfgSaveEl!: HTMLButtonElement;
  private acEl!: HTMLElement;
  private acIndex = -1;
  private acItems: typeof SLASH_COMMANDS = [];

  constructor(
    container: HTMLElement,
    getContext: () => { dsl: string; selection: string },
    onApply: (action: ApplyAction) => void,
  ) {
    this.getContext = getContext;
    this.onApply = onApply;
    this.el = container;
    this.provider = this.loadProvider();
    this.providerConfigs = this.loadProviderConfigs();
    this.sendContext = localStorage.getItem('ai-send-context') !== 'false';
    this.loadState();
    this.render();
    this.registerIpc();
    this.renderMessages();
  }

  private loadProvider(): AIProvider {
    const v = localStorage.getItem('ai-provider');
    if (v === 'openai-compatible' || v === 'openrouter' || v === 'ollama') return v;
    return 'openai-compatible';
  }

  private loadProviderConfigs(): ProviderConfigMap {
    const fallback: ProviderConfigMap = {
      'openai-compatible': { ...PROVIDER_DEFAULTS['openai-compatible'] },
      openrouter: { ...PROVIDER_DEFAULTS.openrouter },
      ollama: { ...PROVIDER_DEFAULTS.ollama },
    };
    try {
      const raw = localStorage.getItem('ai-provider-configs');
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<Record<AIProvider, Partial<ProviderConfig>>>;
      for (const p of PROVIDERS) {
        const entry = parsed[p.id] || {};
        fallback[p.id] = {
          model: typeof entry.model === 'string' && entry.model.trim() ? entry.model.trim() : fallback[p.id].model,
          baseUrl: typeof entry.baseUrl === 'string' && entry.baseUrl.trim() ? entry.baseUrl.trim() : fallback[p.id].baseUrl,
          apiKey: typeof entry.apiKey === 'string' ? entry.apiKey : fallback[p.id].apiKey,
        };
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  private saveProviderConfigs(): void {
    localStorage.setItem('ai-provider', this.provider);
    localStorage.setItem('ai-provider-configs', JSON.stringify(this.providerConfigs));
  }

  private getProviderConfig(provider = this.provider): ProviderConfig {
    return this.providerConfigs[provider] || { ...PROVIDER_DEFAULTS[provider] };
  }

  private getAiConfig(): { provider: AIProvider; model: string; baseUrl: string; apiKey: string } {
    const cfg = this.getProviderConfig();
    return {
      provider: this.provider,
      model: cfg.model.trim(),
      baseUrl: cfg.baseUrl.trim(),
      apiKey: cfg.apiKey,
    };
  }

  private newChat(): Chat {
    return { id: Date.now().toString(36), title: 'New Chat', history: [] };
  }

  private loadState(): void {
    try {
      this.chats = JSON.parse(localStorage.getItem('ai-chats') || '[]');
      this.memories = JSON.parse(localStorage.getItem('ai-memories') || '[]');
    } catch { this.chats = []; this.memories = []; }
    if (!this.chats.length) this.chats.push(this.newChat());
    this.activeChat = this.chats[this.chats.length - 1];
  }

  private saveState(): void {
    if (this.chats.length > MAX_CHATS) {
      const dropped = this.chats.splice(0, this.chats.length - MAX_CHATS);
      if (dropped.includes(this.activeChat)) this.activeChat = this.chats[0];
      this.syncChatSelect();
    }
    for (const chat of this.chats) {
      while (chat.history.length > 2 && JSON.stringify(chat.history).length > MAX_CHAT_BYTES) {
        chat.history.splice(0, 2);
      }
    }
    localStorage.setItem('ai-chats', JSON.stringify(this.chats));
    localStorage.setItem('ai-memories', JSON.stringify(this.memories));
  }

  private buildUserContent(prompt: string): string {
    if (!this.sendContext) return prompt;
    const { dsl, selection } = this.getContext();
    const src = selection || dsl;
    if (!src) return prompt;
    const label = selection ? 'Selected code' : 'Current file';
    const truncated = src.length > CONTEXT_CHAR_LIMIT
      ? src.slice(0, CONTEXT_CHAR_LIMIT) + '\n…[truncated]'
      : src;
    return `${prompt}\n\n${label}:\n\`\`\`dsmx\n${truncated}\n\`\`\``;
  }

  private pruneHistory(): void {
    const h = this.activeChat.history;
    if (h.length >= PRUNE_THRESHOLD) {
      this.activeChat.history = h.slice(-(PRUNE_THRESHOLD - 4));
      this.appendSystemMsg('Older turns pruned to fit context window. Use /compact for AI summarization.');
    }
  }

  private render(): void {
    this.el.innerHTML = `
      <div class="ai-header">
        <select class="ai-chat-select"></select>
        <button class="ai-icon-btn" id="ai-new-btn" title="New Chat" aria-label="New Chat"><i data-lucide="plus" aria-hidden="true"></i></button>
        <button class="ai-icon-btn ai-icon-btn--danger" id="ai-del-btn" title="Delete/Clear Chat" aria-label="Delete or Clear Chat"><i data-lucide="trash-2" aria-hidden="true"></i></button>
      </div>
      <div class="ai-messages"></div>
      <div class="ai-compose">
        <div class="ai-autocomplete"></div>
        <div class="ai-compose-wrap">
          <textarea class="ai-input" rows="1" placeholder="Ask about your DSL…"></textarea>
          <div class="ai-compose-bar">
            <div class="ai-compose-bar-left">
              <button class="ai-ctx-btn${this.sendContext ? ' ai-ctx-btn--on' : ''}" id="ai-ctx-btn" title="Send code context with each message. Toggle off to protect sensitive code.">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>ctx</span>
              </button>
              <select class="ai-provider-select">
                ${PROVIDERS.map(p => `<option value="${p.id}"${p.id === this.provider ? ' selected' : ''}>${p.label}</option>`).join('')}
              </select>
              <span class="ai-provider-label"></span>
              <span class="ai-provider-state"></span>
              <button class="ai-config-btn" id="ai-config-btn" title="Provider settings" aria-label="Provider settings"><i data-lucide="sliders-horizontal" aria-hidden="true"></i></button>
              <span class="ai-memory-badge"></span>
            </div>
            <button class="ai-send-btn" title="Send (Enter)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
        <div class="ai-config-popover" hidden>
          <div class="ai-config-title">provider config</div>
          <label class="ai-config-row">
            <span>model</span>
            <input class="ai-config-input ai-config-model" type="text" spellcheck="false" />
          </label>
          <label class="ai-config-row">
            <span>base url</span>
            <input class="ai-config-input ai-config-baseurl" type="text" spellcheck="false" />
          </label>
          <label class="ai-config-row">
            <span>api key</span>
            <input class="ai-config-input ai-config-key" type="password" spellcheck="false" />
          </label>
          <button class="ai-config-save" type="button">save</button>
        </div>
      </div>
    `;

    this.messagesEl   = this.el.querySelector('.ai-messages')!;
    this.inputEl      = this.el.querySelector('.ai-input')!;
    this.sendBtn      = this.el.querySelector('.ai-send-btn')!;
    this.chatSelectEl = this.el.querySelector('.ai-chat-select')!;
    this.providerEl = this.el.querySelector('.ai-provider-select')!;
    this.providerLabelEl = this.el.querySelector('.ai-provider-label')!;
    this.providerStateEl = this.el.querySelector('.ai-provider-state')!;
    this.configBtnEl = this.el.querySelector('#ai-config-btn')!;
    this.configEl = this.el.querySelector('.ai-config-popover')!;
    this.cfgModelEl = this.el.querySelector('.ai-config-model')!;
    this.cfgBaseUrlEl = this.el.querySelector('.ai-config-baseurl')!;
    this.cfgApiKeyEl = this.el.querySelector('.ai-config-key')!;
    this.cfgSaveEl = this.el.querySelector('.ai-config-save')!;
    this.acEl         = this.el.querySelector('.ai-autocomplete')!;
    const ctxBtn      = this.el.querySelector('#ai-ctx-btn') as HTMLButtonElement;

    createIcons({
      icons: { Plus, Trash2, SlidersHorizontal },
      attrs: { 'stroke-width': '2' },
    });

    this.syncChatSelect();
    this.syncMemoryBadge();
    this.syncProviderUi();

    this.sendBtn.addEventListener('click', () => this.submit());
    this.inputEl.addEventListener('input', () => { this.autoResize(); this.updateAc(); });
    this.inputEl.addEventListener('keydown', e => {
      if (this.acItems.length) {
        if (e.key === 'ArrowUp')   { e.preventDefault(); this.moveAc(-1); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); this.moveAc(1);  return; }
        if (e.key === 'Tab' || (e.key === 'Enter' && this.acIndex >= 0)) {
          e.preventDefault();
          this.applyAc(this.acIndex >= 0 ? this.acIndex : 0);
          return;
        }
        if (e.key === 'Escape') { this.hideAc(); return; }
      }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.submit(); }
    });

    this.el.querySelector('#ai-new-btn')!.addEventListener('click', () => {
      const chat = this.newChat();
      this.chats.push(chat);
      this.activeChat = chat;
      this.saveState();
      this.syncChatSelect();
      this.renderMessages();
    });

    this.el.querySelector('#ai-del-btn')!.addEventListener('click', () => {
      if (this.streaming) return;
      if (this.chats.length === 1) {
        this.activeChat.history = [];
        this.activeChat.title = 'New Chat';
        this.saveState();
        this.syncChatSelect();
        this.renderMessages();
        return;
      }
      const idx = this.chats.indexOf(this.activeChat);
      this.chats.splice(idx, 1);
      this.activeChat = this.chats[Math.max(0, idx - 1)];
      this.saveState();
      this.syncChatSelect();
      this.renderMessages();
    });

    this.chatSelectEl.addEventListener('change', () => {
      if (this.streaming) { this.syncChatSelect(); return; }
      const chat = this.chats.find(c => c.id === this.chatSelectEl.value);
      if (chat) { this.activeChat = chat; this.renderMessages(); }
    });

    this.providerEl.addEventListener('change', () => {
      const next = this.providerEl.value as AIProvider;
      if (next === 'openai-compatible' || next === 'openrouter' || next === 'ollama') {
        this.provider = next;
        this.saveProviderConfigs();
        this.syncProviderUi();
      }
    });

    this.configBtnEl.addEventListener('click', e => {
      e.stopPropagation();
      if (this.configEl.hidden) {
        this.syncConfigFields();
        this.configEl.hidden = false;
      } else {
        this.configEl.hidden = true;
      }
    });

    this.cfgSaveEl.addEventListener('click', () => {
      const current = this.getProviderConfig();
      this.providerConfigs[this.provider] = {
        model: this.cfgModelEl.value.trim() || current.model,
        baseUrl: this.cfgBaseUrlEl.value.trim() || current.baseUrl,
        apiKey: this.cfgApiKeyEl.value.trim(),
      };
      this.saveProviderConfigs();
      this.syncProviderUi();
      this.configEl.hidden = true;
      this.appendSystemMsg('Provider config saved.');
    });

    this.configEl.addEventListener('click', e => e.stopPropagation());
    this.el.addEventListener('click', () => {
      this.configEl.hidden = true;
    });

    ctxBtn.addEventListener('click', () => {
      this.sendContext = !this.sendContext;
      localStorage.setItem('ai-send-context', String(this.sendContext));
      ctxBtn.classList.toggle('ai-ctx-btn--on', this.sendContext);
      ctxBtn.title = this.sendContext
        ? 'Code context ON — toggle off to protect sensitive code.'
        : 'Code context OFF — AI will not see your file.';
    });
  }

  private syncChatSelect(): void {
    this.chatSelectEl.innerHTML = this.chats
      .map(c => `<option value="${c.id}"${c.id === this.activeChat.id ? ' selected' : ''}>${escapeHtml(c.title)}</option>`)
      .join('');
  }

  private updateAc(): void {
    const val = this.inputEl.value;
    if (!val.startsWith('/')) { this.hideAc(); return; }
    this.acItems = SLASH_COMMANDS.filter(c => c.cmd.startsWith(val.trimEnd()));
    if (!this.acItems.length) { this.hideAc(); return; }
    this.acIndex = -1;
    this.acEl.innerHTML = this.acItems
      .map((c, i) => `<div class="ai-ac-item" data-i="${i}"><span class="ai-ac-cmd">${escapeHtml(c.cmd)}</span>${c.arg ? `<span class="ai-ac-arg"> ${escapeHtml(c.arg)}</span>` : ''}<span class="ai-ac-desc">${escapeHtml(c.desc)}</span></div>`)
      .join('');
    this.acEl.classList.add('ai-autocomplete--open');
    this.acEl.querySelectorAll('.ai-ac-item').forEach((el, i) => {
      el.addEventListener('mousedown', e => { e.preventDefault(); this.applyAc(i); });
    });
  }

  private moveAc(dir: number): void {
    this.acIndex = Math.max(-1, Math.min(this.acItems.length - 1, this.acIndex + dir));
    this.acEl.querySelectorAll('.ai-ac-item').forEach((el, i) =>
      el.classList.toggle('ai-ac-item--active', i === this.acIndex));
  }

  private applyAc(i: number): void {
    const item = this.acItems[i];
    if (!item) return;
    this.inputEl.value = item.arg ? `${item.cmd} ` : item.cmd;
    this.hideAc();
    this.inputEl.focus();
  }

  private hideAc(): void {
    this.acItems = [];
    this.acIndex = -1;
    this.acEl.innerHTML = '';
    this.acEl.classList.remove('ai-autocomplete--open');
  }

  private syncMemoryBadge(): void {
    const el = this.el.querySelector('.ai-memory-badge') as HTMLElement;
    if (el) el.textContent = this.memories.length ? `${this.memories.length} mem` : '';
  }

  private syncProviderUi(): void {
    const cfg = this.getProviderConfig();
    const p = PROVIDERS.find(x => x.id === this.provider);
    this.providerEl.value = this.provider;
    this.providerLabelEl.textContent = cfg.model;
    this.providerLabelEl.title = cfg.model;
    this.providerStateEl.textContent = cfg.apiKey.trim() ? 'key' : 'env';
    this.providerStateEl.classList.toggle('ai-provider-state--key', !!cfg.apiKey.trim());
    this.providerStateEl.classList.toggle('ai-provider-state--env', !cfg.apiKey.trim());
    this.configBtnEl.title = `${p?.label || this.provider} settings`;
  }

  private syncConfigFields(): void {
    const cfg = this.getProviderConfig();
    this.cfgModelEl.value = cfg.model;
    this.cfgBaseUrlEl.value = cfg.baseUrl;
    this.cfgApiKeyEl.value = cfg.apiKey;
  }

  private renderMessages(): void {
    this.messagesEl.innerHTML = '';
    if (!this.activeChat.history.length) { this.appendWelcome(); return; }
    for (const msg of this.activeChat.history) {
      if (msg.role === 'user') {
        this.appendUserBubble(msg.content, false);
      } else {
        const row = document.createElement('div');
        row.className = 'ai-msg ai-msg--assistant';
        const bubble = document.createElement('div');
        bubble.className = 'ai-bubble';
        this.renderAssistantContent(bubble, msg.content);
        row.appendChild(bubble);
        this.messagesEl.appendChild(row);
      }
    }
    this.scrollToBottom();
  }

  private appendWelcome(): void {
    const el = document.createElement('div');
    el.className = 'ai-empty-state';
    el.innerHTML = `
      <svg class="ai-empty-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="2.5" opacity="0.3"/>
        <path d="M20 32 Q26 20 32 32 Q38 44 44 32" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <circle cx="20" cy="32" r="2.5" fill="currentColor" opacity="0.6"/>
        <circle cx="44" cy="32" r="2.5" fill="currentColor" opacity="0.6"/>
      </svg>
      <p class="ai-empty-hint">Type <kbd>/help</kbd> to see all commands</p>
    `;
    this.messagesEl.appendChild(el);
  }

  private submit(): void {
    const text = this.inputEl.value.trim();
    if (!text || this.streaming) return;
    this.inputEl.value = '';
    this.inputEl.style.height = 'auto';
    if (text.startsWith('/')) { this.handleCommand(text); return; }
    this.send(text);
  }

  private handleCommand(cmd: string): void {
    const parts = cmd.split(' ');
    const name = parts[0].toLowerCase();

    if (name === '/help') {
      const lines = SLASH_COMMANDS.map(c => `${c.cmd}${c.arg ? ' ' + c.arg : ''}  —  ${c.desc}`).join('\n');
      this.appendSystemMsg(lines);
      return;
    }

    if (name === '/clear') {
      this.activeChat.history = [];
      this.activeChat.title = 'New Chat';
      this.saveState();
      this.syncChatSelect();
      this.renderMessages();
      return;
    }

    if (name === '/compact') {
      this.compact();
      return;
    }

    if (name === '/memory') {
      const sub = parts[1]?.toLowerCase();
      if (sub === 'add') {
        const fact = parts.slice(2).join(' ').trim();
        if (fact) {
          this.memories.push(fact);
          this.saveState();
          this.syncMemoryBadge();
          this.appendSystemMsg(`Memory saved: "${fact}"`);
        } else {
          this.appendSystemMsg('Usage: /memory add <fact>');
        }
      } else if (sub === 'list') {
        this.appendSystemMsg(
          this.memories.length
            ? this.memories.map((m, i) => `${i + 1}. ${m}`).join('\n')
            : 'No memories saved.',
        );
      } else if (sub === 'clear') {
        this.memories = [];
        this.saveState();
        this.syncMemoryBadge();
        this.appendSystemMsg('Memories cleared.');
      } else {
        this.appendSystemMsg('Usage: /memory add <fact> | /memory list | /memory clear');
      }
      return;
    }

    this.appendSystemMsg(`Unknown command: ${escapeHtml(cmd)}`);
  }

  private appendSystemMsg(text: string): void {
    const el = document.createElement('div');
    el.className = 'ai-msg ai-msg--system';
    el.innerHTML = `<div class="ai-bubble ai-bubble--system"><p>${escapeHtml(text)}</p></div>`;
    this.messagesEl.appendChild(el);
    this.scrollToBottom();
  }

  private async compact(): Promise<void> {
    if (!this.activeChat.history.length) { this.appendSystemMsg('Nothing to compact.'); return; }
    this.setLoading(true);
    this.appendSystemMsg('Compacting conversation…');
    try {
      const summary = await window.electronAPI?.aiCompact(this.activeChat.history, this.getAiConfig(), this.memories);
      if (summary) {
        this.activeChat.history = [{ role: 'assistant', content: `[Summary]\n${summary}` }];
        this.saveState();
        this.renderMessages();
        this.appendSystemMsg('Conversation compacted.');
      }
    } catch (e) {
      this.appendSystemMsg(`Compact failed: ${e}`);
    } finally {
      this.setLoading(false);
    }
  }

  private setLoading(on: boolean): void {
    this.streaming = on;
    this.sendBtn.disabled = on;
    this.inputEl.disabled = on;
  }

  async send(prompt: string): Promise<void> {
    this.pruneHistory();

    const userContent = this.buildUserContent(prompt);

    this.activeChat.history.push({ role: 'user', content: userContent });
    if (this.activeChat.title === 'New Chat' && this.activeChat.history.length === 1) {
      this.activeChat.title = prompt.slice(0, 40);
      this.syncChatSelect();
    }
    this.saveState();
    this.appendUserBubble(prompt, true);

    const reqId = Math.random().toString(36).slice(2);
    this.setLoading(true);

    const { bubble, textEl } = this.appendAssistantBubble();
    this.streamMap.set(reqId, { chat: this.activeChat, accum: '', textEl, bubble });

    window.electronAPI?.aiChat(reqId, this.activeChat.history.slice(-MAX_HISTORY), this.getAiConfig(), this.memories);
  }

  private registerIpc(): void {
    window.electronAPI?.onAiChunk((reqId, text) => {
      const s = this.streamMap.get(reqId);
      if (!s) return;
      s.accum += text;
      if (s.textEl) s.textEl.textContent = s.accum;
      this.scrollToBottom();
    });

    window.electronAPI?.onAiDone((reqId) => {
      const s = this.streamMap.get(reqId);
      if (!s) return;
      const full = s.accum;
      this.streamMap.delete(reqId);
      s.chat.history.push({ role: 'assistant', content: full });
      this.saveState();
      if (s.bubble) this.renderAssistantContent(s.bubble, full);
      this.setLoading(false);
      this.scrollToBottom();
    });

    window.electronAPI?.onAiError((reqId, error) => {
      const s = this.streamMap.get(reqId);
      if (!s) return;
      this.streamMap.delete(reqId);
      if (s.textEl) {
        s.textEl.textContent = `Error: ${error}`;
        s.textEl.classList.add('ai-error-text');
      }
      this.setLoading(false);
    });
  }

  private appendUserBubble(text: string, scroll: boolean): void {
    const el = document.createElement('div');
    el.className = 'ai-msg ai-msg--user';
    el.innerHTML = `<div class="ai-bubble"><p>${escapeHtml(text)}</p></div>`;
    this.messagesEl.appendChild(el);
    if (scroll) this.scrollToBottom();
  }

  private appendAssistantBubble(): { bubble: HTMLElement; textEl: HTMLElement } {
    const msg = document.createElement('div');
    msg.className = 'ai-msg ai-msg--assistant';
    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble ai-bubble--streaming';
    const textEl = document.createElement('p');
    textEl.className = 'ai-stream-text';
    bubble.appendChild(textEl);
    msg.appendChild(bubble);
    this.messagesEl.appendChild(msg);
    this.scrollToBottom();
    return { bubble, textEl };
  }

  private renderAssistantContent(bubble: HTMLElement, full: string): void {
    bubble.classList.remove('ai-bubble--streaming');
    bubble.innerHTML = '';
    for (const part of parseResponse(full)) {
      if (part.type === 'text') {
        const p = document.createElement('p');
        p.textContent = part.content;
        bubble.appendChild(p);
      } else {
        bubble.appendChild(this.buildCodeBlock(part.content));
      }
    }
  }

  private buildCodeBlock(code: string): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'ai-code-block';
    const pre = document.createElement('pre');
    const codeEl = document.createElement('code');
    codeEl.textContent = code;
    pre.appendChild(codeEl);
    wrap.appendChild(pre);

    const actions = document.createElement('div');
    actions.className = 'ai-code-actions';

    const insertBtn = document.createElement('button');
    insertBtn.className = 'ai-action-btn ai-action-btn--insert';
    insertBtn.textContent = 'Insert';
    insertBtn.addEventListener('click', () => { this.onApply({ type: 'insert', code }); this.flashAccepted(insertBtn); });

    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'ai-action-btn ai-action-btn--replace';
    replaceBtn.textContent = 'Replace';
    replaceBtn.addEventListener('click', () => { this.onApply({ type: 'replace', code }); this.flashAccepted(replaceBtn); });

    const denyBtn = document.createElement('button');
    denyBtn.className = 'ai-action-btn ai-action-btn--deny';
    denyBtn.textContent = 'Dismiss';
    denyBtn.addEventListener('click', () => { actions.innerHTML = '<span class="ai-dismissed">Dismissed</span>'; });

    actions.appendChild(insertBtn);
    actions.appendChild(replaceBtn);
    actions.appendChild(denyBtn);
    wrap.appendChild(actions);
    return wrap;
  }

  private flashAccepted(btn: HTMLButtonElement): void {
    const orig = btn.textContent;
    btn.textContent = 'Applied!';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1500);
  }

  private autoResize(): void {
    this.inputEl.style.height = 'auto';
    this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 120) + 'px';
  }

  private scrollToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  focus(): void { this.inputEl.focus(); }
}

type Part = { type: 'text'; content: string } | { type: 'code'; content: string };

function parseResponse(text: string): Part[] {
  const parts: Part[] = [];
  const re = /```(?:dsmx)?\n?([\s\S]*?)```/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(last, m.index).trim();
    if (before) parts.push({ type: 'text', content: before });
    parts.push({ type: 'code', content: m[1].trim() });
    last = m.index + m[0].length;
  }
  const after = text.slice(last).trim();
  if (after) parts.push({ type: 'text', content: after });
  return parts;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
