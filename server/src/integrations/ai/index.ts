import { config } from '../../config';
import { AnthropicProvider } from './anthropicProvider';
import { OpenAIProvider } from './openaiProvider';
import { DemoProvider } from './demoProvider';
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

  _provider = new DemoProvider();
  return _provider;
}

export function resetProvider(): void {
  _provider = null;
}

export function isDemoMode(): boolean {
  return getAIProvider().name === 'demo';
}
