import { env } from '$env/dynamic/private';
import type { AIProvider, GenerateChatOptions, GenerateChatResult } from '../types';

export class DeepSeekProvider implements AIProvider {
	name = 'deepseek' as const;

	async generateChat(options: GenerateChatOptions): Promise<GenerateChatResult> {
		const apiKey = env.DEEPSEEK_API_KEY;
		if (!apiKey) {
			throw new Error('DEEPSEEK_API_KEY is not set');
		}

		const baseUrl = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
		const model = options.model || env.DEFAULT_AI_MODEL || 'deepseek-chat';

		const startTime = Date.now();
		const response = await fetch(`${baseUrl}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model,
				messages: options.messages,
				temperature: options.temperature ?? 0.7,
				max_tokens: options.maxTokens ?? 2048
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`
			);
		}

		const data = (await response.json()) as {
			choices?: Array<{ message?: { content: string } }>;
			usage?: { prompt_tokens?: number; completion_tokens?: number };
		};
		const latencyMs = Date.now() - startTime;
		const content = data.choices?.[0]?.message?.content || '';

		return {
			content,
			provider: 'deepseek',
			model,
			inputTokens: data.usage?.prompt_tokens,
			outputTokens: data.usage?.completion_tokens,
			latencyMs
		};
	}
}
