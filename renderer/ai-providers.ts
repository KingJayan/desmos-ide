import { SecretStore } from './secret-store';

export type AIProvider = 'openai-compatible' | 'openrouter' | 'ollama' | 'github-copilot';

export type ProviderConfig = {
  model: string;
  baseUrl: string;
  apiKey: string;
};

export type ProviderConfigMap = Record<AIProvider, ProviderConfig>;

export const PROVIDERS: Array<{ id: AIProvider; label: string }> = [
  { id: 'openai-compatible', label: 'OpenAI-compatible' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'ollama', label: 'Ollama' },
  { id: 'github-copilot', label: 'GitHub Copilot' },
];

export const PROVIDER_DEFAULTS: ProviderConfigMap = {
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

export const PROVIDER_MODELS: Record<AIProvider, string[]> = {
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

export interface CopilotAuthState {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  pollTimer: ReturnType<typeof setInterval> | null;
  interval: number;
}

export function aiProviderReady(): boolean {
  try {
    return localStorage.getItem('ai-ready') === '1';
  } catch {
    return false;
  }
}

export function legacyKeys(): Record<string, string> {
  try {
    const raw = localStorage.getItem('ai-provider-configs');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<AIProvider, { apiKey?: unknown }>>;
    const out: Record<string, string> = {};
    for (const p of PROVIDERS) {
      const key = parsed[p.id]?.apiKey;
      if (typeof key === 'string' && key) out[p.id] = key;
    }
    return out;
  } catch {
    return {};
  }
}

export function createSecretStore(): SecretStore {
  const api = () => window.electronAPI;
  return new SecretStore(
    {
      available: () => api()?.secretsAvailable() ?? Promise.resolve(false),
      get: account => api()?.secretGet(account) ?? Promise.resolve(null),
      set: (account, value) => api()?.secretSet(account, value) ?? Promise.resolve(false),
      remove: account => api()?.secretDelete(account) ?? Promise.resolve(false),
      legacy: legacyKeys,
      clearLegacy: () => {
        try {
          const raw = localStorage.getItem('ai-provider-configs');
          if (!raw) return;
          const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;
          for (const entry of Object.values(parsed)) {
            if (entry && typeof entry === 'object') entry.apiKey = '';
          }
          localStorage.setItem('ai-provider-configs', JSON.stringify(parsed));
        } catch {
        }
      },
    },
    PROVIDERS.map(p => p.id),
  );
}

export function modelHint(error: string, model: string): string | null {
  const text = error.toLowerCase();
  const unknownModel =
    text.includes('model_not_found') ||
    text.includes('unknown model') ||
    text.includes('does not exist') ||
    (text.includes('model') && (text.includes('not found') || text.includes('invalid')));
  if (unknownModel) {
    return `Your provider does not have the model "${model}". Open the provider chip below and pick another model.`;
  }
  if (text.includes('401') || text.includes('unauthorized') || text.includes('invalid api key')) {
    return 'Your provider refused the API key. Open the provider chip below and set a key.';
  }
  return null;
}
