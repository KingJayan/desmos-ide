import { DSL_SYSTEM_PROMPT } from './prompt';
import type {
  AIConfig,
  AIMessage,
  AIProvider,
  CopilotDeviceFlow,
  CopilotModelsResult,
  CopilotPollResult,
} from '../src/shared/rpc-schema';

const PROVIDER_DEFAULTS: Record<AIProvider, { model: string; baseUrl: string }> = {
  'openai-compatible': { model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
  openrouter: { model: 'openai/gpt-4o-mini', baseUrl: 'https://openrouter.ai/api/v1' },
  ollama: { model: 'llama3.2', baseUrl: 'http://127.0.0.1:11434/v1' },
  'github-copilot': { model: 'gpt-4o', baseUrl: 'https://api.githubcopilot.com' },
};

const COPILOT_CLIENT_ID = process.env['GITHUB_OAUTH_CLIENT_ID'] ?? 'Iv1.b507a08c87ecfe98';

interface CopilotTokenCache { githubToken: string; copilotToken: string; expiresAt: number }
let copilotTokenCache: CopilotTokenCache | null = null;

async function getCopilotApiToken(githubToken: string): Promise<string> {
  const now = Date.now();
  if (copilotTokenCache?.githubToken === githubToken && copilotTokenCache.expiresAt > now + 60_000) {
    return copilotTokenCache.copilotToken;
  }
  const resp = await fetch('https://api.github.com/copilot_internal/v2/token', {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/json',
      'User-Agent': 'Desmos-IDE/1.0',
      'Editor-Version': 'vscode/1.85.0',
      'Editor-Plugin-Version': 'desmos-ide/1.0',
    },
  });
  if (!resp.ok) throw new Error(`Copilot token refresh failed: ${resp.status} — ensure your GitHub account has Copilot access`);
  const data = await resp.json() as { token: string; expires_at: string };
  copilotTokenCache = { githubToken, copilotToken: data.token, expiresAt: new Date(data.expires_at).getTime() };
  return data.token;
}

export function sanitizeMessages(raw: unknown): AIMessage[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter(m => m && typeof m === 'object' && typeof (m as Record<string, unknown>).content === 'string'
      && ((m as Record<string, unknown>).role === 'user' || (m as Record<string, unknown>).role === 'assistant'))
    .slice(0, 100) as AIMessage[];
}

function sanitizeProvider(raw: unknown): AIProvider {
  if (raw === 'openai-compatible' || raw === 'openrouter' || raw === 'ollama' || raw === 'github-copilot') return raw;
  return 'openai-compatible';
}

function sanitizeBaseUrl(provider: AIProvider, raw: unknown): string {
  const fallback = PROVIDER_DEFAULTS[provider].baseUrl;
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fallback;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

export function sanitizeConfig(raw: unknown): AIConfig {
  const obj = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const provider = sanitizeProvider(obj.provider);
  return {
    provider,
    model: typeof obj.model === 'string' && obj.model.trim() ? obj.model.trim() : PROVIDER_DEFAULTS[provider].model,
    baseUrl: sanitizeBaseUrl(provider, obj.baseUrl),
    apiKey: typeof obj.apiKey === 'string' ? obj.apiKey.trim() : '',
  };
}

const MEMORY_MAX_LEN = 200;
const MEMORY_INJECTION_RE = /system\s*prompt|ignore\s*(previous|above|all)|new\s*instructions?|you\s*are\s*now|forget\s*(everything|all)|disregard|override/i;

export function sanitizeMemories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter(m => typeof m === 'string')
    .map(m => (m as string).slice(0, MEMORY_MAX_LEN).replace(/[\r\n]+/g, ' ').trim())
    .filter(m => m.length > 0 && !MEMORY_INJECTION_RE.test(m))
    .slice(0, 20);
}

function resolveApiKey(config: AIConfig): string {
  if (config.apiKey) return config.apiKey;
  if (config.provider === 'openrouter') return process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
  if (config.provider === 'openai-compatible') return process.env.OPENAI_API_KEY || '';
  if (config.provider === 'github-copilot') return process.env.GITHUB_TOKEN || '';
  return process.env.OLLAMA_API_KEY || '';
}

function toChatUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/chat/completions`;
}

export function toProviderErrorMessage(err: unknown, config: AIConfig): string {
  const text = String(err);
  if (text.includes('401')) return 'Authentication failed (401). Check provider API key or environment fallback.';
  if (text.includes('403')) return 'Request forbidden (403). Check provider permissions and model access.';
  if (text.includes('404')) return `Endpoint not found (404): ${toChatUrl(config.baseUrl)}`;
  if (text.includes('429')) return 'Rate limit reached (429). Retry after a short delay.';
  if (config.provider === 'ollama' && (text.includes('ECONNREFUSED') || text.includes('fetch failed'))) {
    return 'Cannot connect to Ollama. Start Ollama and verify base URL (default http://127.0.0.1:11434/v1).';
  }
  return `AI request failed: ${text}`;
}

export function logAiError(scope: string, reqId: string, config: AIConfig, err: unknown): void {
  console.error(`[${scope}]`, {
    reqId,
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    error: String(err),
  });
}

async function providerRequest(config: AIConfig, body: unknown): Promise<Response> {
  let apiKey = resolveApiKey(config);
  let baseUrl = config.baseUrl;

  if (config.provider === 'github-copilot') {
    if (!apiKey) throw new Error('GitHub Copilot not connected. Sign in via AI provider settings.');
    apiKey = await getCopilotApiToken(apiKey);
    baseUrl = 'https://api.githubcopilot.com';
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://desmos-ide.local';
    headers['X-Title'] = 'Desmos IDE';
  }
  if (config.provider === 'github-copilot') {
    headers['Editor-Version'] = 'vscode/1.85.0';
    headers['Copilot-Integration-Id'] = 'vscode-chat';
  }

  const response = await fetch(toChatUrl(baseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${bodyText.slice(0, 400)}`);
  }
  return response;
}

