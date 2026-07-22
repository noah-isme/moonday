export type AIProviderName = 'deepseek' | 'claude' | 'groq';

export type ChatMessage = {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	name?: string;
	tool_call_id?: string;
	tool_calls?: any[];
	images?: Array<{ mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string }>;
};

export type GenerateChatOptions = {
	provider?: AIProviderName;
	model?: string;
	messages: ChatMessage[];
	temperature?: number;
	maxTokens?: number;
	stream?: boolean;
	enableWebSearch?: boolean;
};

export type GenerateChatResult = {
	content: string;
	provider: AIProviderName;
	model: string;
	inputTokens?: number;
	outputTokens?: number;
	latencyMs?: number;
};

export type ChatStreamChunk =
	string | { type: 'token'; content: string } | { type: 'status'; message: string };

export interface AIProvider {
	name: AIProviderName;
	generateChat(
		options: GenerateChatOptions & { stream: true }
	): Promise<AsyncGenerator<ChatStreamChunk, GenerateChatResult, unknown>>;
	generateChat(options: GenerateChatOptions & { stream?: false }): Promise<GenerateChatResult>;
	generateChat(
		options: GenerateChatOptions
	): Promise<GenerateChatResult | AsyncGenerator<ChatStreamChunk, GenerateChatResult, unknown>>;
}
