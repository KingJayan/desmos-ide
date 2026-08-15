import { createIcons, ArrowDown, Plus } from 'lucide';
import { iconSvg } from './icons';

type ConvMessage = { role: 'user' | 'assistant'; content: string };
type ApplyAction = { type: 'insert' | 'replace'; code: string };
type Chat = { id: string; title: string; history: ConvMessage[] };

type AIProvider = 'openai-compatible' | 'openrouter' | 'ollama' | 'github-copilot';

const PROMPT_SUGGESTIONS = [
  'Explain what my file does',
  'Add a slider from 0 to 10',
  'Draw a unit circle',
  'What DSL syntax is available?',
  'What is the purpose of my code?',
  'Complete the missing functionality',
];

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
  { id: 'github-copilot', label: 'GitHub Copilot' },
];

const PROVIDER_DEFAULTS: ProviderConfigMap = {
  'openai-compatible': {
    model: 'gpt-5.3-mini',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
  },
  openrouter: {
    model: 'openai/gpt-5.3-mini',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
  },
  ollama: {
    model: 'llama3.3',
    baseUrl: 'http://127.0.0.1:11434/v1',
    apiKey: '',
  },
  'github-copilot': {
    model: 'gpt-5.3',
    baseUrl: 'https://api.githubcopilot.com',
    apiKey: '',
  },
};

const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  'openai-compatible': [
    'gpt-5.3', 'gpt-5.3-mini',
    'gpt-5.2', 'gpt-5.2-mini',
    'gpt-5.1',
    'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',

    'o3', 'o3-mini',
    'o4', 'o4-mini',
  ],

  openrouter: [
    'openai/gpt-5.3', 'openai/gpt-5.3-mini',
    'openai/gpt-5.2', 'openai/gpt-5.2-mini',
    'openai/gpt-4.1', 'openai/gpt-4.1-mini', 'openai/gpt-4.1-nano',
    'openai/o3', 'openai/o3-mini',
    'openai/o4', 'openai/o4-mini',

    'anthropic/claude-opus-4.1',
    'anthropic/claude-sonnet-4.5',
    'anthropic/claude-haiku-4.5',

    'google/gemini-2.5-pro',
    'google/gemini-2.5-flash',
    'google/gemini-2.0-flash',

    'meta-llama/llama-4',
    'meta-llama/llama-4-scout',
    'meta-llama/llama-3.3-70b-instruct',

    'mistralai/mistral-large',
    'mistralai/mistral-small',
    'mistralai/codestral',

    'deepseek/deepseek-r1',
    'deepseek/deepseek-v3',
    'deepseek/deepseek-coder-v2',

    'x-ai/grok-3',
    'x-ai/grok-3-mini',

    'cohere/command-r-plus',
    'cohere/command-r',

    'qwen/qwen-2.5-72b-instruct',
    'qwen/qwen-2.5-coder-32b-instruct',

    'microsoft/phi-4',
    'microsoft/phi-4-mini',
  ],

  ollama: [
    'llama3.3', 'llama3.2',

    'mistral', 'mixtral', 'mistral-nemo',

    'qwen2.5', 'qwen2.5-coder',

    'phi4', 'phi4-mini',

    'gemma3', 'gemma2',

    'deepseek-r1', 'deepseek-v3', 'deepseek-coder-v2',

    'codellama', 'codegemma', 'starcoder2',

    'nomic-embed-text', 'mxbai-embed-large',
  ],

  'github-copilot': [
    'gpt-4o', 'gpt-4o-mini',
    'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
    'o3-mini',
    'claude-3.5-sonnet', 'claude-3.7-sonnet',
    'gemini-2.0-flash',
  ],
};

const SCROLL_AWAY_RATIO  = 0.25;
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

interface CopilotAuthState {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  pollTimer: ReturnType<typeof setInterval> | null;
  interval: number;
}

// compute line-level diff for diff preview
type DiffLine = { op: '=' | '+' | '-'; line: string };
function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const result: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) {
      result.push({ op: '=', line: a[i] }); i++; j++;
    } else if (j < n && (i >= m || dp[i][j + 1] >= (i < m ? dp[i + 1][j] : 0))) {
      result.push({ op: '+', line: b[j] }); j++;
    } else {
      result.push({ op: '-', line: a[i] }); i++;
    }
  }
  return result;
}

export class AISidebar {
  private chats: Chat[] = [];
  private activeChat!: Chat;
  private provider: AIProvider;
  private providerConfigs: ProviderConfigMap;
  private memories: string[] = [];
  private sendContext: boolean;
  private autoApprove: boolean;
  private streaming = false;
  private streamMap = new Map<string, { chat: Chat; accum: string; textEl: HTMLElement | null; bubble: HTMLElement | null }>();
  private copilotAuth: CopilotAuthState | null = null;
  private copilotModels: string[] | null = null;
  private activeReqId: string | null = null;

  private onApply: (action: ApplyAction) => void;
  private getContext: () => { dsl: string; selection: string };

