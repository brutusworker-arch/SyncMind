// AI Provider abstraction — supports Claude API and local Ollama

export type AIProvider = 'claude' | 'ollama';

export interface AIResponse {
  answer: string;
  tags: string[];
  summary: string;
}

interface ProviderConfig {
  claude: {
    apiKey: string;
    model: string;
  };
  ollama: {
    url: string;
    model: string;
  };
}

const config: ProviderConfig = {
  claude: {
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY as string || '',
    model: 'claude-sonnet-4-6',
  },
  ollama: {
    url: import.meta.env.VITE_OLLAMA_URL as string || 'http://192.168.178.172:11434',
    model: import.meta.env.VITE_OLLAMA_MODEL as string || 'qwen2.5:7b',
  },
};

function buildSystemPrompt(context: Array<{ question: string; answer: string }>): string {
  const recentContext = context.slice(-5);
  const contextStr = recentContext.length > 0
    ? '\n\nPrevious knowledge in your base:\n' +
      recentContext.map(e => `Q: ${e.question}\nA: ${e.answer.substring(0, 200)}...`).join('\n\n')
    : '';

  return `You are SyncMind, a knowledge base AI assistant. Your answers are stored locally on the user's device using PowerSync (local-first SQLite sync) and synced across all their devices.

Give clear, concise answers. At the end of your answer, on a new line, output:
TAGS: [comma-separated list of 2-4 relevant tags]
${contextStr}`;
}

function parseResponse(fullText: string): AIResponse {
  // Match TAGS with or without brackets: "TAGS: [a, b]" or "TAGS: a, b"
  const tagsMatch = fullText.match(/TAGS:\s*\[([^\]]+)\]/i)
    || fullText.match(/TAGS:\s*(.+)$/im);
  const tags = tagsMatch
    ? tagsMatch[1].split(',').map((t: string) => t.trim().toLowerCase())
    : ['general'];
  // Remove ALL variations of the TAGS line from the answer
  const answer = fullText
    .replace(/\n?TAGS:\s*\[[^\]]*\]\s*/gi, '')
    .replace(/\n?TAGS:\s*.+$/gim, '')
    .trim();
  return {
    answer,
    tags,
    summary: answer.substring(0, 100) + (answer.length > 100 ? '...' : ''),
  };
}

async function askClaude_API(
  question: string,
  systemPrompt: string
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.claude.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.claude.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error (${response.status}): ${err.substring(0, 200)}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function askOllama(
  question: string,
  systemPrompt: string
): Promise<string> {
  const response = await fetch(`${config.ollama.url}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollama.model,
      prompt: `${systemPrompt}\n\nUser question: ${question}`,
      stream: false,
      options: { temperature: 0.7, num_predict: 1024 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  return data.response || '';
}

export async function askAI(
  question: string,
  context: Array<{ question: string; answer: string }> = [],
  provider: AIProvider = 'ollama'
): Promise<AIResponse> {
  const systemPrompt = buildSystemPrompt(context);

  let fullText: string;
  if (provider === 'claude') {
    fullText = await askClaude_API(question, systemPrompt);
  } else {
    fullText = await askOllama(question, systemPrompt);
  }

  return parseResponse(fullText);
}

// Keep backward compat
export const askClaude = askAI;

export function getAvailableProviders(): { id: AIProvider; name: string; available: boolean }[] {
  return [
    { id: 'ollama', name: `Ollama (${config.ollama.model})`, available: true },
    { id: 'claude', name: `Claude (${config.claude.model})`, available: !!config.claude.apiKey },
  ];
}
