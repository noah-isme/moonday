export type AIProviderName = 'deepseek' | 'claude';

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
	generateChat(options: GenerateChatOptions): Promise<GenerateChatResult>;
}
