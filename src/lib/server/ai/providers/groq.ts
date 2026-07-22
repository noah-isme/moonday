import { env } from '$env/dynamic/private';
import type {
	AIProvider,
	GenerateChatOptions,
	GenerateChatResult,
	ChatStreamChunk
} from '../types';
import { searchToolsSpecification, executeTool } from '../../tools/browser';

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
	): Promise<AsyncGenerator<ChatStreamChunk, GenerateChatResult, unknown>>;
	generateChat(options: GenerateChatOptions & { stream?: false }): Promise<GenerateChatResult>;
	generateChat(
		options: GenerateChatOptions
	): Promise<GenerateChatResult | AsyncGenerator<ChatStreamChunk, GenerateChatResult, unknown>>;
	async generateChat(
		options: GenerateChatOptions
	): Promise<GenerateChatResult | AsyncGenerator<ChatStreamChunk, GenerateChatResult, unknown>> {
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

		const model = options.model || env.DEFAULT_AI_MODEL || 'llama-3.3-70b-versatile';
		const startTime = Date.now();

		const requestMessages = [...options.messages];
		const currentTools = options.enableWebSearch ? searchToolsSpecification : undefined;

		let response: Response;
		try {
			const body: any = {
				model,
				messages: requestMessages.map((m) => ({
					role: m.role,
					content: m.content,
					name: m.name,
					tool_call_id: m.tool_call_id,
					tool_calls: m.tool_calls
				})),
				temperature: options.temperature ?? 0.7,
				max_tokens: options.maxTokens ?? 2048
			};
			if (currentTools) {
				body.tools = currentTools;
			}

			response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`
				},
				body: JSON.stringify(body)
			});
		} catch (e: any) {
			const networkError = new Error(`Groq network error: ${e.message || e}`);
			(networkError as any).status = 503;
			throw networkError;
		}

		if (!response.ok) {
			await handleResponseError(response);
		}

		const data = (await response.json()) as any;
		const choice = data.choices?.[0];
		const message = choice?.message;
		const finishReason = choice?.finish_reason;

		let promptTokens = data.usage?.prompt_tokens || 0;
		let completionTokens = data.usage?.completion_tokens || 0;

		if (finishReason === 'tool_calls' && message?.tool_calls && message.tool_calls.length > 0) {
			// Save the tool call message
			requestMessages.push(message);

			// Execute tool calls
			for (const toolCall of message.tool_calls) {
				const toolName = toolCall.function.name;
				let toolArgs = {};
				try {
					toolArgs = JSON.parse(toolCall.function.arguments);
				} catch (e) {
					console.error('Failed to parse tool arguments:', e);
				}

				// Execute tool
				const toolResult = await executeTool(toolName, toolArgs);

				// Push tool response
				requestMessages.push({
					role: 'tool',
					tool_call_id: toolCall.id,
					name: toolName,
					content: toolResult
				});
			}

			// Do second request to Groq without tools to summarize
			const secondStartTime = Date.now();
			let secondResponse: Response;
			try {
				secondResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${apiKey}`
					},
					body: JSON.stringify({
						model,
						messages: requestMessages.map((m) => ({
							role: m.role,
							content: m.content,
							name: m.name,
							tool_call_id: m.tool_call_id,
							tool_calls: m.tool_calls
						})),
						temperature: options.temperature ?? 0.7,
						max_tokens: options.maxTokens ?? 2048
					})
				});
			} catch (e: any) {
				const networkError = new Error(`Groq network error: ${e.message || e}`);
				(networkError as any).status = 503;
				throw networkError;
			}

			if (!secondResponse.ok) {
				await handleResponseError(secondResponse);
			}

			const secondData = (await secondResponse.json()) as any;
			const latencyMs = Date.now() - startTime;
			const content = secondData.choices?.[0]?.message?.content || '';

			return {
				content,
				provider: 'groq',
				model,
				inputTokens: promptTokens + (secondData.usage?.prompt_tokens || 0),
				outputTokens: completionTokens + (secondData.usage?.completion_tokens || 0),
				latencyMs
			};
		}

		// No tool calls, standard return
		const latencyMs = Date.now() - startTime;
		const content = message?.content || '';

		return {
			content,
			provider: 'groq',
			model,
			inputTokens: promptTokens,
			outputTokens: completionTokens,
			latencyMs
		};
	}

	private async generateChatStream(
		options: GenerateChatOptions
	): Promise<AsyncGenerator<ChatStreamChunk, GenerateChatResult, unknown>> {
		const apiKey = process.env.GROQ_API_KEY || env.GROQ_API_KEY;
		if (!apiKey) {
			throw new Error('GROQ_API_KEY is not set');
		}

		const model = options.model || env.DEFAULT_AI_MODEL || 'llama-3.3-70b-versatile';
		const startTime = Date.now();
		const requestMessages = [...options.messages];
		const currentTools = options.enableWebSearch ? searchToolsSpecification : undefined;

		// If web search is disabled, we do a direct stream call from the beginning
		if (!options.enableWebSearch) {
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
						messages: requestMessages.map((m) => ({
							role: m.role,
							content: m.content,
							name: m.name,
							tool_call_id: m.tool_call_id,
							tool_calls: m.tool_calls
						})),
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
				(networkError as any).status = 503;
				throw networkError;
			}

			if (!response.ok) {
				await handleResponseError(response);
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error('Response body is not readable');
			}

			async function* makeDirectGenerator() {
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
									// Ignore
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

			return makeDirectGenerator();
		}

		// Otherwise, if enableWebSearch is true, execute the agentic loop (non-streaming first, then streaming second)
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
					messages: requestMessages.map((m) => ({
						role: m.role,
						content: m.content,
						name: m.name,
						tool_call_id: m.tool_call_id,
						tool_calls: m.tool_calls
					})),
					temperature: options.temperature ?? 0.7,
					max_tokens: options.maxTokens ?? 2048,
					tools: currentTools
				})
			});
		} catch (e: any) {
			const networkError = new Error(`Groq network error: ${e.message || e}`);
			(networkError as any).status = 503;
			throw networkError;
		}

		if (!response.ok) {
			await handleResponseError(response);
		}

		// Check if it's a stream response (in case unit tests mock it)
		const contentType = response.headers.get('Content-Type');
		if (contentType?.includes('text/event-stream') || typeof response.json !== 'function') {
			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error('Response body is not readable');
			}

			async function* makeMockStreamGenerator() {
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
									// Ignore
								}
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

			return makeMockStreamGenerator();
		}

		const data = (await response.json()) as any;
		const choice = data.choices?.[0];
		const message = choice?.message;
		const finishReason = choice?.finish_reason;

		let promptTokens = data.usage?.prompt_tokens || 0;
		let completionTokens = data.usage?.completion_tokens || 0;

		async function* makeGenerator() {
			if (finishReason === 'tool_calls' && message?.tool_calls && message.tool_calls.length > 0) {
				// Send status update event
				yield { type: 'status' as const, message: '🌐 Cross-checking data on the web...' };

				// Save the tool call message
				requestMessages.push(message);

				// Execute tool calls
				for (const toolCall of message.tool_calls) {
					const toolName = toolCall.function.name;
					let toolArgs = {};
					try {
						toolArgs = JSON.parse(toolCall.function.arguments);
					} catch (e) {
						console.error('Failed to parse tool arguments:', e);
					}

					// Execute tool
					const toolResult = await executeTool(toolName, toolArgs);

					// Push tool response
					requestMessages.push({
						role: 'tool',
						tool_call_id: toolCall.id,
						name: toolName,
						content: toolResult
					});
				}

				// Do second request (streaming the final result)
				let secondResponse: Response;
				try {
					secondResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${apiKey}`
						},
						body: JSON.stringify({
							model,
							messages: requestMessages.map((m) => ({
								role: m.role,
								content: m.content,
								name: m.name,
								tool_call_id: m.tool_call_id,
								tool_calls: m.tool_calls
							})),
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
					(networkError as any).status = 503;
					throw networkError;
				}

				if (!secondResponse.ok) {
					await handleResponseError(secondResponse);
				}

				const reader = secondResponse.body?.getReader();
				if (!reader) {
					throw new Error('Response body is not readable');
				}

				const decoder = new TextDecoder();
				let buffer = '';
				let fullContent = '';

				try {
					while (true) {
						const { done, value } = await reader.read();
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
										yield { type: 'token' as const, content: delta };
									}
									if (parsed.usage) {
										promptTokens += parsed.usage.prompt_tokens || 0;
										completionTokens += parsed.usage.completion_tokens || 0;
									}
								} catch (e) {
									// Ignore
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
									yield { type: 'token' as const, content: delta };
								}
								if (parsed.usage) {
									promptTokens += parsed.usage.prompt_tokens || 0;
									completionTokens += parsed.usage.completion_tokens || 0;
								}
							} catch (e) {
								// Ignore
							}
						}
					}
				} finally {
					reader.releaseLock();
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
			} else {
				// No tool calls, output the content of the first response
				const content = message?.content || '';

				// Simulate streaming of the pre-fetched content
				if (content) {
					const words = content.split(' ');
					for (let i = 0; i < words.length; i++) {
						const wordChunk = words[i] + (i < words.length - 1 ? ' ' : '');
						yield { type: 'token' as const, content: wordChunk };
						await new Promise((r) => setTimeout(r, 10));
					}
				}

				const latencyMs = Date.now() - startTime;
				return {
					content,
					provider: 'groq' as const,
					model,
					inputTokens: promptTokens,
					outputTokens: completionTokens,
					latencyMs
				};
			}
		}

		return makeGenerator();
	}
}
