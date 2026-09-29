export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AICompletionOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  timeout?: number;
}

export interface AICompletionResult {
  content: string;
  tokensUsed: number;
  provider: string;
  model: string;
  latencyMs: number;
  costEstimate: number;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult>;
  isAvailable(): boolean;
}
