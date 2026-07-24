import { describe, it, expect, vi, afterEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { DeepSeekProvider } from '../lib/server/ai/providers/deepseek';
import { ClaudeProvider } from '../lib/server/ai/providers/claude';
import { GroqProvider } from '../lib/server/ai/providers/groq';
import { POST as chatPOST } from '../routes/api/chat/+server';
import { aiRouter } from '../lib/server/ai/router';
import type { ChatStreamChunk, GenerateChatResult } from '../lib/server/ai/types';

function createMockChatEvent(request: Request): RequestEvent<Record<string, string>, '/api/chat'> {
	return {
		request,
		params: {},
		route: { id: '/api/chat' },
		url: new URL(request.url),
		platform: undefined,
		locals: {},
		cookies: {
			get: () => undefined,
			set: () => {},
			delete: () => {}
		},
		fetch: () => Promise.resolve(new Response()),
		getClientAddress: () => '127.0.0.1',
		routePattern: '/api/chat'
	} as unknown as RequestEvent<Record<string, string>, '/api/chat'>;
}

vi.mock('$env/dynamic/private', async () => {
	const fs = await import('fs');
	const path = await import('path');
	const dotenvPath = path.default.resolve(process.cwd(), '.env');
	let databaseUrl = 'postgres://buroq_user:buroq_pass@localhost:5433/moonday';
	try {
		const dotenvContent = fs.readFileSync(dotenvPath, 'utf8');
		const match = dotenvContent.match(/DATABASE_URL=["']?([^"'\s]+)["']?/);
		if (match) {
			databaseUrl = match[1];
		}
	} catch {
		if (process.env.DATABASE_URL) {
			databaseUrl = process.env.DATABASE_URL;
		}
	}

	return {
		env: {
			DATABASE_URL: databaseUrl,
			DEEPSEEK_API_KEY: 'mock-deepseek-key',
			ANTHROPIC_API_KEY: 'mock-claude-key',
			GROQ_API_KEY: 'mock-groq-key',
			DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
			CLAUDE_MODEL: 'claude-3-5-sonnet-latest',
			DEFAULT_AI_MODEL: 'deepseek-chat',
			ENABLE_VECTOR_SEARCH: 'true',
			ENABLE_MEMORY_EXTRACTION: 'true',
			ENCRYPTION_KEY: 'abcdefghijklmnopqrstuvwxyz123456'
		}
	};
});

// Helper to mock readable stream responses
function createMockStreamResponse(chunks: string[]) {
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			for (const chunk of chunks) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		}
	});

	return {
		ok: true,
		status: 200,
		body: stream,
		headers: new Headers()
	} as unknown as Response;
}

