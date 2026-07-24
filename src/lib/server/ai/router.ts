import { env } from '$env/dynamic/private';
import { ClaudeProvider } from './providers/claude';
import { DeepSeekProvider } from './providers/deepseek';
import { GroqProvider } from './providers/groq';
import type {
	AIProvider,
	AIProviderName,
	GenerateChatOptions,
	GenerateChatResult,
	ChatStreamChunk
} from './types';

export type RoutingTaskType =
	'daily_chat' | 'memory_extract' | 'reflection_deep' | 'emotional_reason' | 'fallback';

export class AIRouter {
	private providers: Record<AIProviderName, AIProvider>;
	private routes: Record<RoutingTaskType, { provider: AIProviderName; model: string }>;

	constructor(
		customRoutes?: Partial<Record<RoutingTaskType, { provider: AIProviderName; model: string }>>
	) {
		this.providers = {
			claude: new ClaudeProvider(),
			deepseek: new DeepSeekProvider(),
			groq: new GroqProvider()
		};

		this.routes = {
			daily_chat: { provider: 'deepseek', model: 'deepseek-chat' },
			memory_extract: { provider: 'deepseek', model: 'deepseek-chat' },
			reflection_deep: { provider: 'claude', model: 'claude-3-5-sonnet-latest' },
			emotional_reason: { provider: 'claude', model: 'claude-3-5-sonnet-latest' },
			fallback: { provider: 'deepseek', model: 'deepseek-chat' }
		};

		if (customRoutes) {
			for (const key of Object.keys(customRoutes) as RoutingTaskType[]) {
				if (customRoutes[key]) {
					this.routes[key] = customRoutes[key]!;
				}
			}
		}
	}

	route(taskType: RoutingTaskType): { provider: AIProviderName; model: string } {
		const r = this.routes[taskType] || this.routes['fallback'];
		return { ...r };
	}

	updateRoute(
		taskType: RoutingTaskType,
		config: { provider: AIProviderName; model: string }
	): void {
		this.routes[taskType] = config;
	}

	getProviderForTask(taskType: RoutingTaskType): AIProvider {
		const config = this.route(taskType);
		let providerName = config.provider;

		// Override based on API key availability (robust fallback)
		const hasDeepseekKey = !!env.DEEPSEEK_API_KEY;
		const hasClaudeKey = !!env.ANTHROPIC_API_KEY;
		const hasGroqKey = !!process.env.GROQ_API_KEY || !!env.GROQ_API_KEY;

		const isAvailable = (name: AIProviderName) => {
			if (name === 'deepseek') return hasDeepseekKey;
			if (name === 'claude') return hasClaudeKey;
			if (name === 'groq') return hasGroqKey;
			return false;
		};

		if (!isAvailable(providerName)) {
			// Find first available provider in preferred order: groq, deepseek, claude
			const order: AIProviderName[] = ['groq', 'deepseek', 'claude'];
			const fallback = order.find(isAvailable);
			if (fallback) {
				providerName = fallback;
			}
		}

		return this.providers[providerName];
	}

	isProviderAvailable(name: AIProviderName): boolean {
		if (name === 'deepseek') return !!env.DEEPSEEK_API_KEY;
		if (name === 'claude') return !!env.ANTHROPIC_API_KEY;
		return !!(process.env.GROQ_API_KEY || env.GROQ_API_KEY);
	}

	private fallbackCandidates(taskType: RoutingTaskType, requestedProvider?: AIProviderName) {
		const routeProvider = this.route(taskType).provider;
		const configuredDefault = env.DEFAULT_AI_PROVIDER as AIProviderName | undefined;
		const preferred = requestedProvider || configuredDefault || routeProvider;
		const available = (['groq', 'deepseek', 'claude'] as AIProviderName[]).filter((provider) =>
			this.isProviderAvailable(provider)
		);

		// Keep the routed provider as a final candidate in test/local environments
		// where credentials may be injected by the provider mock instead of env.
		return [...new Set<AIProviderName>([preferred, ...available, routeProvider])];
	}

	private modelFor(provider: AIProviderName, taskType: RoutingTaskType) {
		const route = this.route(taskType);
		if (provider === route.provider) return route.model;
		if (provider === 'groq') {
			return (
				(env.DEFAULT_AI_PROVIDER === 'groq' && env.DEFAULT_AI_MODEL) || 'llama-3.3-70b-versatile'
			);
		}
		if (provider === 'deepseek') {
			return (env.DEFAULT_AI_PROVIDER === 'deepseek' && env.DEFAULT_AI_MODEL) || 'deepseek-chat';
		}
		return env.CLAUDE_MODEL || 'claude-3-5-sonnet-latest';
	}

	private isRetryableProviderError(error: unknown) {
		const providerError = error as { status?: number; message?: string };
		const message = providerError?.message || '';
		return (
			providerError?.status === 429 ||
			(providerError?.status !== undefined && providerError.status >= 500) ||
			/\b(429|5\d\d)\b/.test(message) ||
			/network error|fetch failed|timeout|temporarily unavailable|service error/i.test(message)
		);
	}

	generateChat(
		taskType: RoutingTaskType,
		options: GenerateChatOptions & { stream: true }
	): Promise<AsyncGenerator<ChatStreamChunk, GenerateChatResult, unknown>>;
	generateChat(
		taskType: RoutingTaskType,
		options: GenerateChatOptions & { stream?: false }
	): Promise<GenerateChatResult>;
	generateChat(
		taskType: RoutingTaskType,
		options: GenerateChatOptions
	): Promise<GenerateChatResult | AsyncGenerator<ChatStreamChunk, GenerateChatResult, unknown>>;
	async generateChat(
		taskType: RoutingTaskType,
		options: GenerateChatOptions
	): Promise<GenerateChatResult | AsyncGenerator<ChatStreamChunk, GenerateChatResult, unknown>> {
		const candidates = this.fallbackCandidates(taskType, options.provider);
		let lastError: unknown;

		for (const providerName of candidates) {
			if (
				!this.isProviderAvailable(providerName) &&
				candidates.some((candidate) => this.isProviderAvailable(candidate))
			) {
				continue;
			}
			const provider = this.providers[providerName];
			const mergedOptions = {
				...options,
				model: options.model || this.modelFor(providerName, taskType)
			};
			try {
				return await provider.generateChat(mergedOptions as GenerateChatOptions);
			} catch (error) {
				lastError = error;
				if (!this.isRetryableProviderError(error) || providerName === candidates.at(-1)) {
					throw error;
				}
				console.warn(`AI provider ${providerName} unavailable; trying configured fallback.`);
			}
		}

		throw lastError instanceof Error ? lastError : new Error('No AI provider is available.');
	}
}

export const aiRouter = new AIRouter();
