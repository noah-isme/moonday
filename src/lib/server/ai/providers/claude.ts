import { env } from '$env/dynamic/private';
import type { AIProvider, GenerateChatOptions, GenerateChatResult } from '../types';

export class ClaudeProvider implements AIProvider {
	name = 'claude' as const;

	async generateChat(options: GenerateChatOptions): Promise<GenerateChatResult> {
		const apiKey = env.ANTHROPIC_API_KEY;
		if (!apiKey) {
			throw new Error('ANTHROPIC_API_KEY is not set');
		}

		const model = options.model || env.CLAUDE_MODEL || 'claude-3-5-sonnet-latest';

		// Claude API requires system prompt as a separate field, not in messages array
		const systemMessage = options.messages.find((m) => m.role === 'system');
		const apiMessages = options.messages
			.filter((m) => m.role !== 'system')
			.map((m) => ({
				role: m.role as 'user' | 'assistant',
				content: m.content
			}));

		const startTime = Date.now();
		const response = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model,
				messages: apiMessages,
				system: systemMessage?.content,
				temperature: options.temperature ?? 0.7,
				max_tokens: options.maxTokens ?? 4096
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`);
		}

		const data = (await response.json()) as {
			content?: Array<{ text: string }>;
			usage?: { input_tokens?: number; output_tokens?: number };
		};
		const latencyMs = Date.now() - startTime;
		const content = data.content?.[0]?.text || '';

		return {
			content,
			provider: 'claude',
			model,
			inputTokens: data.usage?.input_tokens,
			outputTokens: data.usage?.output_tokens,
			latencyMs
		};
	}
}