describe('AI Streaming Providers', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('DeepSeekProvider should parse OpenAI SSE chunks and yield content', async () => {
		const provider = new DeepSeekProvider();

		const mockResponse = createMockStreamResponse([
			'data: {"choices":[{"delta":{"content":"Hello"}}],"usage":null}\n',
			'data: {"choices":[{"delta":{"content":" world"}}],"usage":null}\n',
			'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n',
			'data: [DONE]\n'
		]);

		vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

		const stream = await provider.generateChat({
			messages: [{ role: 'user', content: 'Hi' }],
			stream: true
		});

		const chunks: string[] = [];
		const iterator = stream[Symbol.asyncIterator]();

		while (true) {
			const { done, value } = await iterator.next();
			if (done) {
				expect(value).toEqual({
					content: 'Hello world',
					provider: 'deepseek',
					model: 'deepseek-chat',
					inputTokens: 10,
					outputTokens: 5,
					latencyMs: expect.any(Number)
				});
				break;
			}
			chunks.push(value as string);
		}

		expect(chunks).toEqual(['Hello', ' world']);
	});

	it('ClaudeProvider should parse Anthropic SSE events and yield content', async () => {
		const provider = new ClaudeProvider();

		const mockResponse = createMockStreamResponse([
			'event: message_start\n',
			'data: {"type":"message_start","message":{"usage":{"input_tokens":15}}}\n\n',
			'event: content_block_start\n',
			'data: {"type":"content_block_start"}\n\n',
			'event: content_block_delta\n',
			'data: {"type":"content_block_delta","delta":{"type":"text","text":"Hi there"}}\n\n',
			'event: message_delta\n',
			'data: {"type":"message_delta","usage":{"output_tokens":8}}\n\n',
			'event: message_stop\n',
			'data: {"type":"message_stop"}\n\n'
		]);

		vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

		const stream = await provider.generateChat({
			messages: [{ role: 'user', content: 'Hello' }],
			stream: true
		});

		const chunks: string[] = [];
		const iterator = stream[Symbol.asyncIterator]();

		while (true) {
			const { done, value } = await iterator.next();
			if (done) {
				expect(value).toEqual({
					content: 'Hi there',
					provider: 'claude',
					model: 'claude-3-5-sonnet-latest',
					inputTokens: 15,
					outputTokens: 8,
					latencyMs: expect.any(Number)
				});
				break;
			}
			chunks.push(value as string);
		}

		expect(chunks).toEqual(['Hi there']);
	});

	it('GroqProvider should parse OpenAI SSE chunks and yield content', async () => {
		const provider = new GroqProvider();

		const mockResponse = createMockStreamResponse([
			'data: {"choices":[{"delta":{"content":"Hello"}}],"usage":null}\n',
			'data: {"choices":[{"delta":{"content":" Groq"}}],"usage":null}\n',
			'data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":6}}\n',
			'data: [DONE]\n'
		]);

		vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

		const stream = await provider.generateChat({
			model: 'llama-3.3-70b-versatile',
			messages: [{ role: 'user', content: 'Hi' }],
			stream: true
		});

		const chunks: string[] = [];
		const iterator = stream[Symbol.asyncIterator]();

		while (true) {
			const { done, value } = await iterator.next();
			if (done) {
				expect(value).toEqual({
					content: 'Hello Groq',
					provider: 'groq',
					model: 'llama-3.3-70b-versatile',
					inputTokens: 12,
					outputTokens: 6,
					latencyMs: expect.any(Number)
				});
				break;
			}
			chunks.push(value as string);
		}

		expect(chunks).toEqual(['Hello', ' Groq']);
	});

	it('GroqProvider should handle standard non-stream responses', async () => {
		const provider = new GroqProvider();

		const mockResponse = {
			ok: true,
			status: 200,
			json: async () => ({
				choices: [{ message: { content: 'Hello standard Groq' } }],
				usage: { prompt_tokens: 15, completion_tokens: 7 }
			})
		} as Response;

		vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

		const result = await provider.generateChat({
			model: 'llama-3.3-70b-versatile',
			messages: [{ role: 'user', content: 'Hi' }],
			stream: false
		});

		expect(result).toEqual({
			content: 'Hello standard Groq',
			provider: 'groq',
			model: 'llama-3.3-70b-versatile',
			inputTokens: 15,
			outputTokens: 7,
			latencyMs: expect.any(Number)
		});
	});

	it('GroqProvider should handle 401 error responses', async () => {
		const provider = new GroqProvider();

		const mockResponse = {
			ok: false,
			status: 401,
			statusText: 'Unauthorized',
			text: async () => 'Invalid API Key'
		} as Response;

		vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

		await expect(
			provider.generateChat({
				model: 'llama-3.3-70b-versatile',
				messages: [{ role: 'user', content: 'Hi' }],
				stream: false
			})
		).rejects.toThrow('Unauthorized access to Groq: Please verify your GROQ_API_KEY.');
	});
});

describe('SvelteKit POST /api/chat SSE endpoint', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return a text/event-stream response and yield correct events', async () => {
		async function* mockGenerator() {
			yield 'Hello';
			yield ' world';
			return {
				content: 'Hello world',
				provider: 'deepseek' as const,
				model: 'deepseek-chat',
				inputTokens: 12,
				outputTokens: 6,
				latencyMs: 150
			};
		}

		vi.spyOn(aiRouter, 'generateChat').mockImplementation(async (taskType, options) => {
			if (options.stream) {
				return mockGenerator() as unknown as AsyncGenerator<
					ChatStreamChunk,
					GenerateChatResult,
					unknown
				>;
			}
			return {
				content: 'Hello world',
				provider: 'deepseek' as const,
				model: 'deepseek-chat'
			};
		});

		const request = new Request('http://localhost/api/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				message: 'Test message for SSE stream',
				stream: true
			})
		});

		const mockEvent = createMockChatEvent(request);
		const response = await chatPOST(mockEvent);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('text/event-stream');
		expect(response.headers.get('Cache-Control')).toBe('no-cache');
		expect(response.headers.get('Connection')).toBe('keep-alive');

		const reader = response.body?.getReader();
		expect(reader).toBeDefined();

		const decoder = new TextDecoder();
		let buffer = '';
		const parsedEvents: unknown[] = [];

		while (true) {
			const { done, value } = await reader!.read();
			if (done) break;

			buffer += decoder.decode(value);
			const lines = buffer.split(/\r?\n/);
			buffer = lines.pop() || '';

			for (const line of lines) {
				if (line.startsWith('data: ')) {
					parsedEvents.push(JSON.parse(line.slice(6)));
				}
			}
		}

		expect(parsedEvents).toContainEqual(expect.objectContaining({ type: 'start' }));
		expect(parsedEvents).toContainEqual({ type: 'token', content: 'Hello' });
		expect(parsedEvents).toContainEqual({ type: 'token', content: ' world' });
		expect(parsedEvents).toContainEqual(
			expect.objectContaining({
				type: 'done',
				savedMemory: expect.any(Boolean),
				assistantMessageId: expect.any(String)
			})
		);
	});
});
