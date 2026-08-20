import { iconSvg } from './icons';

export interface TemplateState {
  sendContext: boolean;
  autoApprove: boolean;
}

export function sidebarMarkup({ sendContext, autoApprove }: TemplateState): string {
  return `
      <div class="ai-header">
        <select class="ai-chat-select"></select>
        <button class="ai-icon-btn" id="ai-new-btn" title="New Chat" aria-label="New Chat">${iconSvg('plus', { size: 14 })}</button>
        <button class="ai-icon-btn ai-icon-btn--danger" id="ai-del-btn" title="Delete/Clear Chat" aria-label="Delete or Clear Chat">${iconSvg('trash-2', { size: 14 })}</button>
      </div>
      <div class="ai-messages"></div>
      <div class="ai-status-strip">
        <button class="ai-scroll-fab" type="button" title="Scroll to latest" aria-label="Scroll to latest" hidden>
          ${iconSvg('arrow-down', { size: 14 })}
          <span class="ai-scroll-fab-dot" hidden></span>
        </button>
        <div class="ai-status-left">
          <button class="ai-provider-chip" id="ai-provider-chip" title="Change the AI provider and model"><span class="ai-status-provider-label"></span></button>
          <button class="ai-status-model" title="Change model"></button>
          <span class="ai-status-memory"></span>
        </div>
        <div class="ai-status-right">
          <button class="ai-ctx-btn${sendContext ? ' ai-ctx-btn--on' : ''}" id="ai-ctx-btn" title="Send code context with each message. Toggle off to protect sensitive code.">
            ${iconSvg('file-text', { size: 12, strokeWidth: 2.5 })}
            <span>ctx</span>
          </button>
          <button class="ai-ctx-btn${autoApprove ? ' ai-ctx-btn--on' : ''}" id="ai-autoapprove-btn" title="${autoApprove ? 'Auto-approve ON — code applied without diff preview' : 'Auto-approve OFF — shows diff before applying'}">
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
              <button class="ai-copilot-cancel" type="button" hidden>cancel</button>
              <button class="ai-copilot-disconnect" type="button" hidden>disconnect</button>
            </div>
            <div class="ai-copilot-code-wrap" hidden>
              <p class="ai-copilot-instructions">Open <a class="ai-copilot-link" href="#" id="ai-copilot-verif-link">github.com/login/device</a> and enter:</p>
              <code class="ai-copilot-user-code"></code>
            </div>
          </div>
          <div class="ai-config-standard">
            <p class="ai-config-hint">The model and base url are filled in already. Paste a key to start, or pick Ollama to run a local model with no key at all.</p>
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
            <p class="ai-config-hint ai-config-key-note"></p>
          </div>
          <button class="ai-config-save" type="button">save</button>
        </div>
      </div>
    `;
}
