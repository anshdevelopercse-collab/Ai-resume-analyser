import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { config } from '../../config';
import type { AIProvider, AIMessage, AICompletionOptions, AICompletionResult } from './types';
import { logger } from '../../utils/logger';

// Gemini 2.0 Flash pricing per token
const COST_PER_INPUT_TOKEN = 0.0000001;   // $0.10/1M
const COST_PER_OUTPUT_TOKEN = 0.0000004;  // $0.40/1M

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  readonly model: string;
  private client: GoogleGenerativeAI;

  constructor() {
    this.model = config.ai.geminiModel;
    this.client = new GoogleGenerativeAI(config.ai.geminiApiKey);
  }

  isAvailable(): boolean {
    return Boolean(config.ai.geminiApiKey);
  }

  async complete(
    messages: AIMessage[],
    options: AICompletionOptions = {},
  ): Promise<AICompletionResult> {
    const start = Date.now();
    const maxTokens = options.maxTokens ?? config.ai.maxTokens;

    const systemPrompt = messages.find(m => m.role === 'system')?.content ?? options.systemPrompt;
    const chatMessages = messages.filter(m => m.role !== 'system');

    if (chatMessages.length === 0) throw new Error('At least one non-system message is required');

    // All messages except the final one become history
    const history = chatMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const lastMessage = chatMessages[chatMessages.length - 1];

    try {
      const genModel = this.client.getGenerativeModel({
        model: this.model,
        ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
        safetySettings: SAFETY_SETTINGS,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: options.temperature ?? 0.7,
        },
      });

      const chat = genModel.startChat({ history });
      const result = await chat.sendMessage(lastMessage.content);
      const response = result.response;
      const content = response.text();

      const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
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
      logger.error('Gemini API error', { error: err, model: this.model });
      throw new Error(`AI provider error: ${(err as Error).message}`);
    }
  }
}
