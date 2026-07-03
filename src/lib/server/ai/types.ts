export type AIProviderName = 'deepseek' | 'claude' | 'groq';

export type ChatMessage = {
	role: 'system' | 'user' | 'assistant';
	content: string;
};

export type GenerateChatOptions = {
	provider?: AIProviderName;
	model?: string;
	messages: ChatMessage[];
	temperature?: number;
	maxTokens?: number;
	stream?: boolean;
};

export type GenerateChatResult = {
	content: string;
	provider: AIProviderName;
	model: string;
	inputTokens?: number;
	outputTokens?: number;
	latencyMs?: number;
};

export interface AIProvider {
	name: AIProviderName;
	generateChat(
		options: GenerateChatOptions & { stream: true }
	): Promise<AsyncGenerator<string, GenerateChatResult, unknown>>;
	generateChat(options: GenerateChatOptions & { stream?: false }): Promise<GenerateChatResult>;
	generateChat(
		options: GenerateChatOptions
	): Promise<GenerateChatResult | AsyncGenerator<string, GenerateChatResult, unknown>>;
}