  private el: HTMLElement;
  private messagesEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private chatSelectEl!: HTMLSelectElement;
  private providerLabelEl!: HTMLElement;
  private providerStateEl!: HTMLElement;
  private configBtnEl!: HTMLButtonElement;
  private configEl!: HTMLElement;
  private cfgProviderEl!: HTMLSelectElement;
  private cfgModelEl!: HTMLSelectElement;
  private cfgBaseUrlEl!: HTMLInputElement;
  private cfgApiKeyEl!: HTMLInputElement;
  private cfgSaveEl!: HTMLButtonElement;
  private cfgCopilotEl!: HTMLElement;
  private scrollFabEl!: HTMLButtonElement;
  private scrollFabDotEl!: HTMLElement;
  private unread = false;
  private pendingTitles = new Map<string, string>();
  private acEl!: HTMLElement;
  private acIndex = -1;
  private acItems: typeof SLASH_COMMANDS = [];
  private autoApproveBtn!: HTMLButtonElement;
  private ctxPillEl!: HTMLElement;
  private ctxPillCloseBtn!: HTMLButtonElement;
  private contextDisabledForMsg = false;

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
    this.autoApprove = localStorage.getItem('ai-auto-approve') === 'true';
    this.loadState();
    this.render();
    this.registerIpc();
    this.renderMessages();
    const copilotToken = this.getProviderConfig('github-copilot').apiKey;
    if (copilotToken) this.fetchCopilotModels(copilotToken);
  }

  private loadProvider(): AIProvider {
    const v = localStorage.getItem('ai-provider');
    if (v === 'openai-compatible' || v === 'openrouter' || v === 'ollama' || v === 'github-copilot') return v;
    return 'openai-compatible';
  }

  private loadProviderConfigs(): ProviderConfigMap {
    const fallback: ProviderConfigMap = {
      'openai-compatible': { ...PROVIDER_DEFAULTS['openai-compatible'] },
      openrouter: { ...PROVIDER_DEFAULTS.openrouter },
      ollama: { ...PROVIDER_DEFAULTS.ollama },
      'github-copilot': { ...PROVIDER_DEFAULTS['github-copilot'] },
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
    if (!this.sendContext || this.contextDisabledForMsg) return prompt;
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
      <div class="ai-status-strip">
        <button class="ai-scroll-fab" type="button" title="Scroll to latest" aria-label="Scroll to latest" hidden>
          <i data-lucide="arrow-down" aria-hidden="true"></i>
          <span class="ai-scroll-fab-dot" hidden></span>
        </button>
        <div class="ai-status-left">
          <button class="ai-provider-chip" id="ai-provider-chip" title="Change the AI provider and model"><span class="ai-status-provider-label"></span></button>
          <button class="ai-status-model" title="Change model"></button>
          <span class="ai-status-memory"></span>
        </div>
        <div class="ai-status-right">
          <button class="ai-ctx-btn${this.sendContext ? ' ai-ctx-btn--on' : ''}" id="ai-ctx-btn" title="Send code context with each message. Toggle off to protect sensitive code.">
            ${iconSvg('file-text', { size: 12, strokeWidth: 2.5 })}
            <span>ctx</span>
          </button>
          <button class="ai-ctx-btn${this.autoApprove ? ' ai-ctx-btn--on' : ''}" id="ai-autoapprove-btn" title="${this.autoApprove ? 'Auto-approve ON — code applied without diff preview' : 'Auto-approve OFF — shows diff before applying'}">
            ${iconSvg('check', { size: 12, strokeWidth: 2.5 })}
            <span>auto</span>
          </button>
        </div>
      </div>
      <div class="ai-compose">
        <div class="ai-autocomplete"></div>
        <div class="ai-ctx-pill" hidden>
          <span class="ai-ctx-pill-text"></span>
          <button class="ai-ctx-pill-close" type="button" title="Disable context for this message">
            ${iconSvg('x', { size: 12, strokeWidth: 2.5 })}
          </button>
        </div>
        <div class="ai-compose-wrap">
          <textarea class="ai-input" rows="1" placeholder="Ask about your DSL…"></textarea>
          <div class="ai-compose-bar">
            <button class="ai-send-btn" title="Send (Enter)">
              ${iconSvg('send', { size: 14, strokeWidth: 2.5 })}
            </button>
          </div>
        </div>
        <div class="ai-config-popover" hidden>
          <label class="ai-config-row">
            <span>provider</span>
            <select class="ai-config-input ai-config-provider"></select>
          </label>
          <div class="ai-config-copilot" hidden>
            <div class="ai-copilot-row">
              <span class="ai-copilot-status"></span>
              <button class="ai-copilot-connect" type="button">Sign in</button>
              <button class="ai-copilot-cancel" type="button" hidden>Cancel</button>
              <button class="ai-copilot-disconnect" type="button" hidden>Disconnect</button>
            </div>
            <div class="ai-copilot-code-wrap" hidden>
              <p class="ai-copilot-instructions">Open <a class="ai-copilot-link" href="#" id="ai-copilot-verif-link">github.com/login/device</a> and enter:</p>
              <code class="ai-copilot-user-code"></code>
            </div>
          </div>
          <div class="ai-config-standard">
            <label class="ai-config-row">
              <span>model</span>
              <select class="ai-config-input ai-config-model"></select>
            </label>
            <label class="ai-config-row">
              <span>base url</span>
              <input class="ai-config-input ai-config-baseurl" type="text" spellcheck="false" />
            </label>
            <label class="ai-config-row">
              <span>api key</span>
              <input class="ai-config-input ai-config-key" type="password" spellcheck="false" />
            </label>
          </div>
          <button class="ai-config-save" type="button">save</button>
        </div>
      </div>
    `;

    this.messagesEl   = this.el.querySelector('.ai-messages')!;
    this.inputEl      = this.el.querySelector('.ai-input')!;
    this.sendBtn      = this.el.querySelector('.ai-send-btn')!;
    this.chatSelectEl = this.el.querySelector('.ai-chat-select')!;
    this.configBtnEl = this.el.querySelector('#ai-provider-chip')!;
    this.providerLabelEl = this.el.querySelector('.ai-status-provider-label')!;
    this.providerStateEl = this.el.querySelector('.ai-status-model')!;
    this.configEl = this.el.querySelector('.ai-config-popover')!;
    this.cfgProviderEl = this.el.querySelector('.ai-config-provider')!;
    this.cfgModelEl = this.el.querySelector('.ai-config-model')!;
    this.cfgBaseUrlEl = this.el.querySelector('.ai-config-baseurl')!;
    this.cfgApiKeyEl = this.el.querySelector('.ai-config-key')!;
    this.cfgSaveEl = this.el.querySelector('.ai-config-save')!;
    this.cfgCopilotEl = this.el.querySelector('.ai-config-copilot')!;
    this.scrollFabEl  = this.el.querySelector('.ai-scroll-fab')!;
    this.scrollFabDotEl = this.el.querySelector('.ai-scroll-fab-dot')!;
    this.acEl         = this.el.querySelector('.ai-autocomplete')!;
    this.autoApproveBtn = this.el.querySelector('#ai-autoapprove-btn') as HTMLButtonElement;
    this.ctxPillEl = this.el.querySelector('.ai-ctx-pill')!;
    this.ctxPillCloseBtn = this.el.querySelector('.ai-ctx-pill-close')!;
    const ctxBtn      = this.el.querySelector('#ai-ctx-btn') as HTMLButtonElement;

    createIcons({
      icons: { ArrowDown, Plus },
      attrs: { 'stroke-width': '2' },
    });

    this.syncChatSelect();
    this.syncMemoryBadge();
    this.syncProviderUi();

    this.sendBtn.addEventListener('click', () => {
      if (this.streaming && this.activeReqId) {
        this.stopGeneration();
      } else {
        this.submit();
      }
    });
    this.inputEl.addEventListener('input', () => { this.autoResize(); this.updateAc(); this.updateCtxPill(); });
    this.inputEl.addEventListener('focus', () => { this.updateCtxPill(); });
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
        this.pendingTitles.delete(this.activeChat.id);
        this.saveState();
        this.syncChatSelect();
        this.renderMessages();
        return;
      }
      const idx = this.chats.indexOf(this.activeChat);
      this.pendingTitles.delete(this.activeChat.id);
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

    this.configBtnEl.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      if (this.configEl.hidden) {
        this.syncConfigFields();
        this.configEl.hidden = false;
      } else {
        this.configEl.hidden = true;
      }
    });
    this.providerStateEl.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      const cfg = this.getProviderConfig();
      const standard = this.configEl.querySelector('.ai-config-standard') as HTMLElement;
      this.cfgCopilotEl.hidden = true;
      standard.hidden = false;
      this.cfgSaveEl.hidden = false;
      this.populateProviderSelect();
      this.populateModelSelect(this.provider, cfg.model);
      this.cfgBaseUrlEl.value = cfg.baseUrl;
      this.cfgApiKeyEl.value = cfg.apiKey;
      this.configEl.hidden = false;
      setTimeout(() => { this.cfgModelEl.focus(); }, 0);
      if (this.provider === 'github-copilot' && cfg.apiKey && !this.copilotModels) {
        this.fetchCopilotModels(cfg.apiKey).then(() => {
          if (!this.configEl.hidden) this.populateModelSelect(this.provider, this.cfgModelEl.value);
        });
      }
    });


    this.cfgProviderEl.addEventListener('change', () => {
      this.provider = this.cfgProviderEl.value as AIProvider;
      this.saveProviderConfigs();
      this.syncProviderUi();
      this.syncConfigFields();
      const token = this.getProviderConfig().apiKey;
      if (this.provider === 'github-copilot' && token && !this.copilotModels) {
        void this.fetchCopilotModels(token);
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

    this.el.querySelector('.ai-copilot-connect')!.addEventListener('click', () => this.startCopilotAuth());
    this.el.querySelector('.ai-copilot-disconnect')!.addEventListener('click', async () => {
      const ok = await window.electronAPI?.confirm(
        'Disconnect GitHub Copilot? You can reconnect at any time.',
      );
      if (ok) await this.revokeCopilotAuth();
    });

    this.configEl.addEventListener('click', e => e.stopPropagation());
    this.el.addEventListener('click', () => {
      this.configEl.hidden = true;
    });

    ctxBtn.addEventListener('click', () => {
      this.sendContext = !this.sendContext;
      localStorage.setItem('ai-send-context', String(this.sendContext));
      ctxBtn.classList.toggle('ai-ctx-btn--on', this.sendContext);
      this.updateCtxPill();
      ctxBtn.title = this.sendContext
        ? 'Code context ON — toggle off to protect sensitive code.'
        : 'Code context OFF — AI will not see your file.';
    });

    this.ctxPillCloseBtn.addEventListener('click', () => {
      this.contextDisabledForMsg = true;
      this.ctxPillEl.hidden = true;
    });

    this.autoApproveBtn.addEventListener('click', () => {
      this.autoApprove = !this.autoApprove;
      localStorage.setItem('ai-auto-approve', String(this.autoApprove));
      this.autoApproveBtn.classList.toggle('ai-ctx-btn--on', this.autoApprove);
      this.autoApproveBtn.title = this.autoApprove
        ? 'Auto-approve ON — code applied without diff preview'
        : 'Auto-approve OFF — shows diff before applying';
    });

    this.messagesEl.addEventListener('scroll', () => {
      if (this.isPinnedToBottom()) this.unread = false;
      this.syncScrollFab();
    }, { passive: true });

    this.scrollFabEl.addEventListener('click', () => this.scrollToBottom(true));

    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? this.el.offsetWidth;
      this.el.classList.toggle('ai-sidebar--compact', w < 260);
    });
    ro.observe(this.el);
  }

  private syncChatSelect(): void {
    this.chatSelectEl.innerHTML = this.chats
      .map(c => {
        const label = this.pendingTitles.has(c.id) ? 'Naming chat…' : c.title;
        return `<option value="${c.id}"${c.id === this.activeChat.id ? ' selected' : ''}>${escapeHtml(label)}</option>`;
      })
      .join('');
    this.chatSelectEl.classList.toggle('ai-chat-select--pending', this.pendingTitles.has(this.activeChat.id));
  }

  // the first prompt truncated mid-word reads badly, so the model names the chat once it answers
  private async resolveTitle(chat: Chat, ask = true): Promise<void> {
    const fallback = this.pendingTitles.get(chat.id);
    if (fallback === undefined) return;
    let title = '';
    if (ask) {
      try {
        title = (await window.electronAPI?.aiTitle(chat.history.slice(0, 2), this.getAiConfig())) ?? '';
      } catch {}
    }
    chat.title = cleanTitle(title) || truncateAtWord(fallback);
    this.pendingTitles.delete(chat.id);
    this.saveState();
    this.syncChatSelect();
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
    const el = this.el.querySelector('.ai-status-memory') as HTMLElement | null;
    if (!el) return;
    const n = this.memories.length;
    el.textContent = n ? `${n} mem` : '';
    el.title = n ? `${n} saved ${n === 1 ? 'memory' : 'memories'} — /memory list` : '';
    el.classList.toggle('ai-status-memory--show', n > 0);
  }

  private syncProviderUi(): void {
    const cfg = this.getProviderConfig();
    const p = PROVIDERS.find(x => x.id === this.provider);

    const providerChip = this.el.querySelector('.ai-provider-chip') as HTMLElement;
    if (this.provider === 'github-copilot') {
      const connected = !!cfg.apiKey;
      this.providerLabelEl.textContent = '';
      this.providerLabelEl.classList.add('ai-provider-label--dot');
      this.providerLabelEl.classList.toggle('ai-provider-label--on', connected);
      this.providerLabelEl.title = connected ? 'GitHub Copilot connected' : 'Not connected';
      providerChip.textContent = 'Copilot';
    } else {
      this.providerLabelEl.classList.remove('ai-provider-label--dot', 'ai-provider-label--on');
      this.providerLabelEl.textContent = p?.label.split('-')[0] || this.provider;
      providerChip.textContent = p?.label || this.provider;
    }
    this.providerStateEl.textContent = cfg.model;
    this.providerStateEl.title = `Model: ${cfg.model}`;
    this.configBtnEl.title = `Provider: ${p?.label || this.provider} — click to switch to OpenRouter, Ollama or Copilot`;
  }

  private populateProviderSelect(): void {
    this.cfgProviderEl.innerHTML = PROVIDERS
      .map(p => `<option value="${p.id}"${p.id === this.provider ? ' selected' : ''}>${escapeHtml(p.label)}</option>`)
      .join('');
  }

  private syncConfigFields(): void {
    const isCopilot = this.provider === 'github-copilot';
    const cfg = this.getProviderConfig();
    const standard = this.configEl.querySelector('.ai-config-standard') as HTMLElement;
    const saveBtn = this.cfgSaveEl;

    this.populateProviderSelect();
    this.cfgCopilotEl.hidden = !isCopilot;
    standard.hidden = isCopilot;
    saveBtn.hidden = isCopilot;

    if (isCopilot) {
      this.renderCopilotStatus();
    } else {
      this.populateModelSelect(this.provider, cfg.model);
      this.cfgBaseUrlEl.value = cfg.baseUrl;
      this.cfgApiKeyEl.value = cfg.apiKey;
    }
  }

  private populateModelSelect(provider: AIProvider, current: string, dynamicModels?: string[]): void {
    const models = dynamicModels ?? (provider === 'github-copilot' && this.copilotModels ? this.copilotModels : PROVIDER_MODELS[provider] ?? []);
    this.cfgModelEl.innerHTML = models
      .map(m => `<option value="${escapeHtml(m)}"${m === current ? ' selected' : ''}>${escapeHtml(m)}</option>`)
      .join('');
    if (!models.includes(current) && current) {
      this.cfgModelEl.innerHTML = `<option value="${escapeHtml(current)}" selected>${escapeHtml(current)}</option>` + this.cfgModelEl.innerHTML;
    }
  }

  private async fetchCopilotModels(githubToken: string): Promise<void> {
    try {
      const result = await window.electronAPI?.copilotGetModels(githubToken);
      if (result?.ok && result.models.length) {
        this.copilotModels = result.models;
      } else if (result && !result.ok) {
        this.appendSystemMsg(`Could not fetch Copilot models: ${result.error}. Using default list.`);
      }
    } catch (e) {
      this.appendSystemMsg(`Could not fetch Copilot models: ${e}. Using default list.`);
    }
  }

  private renderCopilotStatus(): void {
    const statusEl = this.cfgCopilotEl.querySelector('.ai-copilot-status') as HTMLElement;
    const connectBtn = this.cfgCopilotEl.querySelector('.ai-copilot-connect') as HTMLButtonElement;
    const disconnectBtn = this.cfgCopilotEl.querySelector('.ai-copilot-disconnect') as HTMLButtonElement;
    const codeWrap = this.cfgCopilotEl.querySelector('.ai-copilot-code-wrap') as HTMLElement;
    const cfg = this.getProviderConfig('github-copilot');

    if (cfg.apiKey) {
      statusEl.textContent = 'Connected';
      statusEl.className = 'ai-copilot-status ai-copilot-status--connected';
      connectBtn.hidden = true;
      disconnectBtn.hidden = false;
      codeWrap.hidden = true;
    } else if (this.copilotAuth) {
      statusEl.textContent = 'Waiting for auth...';
      statusEl.className = 'ai-copilot-status ai-copilot-status--pending';
      connectBtn.hidden = true;
      disconnectBtn.hidden = true;
      const codeEl = codeWrap.querySelector('.ai-copilot-user-code') as HTMLElement;
      codeEl.textContent = this.copilotAuth.userCode;
      const link = codeWrap.querySelector('#ai-copilot-verif-link') as HTMLAnchorElement;
      link.href = this.copilotAuth.verificationUri;
      link.addEventListener('click', e => {
        e.preventDefault();
        window.electronAPI?.openExternal(this.copilotAuth!.verificationUri);
      });
      codeWrap.hidden = false;
    } else {
      statusEl.textContent = 'Not connected';
      statusEl.className = 'ai-copilot-status';
      connectBtn.hidden = false;
      disconnectBtn.hidden = true;
      codeWrap.hidden = true;
    }
  }

  private async startCopilotAuth(): Promise<void> {
    // cancel any in-progress auth before starting fresh
    if (this.copilotAuth?.pollTimer) clearInterval(this.copilotAuth.pollTimer);
    this.copilotAuth = null;
    try {
      const result = await window.electronAPI?.copilotStartDeviceFlow();
      if (!result) return;
      this.copilotAuth = {
        deviceCode: result.device_code,
        userCode: result.user_code,
        verificationUri: result.verification_uri,
        interval: Math.max(result.interval ?? 5, 5),
        pollTimer: null,
      };
      this.renderCopilotStatus();
      window.electronAPI?.openExternal(result.verification_uri);
      this.copilotAuth.pollTimer = setInterval(() => this.pollCopilotAuth(), this.copilotAuth!.interval * 1000);
    } catch (e) {
      this.appendSystemMsg(`Copilot auth failed: ${e}`);
    }
  }

  private async pollCopilotAuth(): Promise<void> {
    if (!this.copilotAuth) return;
    try {
      const result = await window.electronAPI?.copilotPollDeviceFlow(this.copilotAuth.deviceCode);
      if (!result) {
        this.stopCopilotPoll('Poll returned no response — check network.');
        return;
      }
      if (result.ok) {
        clearInterval(this.copilotAuth.pollTimer!);
        this.copilotAuth = null;
        this.providerConfigs['github-copilot'].apiKey = result.githubToken;
        this.saveProviderConfigs();
        this.syncProviderUi();
        this.renderCopilotStatus();
        this.fetchCopilotModels(result.githubToken);
        this.appendSystemMsg('GitHub Copilot connected successfully.');
      } else if (result.error === 'slow_down' && this.copilotAuth) {
        // GitHub asked us to back off — increase interval by 5s
        clearInterval(this.copilotAuth.pollTimer!);
        this.copilotAuth.interval += 5;
        this.copilotAuth.pollTimer = setInterval(() => this.pollCopilotAuth(), this.copilotAuth!.interval * 1000);
      } else if (result.error === 'expired_token') {
        this.stopCopilotPoll('Device code expired. Click Sign in to try again.');
      } else if (result.error === 'access_denied') {
        this.stopCopilotPoll('Authorization denied on GitHub.');
      } else if (!result.pending) {
        this.stopCopilotPoll(`Copilot auth error: ${result.error}`);
      }
      // authorization_pending → keep polling silently
    } catch (e) {
      this.stopCopilotPoll(`Copilot poll failed: ${e}`);
    }
  }

  private stopCopilotPoll(msg: string): void {
    if (this.copilotAuth?.pollTimer) clearInterval(this.copilotAuth.pollTimer);
    this.copilotAuth = null;
    this.renderCopilotStatus();
    this.appendSystemMsg(msg);
  }

  private async revokeCopilotAuth(): Promise<void> {
    if (this.copilotAuth?.pollTimer) clearInterval(this.copilotAuth.pollTimer);
    this.copilotAuth = null;
    this.copilotModels = null;
    this.providerConfigs['github-copilot'].apiKey = '';
    this.saveProviderConfigs();
    await window.electronAPI?.copilotRevoke();
    this.syncProviderUi();
    this.renderCopilotStatus();
    this.appendSystemMsg('GitHub Copilot disconnected.');
  }

  private renderMessages(): void {
    this.messagesEl.innerHTML = '';
    if (!this.activeChat.history.length) { this.appendWelcome(); return; }
    const history = this.activeChat.history;
    for (let idx = 0; idx < history.length; idx++) {
      const msg = history[idx];
      if (msg.role === 'user') {
        this.appendUserBubble(msg.content, false);
      } else {
        const row = document.createElement('div');
        row.className = 'ai-msg ai-msg--assistant';
        const bubble = document.createElement('div');
        bubble.className = 'ai-bubble';
        this.renderAssistantContent(bubble, msg.content);
        row.appendChild(bubble);

        if (idx === history.length - 1) {
          const meta = document.createElement('div');
          meta.className = 'ai-msg-meta';
          meta.textContent = '●';
          row.appendChild(meta);
          row.addEventListener('mouseenter', () => meta.classList.add('ai-msg-meta--visible'));
          row.addEventListener('mouseleave', () => meta.classList.remove('ai-msg-meta--visible'));
        }

        this.messagesEl.appendChild(row);
      }
    }
    this.scrollToBottom(true);
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
      <div class="ai-prompt-chips"></div>
    `;
    this.messagesEl.appendChild(el);
    this.initPromptChips();
  }

  private submit(): void {
    const text = this.inputEl.value.trim();
    if (!text || this.streaming) return;
    this.inputEl.value = '';
    this.inputEl.style.height = 'auto';
    this.contextDisabledForMsg = false;
    this.ctxPillEl.hidden = true;
    if (text.startsWith('/')) { this.handleCommand(text); return; }
    this.send(text);
  }

  // public: send a message programmatically (used by inline AI actions)
  sendMessage(prompt: string): void {
    if (this.streaming) return;
    this.send(prompt);
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
      this.pendingTitles.delete(this.activeChat.id);
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
    this.scrollToBottom(true);
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
    this.sendBtn.disabled = false;
    this.inputEl.disabled = on;
    this.updateSendBtn();
  }

  async send(prompt: string): Promise<void> {
    this.pruneHistory();

    const userContent = this.buildUserContent(prompt);

    this.activeChat.history.push({ role: 'user', content: userContent });
    if (this.activeChat.title === 'New Chat' && this.activeChat.history.length === 1) {
      this.pendingTitles.set(this.activeChat.id, prompt);
      this.syncChatSelect();
    }
    this.saveState();
    this.appendUserBubble(prompt, true);

    const reqId = Math.random().toString(36).slice(2);
    this.activeReqId = reqId;
    this.setLoading(true);
    this.updateSendBtn();

    const { bubble, textEl } = this.appendAssistantBubble();
    this.streamMap.set(reqId, { chat: this.activeChat, accum: '', textEl, bubble });

    window.electronAPI?.aiChat(reqId, this.activeChat.history.slice(-MAX_HISTORY), this.getAiConfig(), this.memories);
  }

  private stopGeneration(): void {
    if (!this.activeReqId) return;
    const s = this.streamMap.get(this.activeReqId);
    if (!s) return;
    const reqId = this.activeReqId;
    const full = s.accum;
    this.streamMap.delete(reqId);
    this.activeReqId = null;
    s.chat.history.push({ role: 'assistant', content: full });
    this.saveState();
    if (s.bubble) this.renderAssistantContent(s.bubble, full);
    this.setLoading(false);
    this.updateSendBtn();
    this.scrollToBottom();
    void this.resolveTitle(s.chat);
  }

  private updateSendBtn(): void {
    if (this.streaming && this.activeReqId) {
      this.sendBtn.innerHTML = iconSvg('square', { size: 14, filled: true });
      this.sendBtn.title = 'Stop generation';
    } else {
      this.sendBtn.innerHTML = iconSvg('send', { size: 14, strokeWidth: 2.5 });
      this.sendBtn.title = 'Send (Enter)';
    }
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
      if (this.activeReqId === reqId) this.activeReqId = null;
      s.chat.history.push({ role: 'assistant', content: full });
      this.saveState();
      if (s.bubble) this.renderAssistantContent(s.bubble, full);
      this.setLoading(false);
      this.scrollToBottom();
      void this.resolveTitle(s.chat);
    });

    window.electronAPI?.onAiError((reqId, error) => {
      const s = this.streamMap.get(reqId);
      if (!s) return;
      this.streamMap.delete(reqId);
      if (this.activeReqId === reqId) this.activeReqId = null;
      void this.resolveTitle(s.chat, false);
      s.bubble?.classList.remove('ai-bubble--streaming');
      s.bubble?.querySelector('.ai-typing')?.remove();
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
    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble';
    bubble.innerHTML = `<p>${escapeHtml(text)}</p>`;
    el.appendChild(bubble);

    // add toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'ai-msg-toolbar';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'ai-toolbar-btn';
    copyBtn.title = 'Copy message';
    copyBtn.innerHTML = iconSvg('copy', { size: 12 });
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(text);
      const orig = copyBtn.innerHTML;
      copyBtn.innerHTML = iconSvg('check', { size: 12 });
      setTimeout(() => { copyBtn.innerHTML = orig; }, 1500);
    });
    toolbar.appendChild(copyBtn);

    // edit
    const editBtn = document.createElement('button');
    editBtn.className = 'ai-toolbar-btn';
    editBtn.title = 'Edit and resend';
    editBtn.innerHTML = iconSvg('square-pen', { size: 12 });
    editBtn.addEventListener('click', () => {
      this.inputEl.value = text;
      this.autoResize();
      this.inputEl.focus();
    });
    toolbar.appendChild(editBtn);

    el.appendChild(toolbar);
    el.addEventListener('mouseenter', () => toolbar.classList.add('ai-msg-toolbar--visible'));
    el.addEventListener('mouseleave', () => toolbar.classList.remove('ai-msg-toolbar--visible'));

    this.messagesEl.appendChild(el);
    if (scroll) this.scrollToBottom(true);
  }

  private appendAssistantBubble(): { bubble: HTMLElement; textEl: HTMLElement } {
    const msg = document.createElement('div');
    msg.className = 'ai-msg ai-msg--assistant';
    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble ai-bubble--streaming';
    const textEl = document.createElement('p');
    textEl.className = 'ai-stream-text';
    bubble.appendChild(textEl);
    const typing = document.createElement('span');
    typing.className = 'ai-typing';
    typing.setAttribute('aria-label', 'Assistant is typing');
    typing.innerHTML = '<span></span><span></span><span></span>';
    bubble.appendChild(typing);
    msg.appendChild(bubble);
    this.messagesEl.appendChild(msg);
    this.scrollToBottom(true);
    return { bubble, textEl };
  }

  private renderAssistantContent(bubble: HTMLElement, full: string): void {
    bubble.classList.remove('ai-bubble--streaming');
    bubble.innerHTML = '';
    for (const part of parseResponse(full)) {
      if (part.type === 'text') {
        bubble.appendChild(renderMarkdown(part.content));
      } else {
        bubble.appendChild(this.buildCodeBlock(part.content, part.lang));
      }
    }
  }

  private buildCodeBlock(code: string, lang: string = 'dsmx'): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'ai-code-block';

    const header = document.createElement('div');
    header.className = 'ai-code-header';
    const langLabel = document.createElement('span');
    langLabel.className = 'ai-code-lang';
    langLabel.textContent = lang;
    header.appendChild(langLabel);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'ai-code-copy-btn';
    copyBtn.title = 'Copy code';
    copyBtn.innerHTML = iconSvg('copy', { size: 14 });
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(code);
      const orig = copyBtn.textContent;
      copyBtn.innerHTML = iconSvg('check', { size: 14 });
      setTimeout(() => { copyBtn.innerHTML = orig || iconSvg('copy', { size: 14 }); }, 1500);
    });
    header.appendChild(copyBtn);
    wrap.appendChild(header);

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

    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'ai-action-btn ai-action-btn--replace';
    replaceBtn.textContent = 'Replace';

    const denyBtn = document.createElement('button');
    denyBtn.className = 'ai-action-btn ai-action-btn--deny';
    denyBtn.textContent = 'Dismiss';

    if (this.autoApprove) {
      insertBtn.addEventListener('click', () => {
        this.onApply({ type: 'insert', code });
        this.flashAccepted(insertBtn);
      });
      replaceBtn.addEventListener('click', () => {
        this.onApply({ type: 'replace', code });
        this.flashAccepted(replaceBtn);
      });
    } else {
      insertBtn.addEventListener('click', () => {
        this.showDiffPreview(wrap, actions, code, 'insert');
      });
      replaceBtn.addEventListener('click', () => {
        this.showDiffPreview(wrap, actions, code, 'replace');
      });
    }

    denyBtn.addEventListener('click', () => { actions.innerHTML = '<span class="ai-dismissed">Dismissed</span>'; });

    actions.appendChild(insertBtn);
    actions.appendChild(replaceBtn);
    actions.appendChild(denyBtn);
    wrap.appendChild(actions);
    return wrap;
  }

  private showDiffPreview(
    wrap: HTMLElement,
    actions: HTMLElement,
    code: string,
    type: 'insert' | 'replace',
  ): void {
    const { dsl, selection } = this.getContext();
    const before = type === 'replace' ? (selection || dsl) : '';

    // hide action buttons and show diff preview
    actions.hidden = true;

    const preview = document.createElement('div');
    preview.className = 'ai-diff-preview';

    if (type === 'replace' && before) {
      const diff = lineDiff(before, code);
      const hasDiff = diff.some(d => d.op !== '=');
      if (hasDiff) {
        const diffEl = document.createElement('div');
        diffEl.className = 'ai-diff-lines';
        for (const d of diff) {
          if (d.op === '=') continue; // skip unchanged lines in collapsed view
          const line = document.createElement('div');
          line.className = d.op === '+' ? 'ai-diff-add' : 'ai-diff-del';
          line.textContent = (d.op === '+' ? '+ ' : '− ') + d.line;
          diffEl.appendChild(line);
        }
        preview.appendChild(diffEl);
      } else {
        const note = document.createElement('p');
        note.className = 'ai-diff-no-change';
        note.textContent = 'No changes detected';
        preview.appendChild(note);
      }
    } else {
      const note = document.createElement('p');
      note.className = 'ai-diff-insert-note';
      note.textContent = type === 'insert' ? 'Will insert at cursor position' : 'Will replace entire file';
      preview.appendChild(note);
    }

    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'ai-action-btn ai-action-btn--insert';
    acceptBtn.textContent = '✓ Accept';
    acceptBtn.addEventListener('click', () => {
      this.onApply({ type, code });
      preview.remove();
      actions.hidden = false;
      this.flashAccepted(type === 'insert'
        ? (actions.querySelector('.ai-action-btn--insert') as HTMLButtonElement)
        : (actions.querySelector('.ai-action-btn--replace') as HTMLButtonElement));
    });

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'ai-action-btn ai-action-btn--deny';
    rejectBtn.textContent = '✕ Reject';
    rejectBtn.addEventListener('click', () => {
      preview.remove();
      actions.hidden = false;
    });

    const btnRow = document.createElement('div');
    btnRow.className = 'ai-diff-btns';
    btnRow.appendChild(acceptBtn);
    btnRow.appendChild(rejectBtn);
    preview.appendChild(btnRow);

    wrap.appendChild(preview);
    preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  private flashAccepted(btn: HTMLButtonElement | null): void {
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = 'Applied!';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1500);
  }

  private autoResize(): void {
    this.inputEl.style.height = 'auto';
    this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 120) + 'px';
  }

  // once the user scrolls away, streaming must not drag the view back down
  private distanceFromBottom(): number {
    const el = this.messagesEl;
    return el.scrollHeight - el.scrollTop - el.clientHeight;
  }

  private isPinnedToBottom(): boolean {
    return this.distanceFromBottom() <= Math.max(48, this.messagesEl.clientHeight * SCROLL_AWAY_RATIO);
  }

  private scrollToBottom(force = false): void {
    if (!force && !this.isPinnedToBottom()) {
      this.unread = true;
      this.syncScrollFab();
      return;
    }
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    this.unread = false;
    this.syncScrollFab();
  }

  private syncScrollFab(): void {
    const away = !this.isPinnedToBottom();
    this.scrollFabEl.hidden = !away;
    this.scrollFabDotEl.hidden = !(away && this.unread);
  }

  focus(): void { this.inputEl.focus(); }

  dispose(): void {}

  private updateCtxPill(): void {
    if (!this.sendContext || this.contextDisabledForMsg) {
      this.ctxPillEl.hidden = true;
      return;
    }
    const { dsl, selection } = this.getContext();
    const src = selection || dsl;
    if (!src) {
      this.ctxPillEl.hidden = true;
      return;
    }
    const textEl = this.ctxPillEl.querySelector('.ai-ctx-pill-text')!;
    if (selection) {
      const selStart = dsl.indexOf(selection);
      const lines = dsl.slice(0, selStart).split('\n').length;
      const startLine = lines;
      const endLine = startLine + selection.split('\n').length - 1;
      textEl.textContent = startLine === endLine ? `line ${startLine}` : `lines ${startLine}–${endLine}`;
    } else {
      const lineCount = dsl.split('\n').length;
      textEl.textContent = `${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`;
    }
    this.ctxPillEl.hidden = false;
  }

  refreshCtxPill(): void {
    this.updateCtxPill();
  }

  private initPromptChips(): void {
    const container = this.messagesEl.querySelector('.ai-prompt-chips') as HTMLElement;
    if (!container) return;

    const chipsEl = document.createElement('div');
    chipsEl.className = 'ai-chips-container';

    const fill = (offset: number) => {
      chipsEl.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const text = PROMPT_SUGGESTIONS[(offset + i) % PROMPT_SUGGESTIONS.length];
        const chip = document.createElement('button');
        chip.className = 'ai-prompt-chip';
        chip.type = 'button';
        chip.textContent = text;
        chip.addEventListener('click', () => {
          this.inputEl.value = text;
          this.autoResize();
          this.inputEl.focus();
        });
        chipsEl.appendChild(chip);
      }
    };

    // these used to cycle on a timer, which moved the text out from under whoever
    // was reading it. they change only when asked to now.
    let offset = 0;
    fill(offset);

    const more = document.createElement('button');
    more.className = 'ai-prompt-chip ai-prompt-chip--more';
    more.type = 'button';
    more.textContent = 'more ideas';
    more.title = 'Show another three suggestions';
    more.addEventListener('click', () => {
      offset = (offset + 3) % PROMPT_SUGGESTIONS.length;
      fill(offset);
    });

    container.append(chipsEl, more);
  }
}

