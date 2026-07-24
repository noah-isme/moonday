import { describe, it, expect, vi } from 'vitest';
import { AIRouter, aiRouter } from '../lib/server/ai/router';
import { env } from '$env/dynamic/private';

describe('AI Router Routing Rules', () => {
	it('should route daily_chat to DeepSeek by default', () => {
		const route = aiRouter.route('daily_chat');
		expect(route.provider).toBe('deepseek');
		expect(route.model).toBe('deepseek-chat');
	});

	it('should route memory_extract to DeepSeek by default', () => {
		const route = aiRouter.route('memory_extract');
		expect(route.provider).toBe('deepseek');
		expect(route.model).toBe('deepseek-chat');
	});

	it('should route reflection_deep to Claude by default', () => {
		const route = aiRouter.route('reflection_deep');
		expect(route.provider).toBe('claude');
		expect(route.model).toBe('claude-3-5-sonnet-latest');
	});

	it('should route emotional_reason to Claude by default', () => {
		const route = aiRouter.route('emotional_reason');
		expect(route.provider).toBe('claude');
		expect(route.model).toBe('claude-3-5-sonnet-latest');
	});

	it('should use fallback if task type is unknown or invalid', () => {
		// @ts-expect-error - testing invalid task type string
		const route = aiRouter.route('unknown_task_type');
		expect(route.provider).toBe('deepseek');
	});

	it('should support configurable/custom route settings', () => {
		const customRouter = new AIRouter({
			daily_chat: { provider: 'claude', model: 'claude-custom-model' }
		});
		const route = customRouter.route('daily_chat');
		expect(route.provider).toBe('claude');
		expect(route.model).toBe('claude-custom-model');
	});

	it('should allow dynamic/runtime route updates', () => {
		const customRouter = new AIRouter();
		customRouter.updateRoute('daily_chat', {
			provider: 'claude',
			model: 'claude-3-5-sonnet-latest'
		});
		const route = customRouter.route('daily_chat');
		expect(route.provider).toBe('claude');
		expect(route.model).toBe('claude-3-5-sonnet-latest');
	});

	it('should override provider based on API key availability (fallback to groq)', () => {
		const customRouter = new AIRouter();

		const originalDeepseek = env.DEEPSEEK_API_KEY;
		const originalClaude = env.ANTHROPIC_API_KEY;
		const originalGroq = process.env.GROQ_API_KEY;

		try {
			(env as unknown as Record<string, string | undefined>).DEEPSEEK_API_KEY = '';
			(env as unknown as Record<string, string | undefined>).ANTHROPIC_API_KEY = '';
			process.env.GROQ_API_KEY = 'mock-groq-key';

			const provider = customRouter.getProviderForTask('daily_chat');
			expect(provider.name).toBe('groq');
		} finally {
			(env as unknown as Record<string, string | undefined>).DEEPSEEK_API_KEY = originalDeepseek;
			(env as unknown as Record<string, string | undefined>).ANTHROPIC_API_KEY = originalClaude;
			process.env.GROQ_API_KEY = originalGroq;
		}
	});

	it('should use an available routed provider when the default provider is missing or unconfigured', async () => {
		const customRouter = new AIRouter();
		const originalProvider = env.DEFAULT_AI_PROVIDER;
		const originalGroq = env.GROQ_API_KEY;
		const originalProcessGroq = process.env.GROQ_API_KEY;

		try {
			(env as unknown as Record<string, string | undefined>).GROQ_API_KEY = '';
			process.env.GROQ_API_KEY = '';
			// Mock provider as unspecified (undefined)
			(env as unknown as Record<string, string | undefined>).DEFAULT_AI_PROVIDER = undefined;

			const mockResult = {
				content: 'Mocked DeepSeek reply',
				provider: 'deepseek' as const,
				model: 'deepseek-chat'
			};
			vi.spyOn(customRouter['providers'].deepseek, 'generateChat').mockResolvedValue(mockResult);

			const result = await customRouter.generateChat('daily_chat', {
				messages: [{ role: 'user', content: 'test' }],
				stream: false
			});

			expect(result).toEqual(mockResult);

			// A Groq default without a Groq key also falls back to an available provider.
			(env as unknown as Record<string, string | undefined>).DEFAULT_AI_PROVIDER = 'groq';
			const result2 = await customRouter.generateChat('daily_chat', {
				messages: [{ role: 'user', content: 'test' }],
				stream: false
			});
			expect(result2).toEqual(mockResult);
		} finally {
			(env as unknown as Record<string, string | undefined>).DEFAULT_AI_PROVIDER = originalProvider;
			(env as unknown as Record<string, string | undefined>).GROQ_API_KEY = originalGroq;
			process.env.GROQ_API_KEY = originalProcessGroq;
			vi.restoreAllMocks();
		}
	});

	it('should route to Groq when explicitly specified in options', async () => {
		const customRouter = new AIRouter();
		const mockResult = {
			content: 'Mocked Groq reply',
			provider: 'groq' as const,
			model: 'llama-3.3-70b-versatile'
		};
		vi.spyOn(customRouter['providers'].groq, 'generateChat').mockResolvedValue(mockResult);

		const result = await customRouter.generateChat('daily_chat', {
			provider: 'groq',
			messages: [{ role: 'user', content: 'test' }],
			stream: false
		});

		expect(result).toEqual(mockResult);
		vi.restoreAllMocks();
	});

	it('should retry with another available provider after a transient provider failure', async () => {
		const customRouter = new AIRouter({
			daily_chat: { provider: 'deepseek', model: 'deepseek-chat' }
		});
		const originalDefault = env.DEFAULT_AI_PROVIDER;
		(env as unknown as Record<string, string | undefined>).DEFAULT_AI_PROVIDER = undefined;

		try {
			vi.spyOn(customRouter as AIRouter, 'isProviderAvailable').mockReturnValue(true);
			const transientError = Object.assign(new Error('DeepSeek API error: 503 unavailable'), {
				status: 503
			});
			vi.spyOn(customRouter['providers'].deepseek, 'generateChat').mockRejectedValue(
				transientError
			);
			vi.spyOn(customRouter['providers'].groq, 'generateChat').mockResolvedValue({
				content: 'Fallback reply',
				provider: 'groq',
				model: 'llama-3.3-70b-versatile'
			});

			const result = await customRouter.generateChat('daily_chat', {
				messages: [{ role: 'user', content: 'test' }],
				stream: false
			});

			expect(result.provider).toBe('groq');
			expect(customRouter['providers'].groq.generateChat).toHaveBeenCalledOnce();
		} finally {
			(env as unknown as Record<string, string | undefined>).DEFAULT_AI_PROVIDER = originalDefault;
			vi.restoreAllMocks();
		}
	});
});
