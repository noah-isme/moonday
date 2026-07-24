import { env } from '$env/dynamic/private';
import type { AIProvider, GenerateChatOptions, GenerateChatResult } from '../types';

export class ClaudeProvider implements AIProvider {
	name = 'claude' as const;

	generateChat(
		options: GenerateChatOptions & { stream: true }
	): Promise<AsyncGenerator<string, GenerateChatResult, unknown>>;
	generateChat(options: GenerateChatOptions & { stream?: false }): Promise<GenerateChatResult>;
	generateChat(
		options: GenerateChatOptions
	): Promise<GenerateChatResult | AsyncGenerator<string, GenerateChatResult, unknown>>;
	async generateChat(
		options: GenerateChatOptions
	): Promise<GenerateChatResult | AsyncGenerator<string, GenerateChatResult, unknown>> {
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
				content: m.images?.length
					? [
							...m.images.map((image) => ({
								type: 'image' as const,
								source: { type: 'base64' as const, media_type: image.mediaType, data: image.data }
							})),
							{ type: 'text' as const, text: m.content }
						]
					: m.content
			}));

		const startTime = Date.now();

		if (options.stream) {
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
					max_tokens: options.maxTokens ?? 4096,
					stream: true
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					`Claude API error: ${response.status} ${response.statusText} - ${errorText}`
				);
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error('Response body is not readable');
			}

			async function* makeGenerator() {
				const decoder = new TextDecoder();
				let buffer = '';
				let fullContent = '';
				let promptTokens: number | undefined = undefined;
				let completionTokens: number | undefined = undefined;

				try {
					while (true) {
						const { done, value } = await reader!.read();
						if (done) break;

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split(/\r?\n/);
						buffer = lines.pop() || '';

						for (const line of lines) {
							const trimmed = line.trim();
							if (!trimmed) continue;

							if (trimmed.startsWith('data: ')) {
								const jsonStr = trimmed.slice(6);
								try {
									const parsed = JSON.parse(jsonStr);
									if (parsed.type === 'message_start' && parsed.message?.usage) {
										promptTokens = parsed.message.usage.input_tokens;
									} else if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
										const delta = parsed.delta.text;
										fullContent += delta;
										yield delta;
									} else if (parsed.type === 'message_delta' && parsed.usage) {
										completionTokens = parsed.usage.output_tokens;
									}
								} catch {
									// Ignore malformed JSON chunks
								}
							}
						}
					}

					if (buffer) {
						const trimmed = buffer.trim();
						if (trimmed && trimmed.startsWith('data: ')) {
							const jsonStr = trimmed.slice(6);
							try {
								const parsed = JSON.parse(jsonStr);
								if (parsed.type === 'message_start' && parsed.message?.usage) {
									promptTokens = parsed.message.usage.input_tokens;
								} else if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
									const delta = parsed.delta.text;
									fullContent += delta;
									yield delta;
								} else if (parsed.type === 'message_delta' && parsed.usage) {
									completionTokens = parsed.usage.output_tokens;
								}
							} catch {
								// Ignore
							}
						}
					}
				} finally {
					reader!.releaseLock();
				}

				const latencyMs = Date.now() - startTime;

				return {
					content: fullContent,
					provider: 'claude' as const,
					model,
					inputTokens: promptTokens,
					outputTokens: completionTokens,
					latencyMs
				};
			}

			return makeGenerator();
		}

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

	private async generateChatStream(
		options: GenerateChatOptions
	): Promise<AsyncGenerator<string, GenerateChatResult, unknown>> {
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
				max_tokens: options.maxTokens ?? 4096,
				stream: true
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('Response body is not readable');
		}

		async function* makeGenerator() {
			const decoder = new TextDecoder();
			let buffer = '';
			let fullContent = '';
			let promptTokens: number | undefined = undefined;
			let completionTokens: number | undefined = undefined;

			try {
				while (true) {
					const { done, value } = await reader!.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split(/\r?\n/);
					buffer = lines.pop() || '';

					for (const line of lines) {
						const trimmed = line.trim();
						if (!trimmed) continue;

						if (trimmed.startsWith('data: ')) {
							const jsonStr = trimmed.slice(6);
							try {
								const parsed = JSON.parse(jsonStr);
								if (parsed.type === 'message_start') {
									promptTokens = parsed.message?.usage?.input_tokens;
								} else if (parsed.type === 'content_block_delta') {
									const delta = parsed.delta?.text || '';
									if (delta) {
										fullContent += delta;
										yield delta;
									}
								} else if (parsed.type === 'message_delta') {
									completionTokens = parsed.usage?.output_tokens;
								}
							} catch {
								// Ignore malformed JSON chunks
							}
						}
					}
				}

				if (buffer) {
					const trimmed = buffer.trim();
					if (trimmed && trimmed.startsWith('data: ')) {
						const jsonStr = trimmed.slice(6);
						try {
							const parsed = JSON.parse(jsonStr);
							if (parsed.type === 'message_start') {
								promptTokens = parsed.message?.usage?.input_tokens;
							} else if (parsed.type === 'content_block_delta') {
								const delta = parsed.delta?.text || '';
								if (delta) {
									fullContent += delta;
									yield delta;
								}
							} else if (parsed.type === 'message_delta') {
								completionTokens = parsed.usage?.output_tokens;
							}
						} catch {
							// Ignore
						}
					}
				}
			} finally {
				reader!.releaseLock();
			}

			const latencyMs = Date.now() - startTime;

			return {
				content: fullContent,
				provider: 'claude' as const,
				model,
				inputTokens: promptTokens,
				outputTokens: completionTokens,
				latencyMs
			};
		}

		return makeGenerator();
	}
}
