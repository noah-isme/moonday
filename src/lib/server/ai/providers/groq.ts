import { env } from '$env/dynamic/private';
import type { AIProvider, GenerateChatOptions, GenerateChatResult } from '../types';

async function handleResponseError(response: Response): Promise<never> {
	const errorText = await response.text();
	let errorMessage = `Groq API error: ${response.status} ${response.statusText}`;

	if (response.status === 401) {
		errorMessage = 'Unauthorized access to Groq: Please verify your GROQ_API_KEY.';
	} else if (response.status === 429) {
		errorMessage = 'Groq API rate limit exceeded. Please try again later.';
	} else if (response.status >= 500) {
		errorMessage = 'Groq service error: The AI provider is temporarily unavailable.';
	} else {
		try {
			const parsed = JSON.parse(errorText);
			if (parsed.error?.message) {
				errorMessage = `Groq API error: ${parsed.error.message}`;
			}
		} catch {
			if (errorText) {
				errorMessage += ` - ${errorText}`;
			}
		}
	}

	const error = new Error(errorMessage);
	(error as any).status = response.status;
	throw error;
}

export class GroqProvider implements AIProvider {
	name = 'groq' as const;

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
		if (options.stream) {
			return this.generateChatStream(options);
		}
		return this.generateChatStandard(options);
	}

	private async generateChatStandard(options: GenerateChatOptions): Promise<GenerateChatResult> {
		const apiKey = process.env.GROQ_API_KEY || env.GROQ_API_KEY;
		if (!apiKey) {
			throw new Error('GROQ_API_KEY is not set');
		}

		const model = options.model || env.DEFAULT_AI_MODEL || 'llama3-70b-8192';

		const startTime = Date.now();
		let response: Response;
		try {
			response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
		} catch (e: any) {
			const networkError = new Error(`Groq network error: ${e.message || e}`);
			(networkError as any).status = 500;
			throw networkError;
		}

		if (!response.ok) {
			await handleResponseError(response);
		}

		const data = (await response.json()) as {
			choices?: Array<{ message?: { content: string } }>;
			usage?: { prompt_tokens?: number; completion_tokens?: number };
		};
		const latencyMs = Date.now() - startTime;
		const content = data.choices?.[0]?.message?.content || '';

		return {
			content,
			provider: 'groq',
			model,
			inputTokens: data.usage?.prompt_tokens,
			outputTokens: data.usage?.completion_tokens,
			latencyMs
		};
	}

	private async generateChatStream(
		options: GenerateChatOptions
	): Promise<AsyncGenerator<string, GenerateChatResult, unknown>> {
		const apiKey = process.env.GROQ_API_KEY || env.GROQ_API_KEY;
		if (!apiKey) {
			throw new Error('GROQ_API_KEY is not set');
		}

		const model = options.model || env.DEFAULT_AI_MODEL || 'llama3-70b-8192';

		const startTime = Date.now();
		let response: Response;
		try {
			response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					model,
					messages: options.messages,
					temperature: options.temperature ?? 0.7,
					max_tokens: options.maxTokens ?? 2048,
					stream: true,
					stream_options: {
						include_usage: true
					}
				})
			});
		} catch (e: any) {
			const networkError = new Error(`Groq network error: ${e.message || e}`);
			(networkError as any).status = 500;
			throw networkError;
		}

		if (!response.ok) {
			await handleResponseError(response);
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
						if (trimmed === 'data: [DONE]') continue;

						if (trimmed.startsWith('data: ')) {
							const jsonStr = trimmed.slice(6);
							try {
								const parsed = JSON.parse(jsonStr);
								const delta = parsed.choices?.[0]?.delta?.content || '';
								if (delta) {
									fullContent += delta;
									yield delta;
								}
								if (parsed.usage) {
									promptTokens = parsed.usage.prompt_tokens;
									completionTokens = parsed.usage.completion_tokens;
								}
							} catch (e) {
								// Ignore malformed JSON chunks
							}
						}
					}
				}

				if (buffer) {
					const trimmed = buffer.trim();
					if (trimmed && trimmed !== 'data: [DONE]' && trimmed.startsWith('data: ')) {
						const jsonStr = trimmed.slice(6);
						try {
							const parsed = JSON.parse(jsonStr);
							const delta = parsed.choices?.[0]?.delta?.content || '';
							if (delta) {
								fullContent += delta;
								yield delta;
							}
							if (parsed.usage) {
								promptTokens = parsed.usage.prompt_tokens;
								completionTokens = parsed.usage.completion_tokens;
							}
						} catch (e) {
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
				provider: 'groq' as const,
				model,
				inputTokens: promptTokens,
				outputTokens: completionTokens,
				latencyMs
			};
		}

		return makeGenerator();
	}
}
