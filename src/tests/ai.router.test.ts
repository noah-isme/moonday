import { describe, it, expect } from 'vitest';
import { AIRouter, aiRouter } from '../lib/server/ai/router';

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
		// @ts-ignore
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
});
