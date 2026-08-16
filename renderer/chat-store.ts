export type ConvMessage = { role: 'user' | 'assistant'; content: string };
export type Chat = { id: string; title: string; history: ConvMessage[] };

export const MAX_CHATS = 10;
export const MAX_CHAT_BYTES = 40_000;
export const CONTEXT_CHAR_LIMIT = 1_500;
export const PRUNE_THRESHOLD = 18;

export const SLASH_COMMANDS = [
  { cmd: '/help',         desc: 'Show all available commands',       arg: '' },
  { cmd: '/clear',        desc: 'Clear chat history',                arg: '' },
  { cmd: '/compact',      desc: 'Summarize & compress conversation', arg: '' },
  { cmd: '/memory add',   desc: 'Save a fact to memory',             arg: '<fact>' },
  { cmd: '/memory list',  desc: 'List saved memories',               arg: '' },
  { cmd: '/memory clear', desc: 'Clear all memories',                arg: '' },
] as const;

export type SlashCommand = (typeof SLASH_COMMANDS)[number];

/**
 * drops oldest chats
 */
export function capChats(chats: Chat[], active: Chat, max = MAX_CHATS): { chats: Chat[]; active: Chat } {
  if (chats.length <= max) return { chats, active };
  const kept = chats.slice(chats.length - max);
  return { chats: kept, active: kept.includes(active) ? active : kept[0] };
}

/**
 * drops oldest turns
 */
export function trimChatBytes(history: ConvMessage[], maxBytes = MAX_CHAT_BYTES): ConvMessage[] {
  const out = [...history];
  while (out.length > 2 && JSON.stringify(out).length > maxBytes) out.splice(0, 2);
  return out;
}

/**
 * cuts a long conversation back
 */
export function pruneHistory(
  history: ConvMessage[],
  threshold = PRUNE_THRESHOLD,
): { history: ConvMessage[]; pruned: boolean } {
  if (history.length < threshold) return { history, pruned: false };
  return { history: history.slice(-(threshold - 4)), pruned: true };
}

/**
 * puts editor context under the prompt as a fenced block
 */
export function withContext(
  prompt: string,
  ctx: { dsl: string; selection: string },
  limit = CONTEXT_CHAR_LIMIT,
): string {
  const src = ctx.selection || ctx.dsl;
  if (!src) return prompt;
  const label = ctx.selection ? 'Selected code' : 'Current file';
  const body = src.length > limit ? `${src.slice(0, limit)}\n…[truncated]` : src;
  return `${prompt}\n\n${label}:\n\`\`\`dsmx\n${body}\n\`\`\``;
}

export function matchSlashCommands(input: string): SlashCommand[] {
  if (!input.startsWith('/')) return [];
  const typed = input.trimEnd();
  return SLASH_COMMANDS.filter(c => c.cmd.startsWith(typed));
}