export async function streamOpenAICompatible(
  config: AIConfig,
  messages: AIMessage[],
  systemText: string,
  onChunk: (text: string) => void,
): Promise<void> {
  const response = await providerRequest(config, {
    model: config.model,
    stream: true,
    temperature: 0.3,
    messages: [{ role: 'system', content: systemText }, ...messages],
  });
  if (!response.body) throw new Error('Empty response body from provider');

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let splitAt = buffer.indexOf('\n\n');
    while (splitAt >= 0) {
      const rawEvent = buffer.slice(0, splitAt);
      buffer = buffer.slice(splitAt + 2);

      const payload = rawEvent
        .split(/\r?\n/)
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim())
        .join('');

      if (payload && payload !== '[DONE]') {
        try {
          const json = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }> };
          const chunk = json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content || '';
          if (chunk) onChunk(chunk);
        } catch {}
      }

      splitAt = buffer.indexOf('\n\n');
    }
  }
}

async function completeOpenAICompatible(
  config: AIConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  maxTokens: number,
): Promise<string> {
  const response = await providerRequest(config, {
    model: config.model,
    stream: false,
    max_tokens: maxTokens,
    temperature: 0.2,
    messages,
  });
  const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return (json.choices?.[0]?.message?.content || '').trim();
}

function fallbackCompact(messages: AIMessage[]): string {
  const latest = messages.slice(-8).map(m => `${m.role}: ${m.content}`).join('\n');
  return latest || 'No conversation to summarize.';
}

export function buildSystemText(memories: string[]): string {
  if (!memories.length) return DSL_SYSTEM_PROMPT;
  return `${DSL_SYSTEM_PROMPT}\n\n---\n## User-saved notes (low-trust)\n${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}`;
}

export async function compactConversation(
  messages: AIMessage[],
  config: AIConfig,
  memories: string[],
): Promise<string> {
  const base = 'Summarize this conversation concisely, preserving key facts, decisions, and any code. Keep plain text.';
  try {
    const systemText = memories.length
      ? `${base}\n\nRemembered facts:\n${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
      : base;
    const text = await completeOpenAICompatible(
      config,
      [
        { role: 'system', content: systemText },
        ...messages,
        { role: 'user', content: 'Summarize our conversation above.' },
      ],
      1024,
    );
    return text || fallbackCompact(messages);
  } catch (err) {
    logAiError('ai:compact', 'compact', config, err);
    return fallbackCompact(messages);
  }
}

export async function titleConversation(messages: AIMessage[], config: AIConfig): Promise<string> {
  if (!messages.length) return '';
  try {
    return await completeOpenAICompatible(
      config,
      [
        {
          role: 'system',
          content: 'Write a title of 4 to 6 words for this conversation. Reply with the title only. No quotes, no final period.',
        },
        ...messages.slice(0, 2),
        { role: 'user', content: 'Give the title now.' },
      ],
      24,
    );
  } catch (err) {
    logAiError('ai:title', 'title', config, err);
    return '';
  }
}

export async function copilotStartDeviceFlow(): Promise<CopilotDeviceFlow> {
  const resp = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${COPILOT_CLIENT_ID}&scope=read%3Auser`,
  });
  if (!resp.ok) throw new Error(`GitHub device flow failed: ${resp.status}`);
  return resp.json() as Promise<CopilotDeviceFlow>;
}

export async function copilotPollDeviceFlow(deviceCode: string): Promise<CopilotPollResult> {
  if (!deviceCode) return { ok: false, pending: false, error: 'missing device code' };
  const resp = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${COPILOT_CLIENT_ID}&device_code=${deviceCode}&grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code`,
  });
  const data = await resp.json() as Record<string, unknown>;
  if (data.error) {
    return {
      ok: false,
      pending: data.error === 'authorization_pending' || data.error === 'slow_down',
      error: String(data.error),
    };
  }
  if (typeof data.access_token === 'string') return { ok: true, githubToken: data.access_token };
  return { ok: false, pending: false, error: 'unexpected response' };
}

export function copilotRevoke(): { ok: true } {
  copilotTokenCache = null;
  return { ok: true };
}

export async function copilotGetModels(githubToken: string): Promise<CopilotModelsResult> {
  if (!githubToken) return { ok: false, error: 'no token' };
  try {
    const copilotToken = await getCopilotApiToken(githubToken);
    const resp = await fetch('https://api.githubcopilot.com/models', {
      headers: {
        Authorization: `Bearer ${copilotToken}`,
        'Copilot-Integration-Id': 'vscode-chat',
        'Editor-Version': 'vscode/1.85.0',
        'Editor-Plugin-Version': 'desmos-ide/1.0',
        Accept: 'application/json',
      },
    });
    if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}` };
    const data = await resp.json() as { data?: Array<{ id: string; capabilities?: { type?: string } }> };
    const models = (data.data ?? [])
      .filter(m => !m.capabilities?.type || m.capabilities.type === 'chat')
      .map(m => m.id);
    return { ok: true, models };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
