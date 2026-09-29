import OpenAI from 'openai';
import { config } from '../../config';
import type { AIProvider, AIMessage, AICompletionOptions, AICompletionResult } from './types';
import { logger } from '../../utils/logger';

const COST_PER_TOKEN = 0.00000015;

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  readonly model: string;
  private client: OpenAI;

  constructor() {
    this.model = config.ai.openaiModel;
    this.client = new OpenAI({
      apiKey: config.ai.openaiApiKey,
      timeout: config.ai.timeout,
    });
  }

  isAvailable(): boolean {
    return Boolean(config.ai.openaiApiKey);
  }

  async complete(
    messages: AIMessage[],
    options: AICompletionOptions = {}
  ): Promise<AICompletionResult> {
    const start = Date.now();
    const maxTokens = options.maxTokens ?? config.ai.maxTokens;

    const openaiMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: maxTokens,
        messages: openaiMessages,
      });

      const content = response.choices[0]?.message?.content ?? '';
      const tokensUsed = response.usage?.total_tokens ?? 0;
      const costEstimate = tokensUsed * COST_PER_TOKEN;

      return {
        content,
        tokensUsed,
        provider: this.name,
        model: this.model,
        latencyMs: Date.now() - start,
        costEstimate,
      };
    } catch (err) {
      logger.error('OpenAI API error', { error: err, model: this.model });
      throw new Error(`AI provider error: ${(err as Error).message}`);
    }
  }
}