type Part = { type: 'text'; content: string } | { type: 'code'; content: string; lang: string };

function parseResponse(text: string): Part[] {
  const parts: Part[] = [];
  const re = /```(\w+)?\n?([\s\S]*?)```/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(last, m.index).trim();
    if (before) parts.push({ type: 'text', content: before });
    parts.push({ type: 'code', content: m[2].trim(), lang: m[1] || 'dsmx' });
    last = m.index + m[0].length;
  }
  const after = text.slice(last).trim();
  if (after) parts.push({ type: 'text', content: after });
  return parts;
}

function renderMarkdown(text: string): HTMLElement {
  const el = document.createElement('div');
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    // horizontal rule
    if (/^---+$/.test(trimmed)) {
      const hr = document.createElement('div');
      hr.className = 'ai-hr';
      el.appendChild(hr);
      i++;
      continue;
    }

    // heading
    const headingMatch = trimmed.match(/^##\s+(.+)$/);
    if (headingMatch) {
      const h = document.createElement('h3');
      h.className = 'ai-heading';
      h.textContent = headingMatch[1];
      el.appendChild(h);
      i++;
      continue;
    }

    // bullet list or numbered list
    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const list = /^[-*]\s+/.test(trimmed)
        ? document.createElement('ul')
        : document.createElement('ol');
      list.className = 'ai-list';
      while (i < lines.length) {
        const l = lines[i].trim();
        if (!l) break;
        const isBullet = /^[-*]\s+(.+)$/.test(l);
        const isNum = /^\d+\.\s+(.+)$/.test(l);
        if (!isBullet && !isNum) break;
        const content = l.replace(/^(?:[-*]|\d+\.)\s+/, '');
        const li = document.createElement('li');
        li.className = 'ai-list-item';
        li.innerHTML = formatInlineMarkdown(content);
        list.appendChild(li);
        i++;
      }
      el.appendChild(list);
      continue;
    }

    // paragraph
    const p = document.createElement('p');
    p.innerHTML = formatInlineMarkdown(trimmed);
    el.appendChild(p);
    i++;
  }

  return el;
}

function formatInlineMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');
  return html;
}

function cleanTitle(raw: string): string {
  const words = raw.replace(/["'`]|[.\s]+$/g, '').replace(/\s+/g, ' ').trim().split(' ');
  return words.length > 6 ? words.slice(0, 6).join(' ') : words.join(' ');
}

function truncateAtWord(raw: string, max = 40): string {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${space > 12 ? cut.slice(0, space) : cut}…`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
