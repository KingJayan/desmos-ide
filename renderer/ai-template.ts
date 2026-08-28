import { iconEl } from './icons';
import type { IconName } from './icons';

export interface TemplateState {
  sendContext: boolean;
  autoApprove: boolean;
}

export interface SidebarParts {
  chatSelect: HTMLSelectElement;
  newBtn: HTMLButtonElement;
  delBtn: HTMLButtonElement;
  messages: HTMLElement;
  scrollFab: HTMLButtonElement;
  scrollFabDot: HTMLElement;
  providerChip: HTMLButtonElement;
  providerLabel: HTMLElement;
  statusModel: HTMLButtonElement;
  statusMemory: HTMLElement;
  ctxBtn: HTMLButtonElement;
  autoApproveBtn: HTMLButtonElement;
  autocomplete: HTMLElement;
  ctxPill: HTMLElement;
  ctxPillText: HTMLElement;
  ctxPillClose: HTMLButtonElement;
  input: HTMLTextAreaElement;
  sendBtn: HTMLButtonElement;
  config: HTMLElement;
  cfgProvider: HTMLSelectElement;
  cfgCopilot: HTMLElement;
  copilotStatus: HTMLElement;
  copilotConnect: HTMLButtonElement;
  copilotDisconnect: HTMLButtonElement;
  copilotCodeWrap: HTMLElement;
  copilotLink: HTMLAnchorElement;
  copilotUserCode: HTMLElement;
  cfgStandard: HTMLElement;
  cfgModel: HTMLSelectElement;
  cfgBaseUrl: HTMLInputElement;
  cfgApiKey: HTMLInputElement;
  cfgKeyNote: HTMLElement;
  cfgSave: HTMLButtonElement;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconButton(className: string, id: string, icon: IconName, title: string, size = 14): HTMLButtonElement {
  const button = el('button', className);
  button.type = 'button';
  if (id) button.id = id;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.appendChild(iconEl(icon, { size }));
  return button;
}

function row(className: string, label: string, control: HTMLElement): HTMLLabelElement {
  const wrap = el('label', className);
  wrap.appendChild(el('span', '', label));
  wrap.appendChild(control);
  return wrap;
}

export function buildSidebar(root: HTMLElement, state: TemplateState): SidebarParts {
  const header = el('div', 'ai-header');
  const picker = el('span', 'ai-chat-picker');
  const chatSelect = el('select', 'ai-chat-select');
  chatSelect.setAttribute('aria-label', 'chat');
  picker.append(chatSelect, iconEl('chevron-down', { size: 12 }));
  const newBtn = iconButton('ai-icon-btn', 'ai-new-btn', 'plus', 'New Chat');
  const delBtn = iconButton('ai-icon-btn ai-icon-btn--danger', 'ai-del-btn', 'trash-2', 'Delete or Clear Chat');
  header.append(picker, newBtn, delBtn);

  const messages = el('div', 'ai-messages');

  const strip = el('div', 'ai-status-strip');
  const scrollFab = iconButton('ai-scroll-fab', '', 'arrow-down', 'Scroll to latest');
  scrollFab.hidden = true;
  const scrollFabDot = el('span', 'ai-scroll-fab-dot');
  scrollFabDot.hidden = true;
  scrollFab.appendChild(scrollFabDot);

  const statusLeft = el('div', 'ai-status-left');
  const providerChip = el('button', 'ai-provider-chip');
  providerChip.type = 'button';
  providerChip.id = 'ai-provider-chip';
  providerChip.title = 'Change the AI provider and model';
  const providerLabel = el('span', 'ai-status-provider-label');
  providerChip.appendChild(providerLabel);
  const statusModel = el('button', 'ai-status-model');
  statusModel.type = 'button';
  statusModel.title = 'Change model';
  const statusMemory = el('span', 'ai-status-memory');
  statusLeft.append(providerChip, statusModel, statusMemory);

  const statusRight = el('div', 'ai-status-right');
  const ctxBtn = el('button', `ai-ctx-btn${state.sendContext ? ' ai-ctx-btn--on' : ''}`);
  ctxBtn.type = 'button';
  ctxBtn.id = 'ai-ctx-btn';
  ctxBtn.title = 'Send code context with each message. Toggle off to protect sensitive code.';
  ctxBtn.append(iconEl('file-text', { size: 12, strokeWidth: 2.5 }), el('span', '', 'ctx'));
  const autoApproveBtn = el('button', `ai-ctx-btn${state.autoApprove ? ' ai-ctx-btn--on' : ''}`);
  autoApproveBtn.type = 'button';
  autoApproveBtn.id = 'ai-autoapprove-btn';
  autoApproveBtn.title = state.autoApprove
    ? 'Auto-approve ON — code applied without diff preview'
    : 'Auto-approve OFF — shows diff before applying';
  autoApproveBtn.append(iconEl('check', { size: 12, strokeWidth: 2.5 }), el('span', '', 'auto'));
  statusRight.append(ctxBtn, autoApproveBtn);
  strip.append(scrollFab, statusLeft, statusRight);

  const compose = el('div', 'ai-compose');
  const autocomplete = el('div', 'ai-autocomplete');

  const ctxPill = el('div', 'ai-ctx-pill');
  ctxPill.hidden = true;
  const ctxPillText = el('span', 'ai-ctx-pill-text');
  const ctxPillClose = iconButton('ai-ctx-pill-close', '', 'x', 'Disable context for this message', 12);
  ctxPill.append(ctxPillText, ctxPillClose);

  const composeWrap = el('div', 'ai-compose-wrap');
  const input = el('textarea', 'ai-input');
  input.rows = 1;
  input.placeholder = 'Ask about your DSL…';
  input.setAttribute('aria-label', 'message');
  const composeBar = el('div', 'ai-compose-bar');
  const sendBtn = iconButton('ai-send-btn', '', 'send', 'Send (Enter)');
  composeBar.appendChild(sendBtn);
  composeWrap.append(input, composeBar);

  const config = el('div', 'ai-config-popover');
  config.hidden = true;
  const cfgProvider = el('select', 'ai-config-input ai-config-provider');
  config.appendChild(row('ai-config-row', 'provider', cfgProvider));

  const cfgCopilot = el('div', 'ai-config-copilot');
  cfgCopilot.hidden = true;
  const copilotRow = el('div', 'ai-copilot-row');
  const copilotStatus = el('span', 'ai-copilot-status');
  const copilotConnect = el('button', 'ai-copilot-connect', 'Sign in');
  copilotConnect.type = 'button';
  const copilotCancel = el('button', 'ai-copilot-cancel', 'cancel');
  copilotCancel.type = 'button';
  copilotCancel.hidden = true;
  const copilotDisconnect = el('button', 'ai-copilot-disconnect', 'disconnect');
  copilotDisconnect.type = 'button';
  copilotDisconnect.hidden = true;
  copilotRow.append(copilotStatus, copilotConnect, copilotCancel, copilotDisconnect);

  const copilotCodeWrap = el('div', 'ai-copilot-code-wrap');
  copilotCodeWrap.hidden = true;
  const instructions = el('p', 'ai-copilot-instructions');
  const copilotLink = el('a', 'ai-copilot-link', 'github.com/login/device');
  copilotLink.id = 'ai-copilot-verif-link';
  copilotLink.href = '#';
  instructions.append(document.createTextNode('Open '), copilotLink, document.createTextNode(' and enter:'));
  const copilotUserCode = el('code', 'ai-copilot-user-code');
  copilotCodeWrap.append(instructions, copilotUserCode);
  cfgCopilot.append(copilotRow, copilotCodeWrap);

  const cfgStandard = el('div', 'ai-config-standard');
  cfgStandard.appendChild(el(
    'p', 'ai-config-hint',
    'The model and base url are filled in already. Paste a key to start, or pick Ollama to run a local model with no key at all.',
  ));
  const cfgModel = el('select', 'ai-config-input ai-config-model');
  const cfgBaseUrl = el('input', 'ai-config-input ai-config-baseurl');
  cfgBaseUrl.type = 'text';
  cfgBaseUrl.spellcheck = false;
  const cfgApiKey = el('input', 'ai-config-input ai-config-key');
  cfgApiKey.type = 'password';
  cfgApiKey.spellcheck = false;
  const cfgKeyNote = el('p', 'ai-config-hint ai-config-key-note');
  cfgStandard.append(
    row('ai-config-row', 'model', cfgModel),
    row('ai-config-row', 'base url', cfgBaseUrl),
    row('ai-config-row', 'api key', cfgApiKey),
    cfgKeyNote,
  );

  const cfgSave = el('button', 'ai-config-save', 'save');
  cfgSave.type = 'button';
  config.append(cfgCopilot, cfgStandard, cfgSave);

  compose.append(autocomplete, ctxPill, composeWrap, config);
  root.replaceChildren(header, messages, strip, compose);

  return {
    chatSelect, newBtn, delBtn, messages, scrollFab, scrollFabDot,
    providerChip, providerLabel, statusModel, statusMemory, ctxBtn, autoApproveBtn,
    autocomplete, ctxPill, ctxPillText, ctxPillClose, input, sendBtn,
    config, cfgProvider, cfgCopilot, copilotStatus, copilotConnect, copilotDisconnect,
    copilotCodeWrap, copilotLink, copilotUserCode,
    cfgStandard, cfgModel, cfgBaseUrl, cfgApiKey, cfgKeyNote, cfgSave,
  };
}
