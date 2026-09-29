import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config';
import type { AIProvider, AIMessage, AICompletionOptions, AICompletionResult } from './types';
import { logger } from '../../utils/logger';

// Approximate cost per 1M tokens for claude-haiku
const COST_PER_INPUT_TOKEN = 0.00000025;
const COST_PER_OUTPUT_TOKEN = 0.00000125;

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  readonly model: string;
  private client: Anthropic;

  constructor() {
    this.model = config.ai.anthropicModel;
    this.client = new Anthropic({
      apiKey: config.ai.anthropicApiKey,
      timeout: config.ai.timeout,
    });
  }

  isAvailable(): boolean {
    return Boolean(config.ai.anthropicApiKey);
  }

  async complete(
    messages: AIMessage[],
    options: AICompletionOptions = {}
  ): Promise<AICompletionResult> {
    const start = Date.now();
    const maxTokens = options.maxTokens ?? config.ai.maxTokens;

    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const systemMsg = messages.find(m => m.role === 'system')?.content ||
      options.systemPrompt;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        system: systemMsg,
        messages: anthropicMessages,
      });

      const content = response.content[0]?.type === 'text'
        ? response.content[0].text
        : '';

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const tokensUsed = inputTokens + outputTokens;
      const costEstimate = (inputTokens * COST_PER_INPUT_TOKEN) + (outputTokens * COST_PER_OUTPUT_TOKEN);

      return {
        content,
        tokensUsed,
        provider: this.name,
        model: this.model,
        latencyMs: Date.now() - start,
        costEstimate,
      };
    } catch (err) {
      logger.error('Anthropic API error', { error: err, model: this.model });
      throw new Error(`AI provider error: ${(err as Error).message}`);
    }
  }
}
