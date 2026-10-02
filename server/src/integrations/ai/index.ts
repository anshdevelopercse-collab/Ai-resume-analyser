import { config } from '../../config';
import { AnthropicProvider } from './anthropicProvider';
import { OpenAIProvider } from './openaiProvider';
import { GeminiProvider } from './geminiProvider';
import type { AIProvider } from './types';

export { type AIProvider, type AICompletionResult, type AIMessage, type AICompletionOptions } from './types';

let _provider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (_provider) return _provider;

  const requestedProvider = config.ai.provider;

  if (requestedProvider === 'anthropic' || (requestedProvider === 'auto' && config.ai.anthropicApiKey)) {
    const p = new AnthropicProvider();
    if (p.isAvailable()) {
      _provider = p;
      return _provider;
    }
  }

  if (requestedProvider === 'openai' || (requestedProvider === 'auto' && config.ai.openaiApiKey)) {
    const p = new OpenAIProvider();
    if (p.isAvailable()) {
      _provider = p;
      return _provider;
    }
  }

  if (requestedProvider === 'gemini' || (requestedProvider === 'auto' && config.ai.geminiApiKey)) {
    const p = new GeminiProvider();
    if (p.isAvailable()) {
      _provider = p;
      return _provider;
    }
  }

  throw new Error(
    'No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in your environment.'
  );
}

export function resetProvider(): void {
  _provider = null;
}
