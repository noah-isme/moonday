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

	private isProviderAvailable(name: AIProviderName): boolean {
		if (name === 'deepseek') return !!env.DEEPSEEK_API_KEY;
		if (name === 'claude') return !!env.ANTHROPIC_API_KEY;
		return !!(process.env.GROQ_API_KEY || env.GROQ_API_KEY);
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
		// Let options.provider override the routed provider if explicitly specified
		let provider: AIProvider;
		if (options.provider) {
			if (!this.isProviderAvailable(options.provider)) {
				throw new Error(`${options.provider.toUpperCase()}_API_KEY is not set`);
			}
			provider = this.providers[options.provider];
		} else {
			const defaultProvider = env.DEFAULT_AI_PROVIDER as AIProviderName | undefined;
			provider =
				defaultProvider && this.isProviderAvailable(defaultProvider)
					? this.providers[defaultProvider]
					: this.getProviderForTask(taskType);
		}

		// Configure model based on provider if not specified in options
		const mergedOptions = { ...options };
		if (!mergedOptions.model) {
			const config = this.route(taskType);
			if (provider.name === config.provider) {
				mergedOptions.model = config.model;
			} else if (provider.name === 'groq') {
				mergedOptions.model =
					(env.DEFAULT_AI_PROVIDER === 'groq' && env.DEFAULT_AI_MODEL) || 'llama-3.3-70b-versatile';
			} else if (provider.name === 'deepseek') {
				// Use DEFAULT_AI_MODEL if DEFAULT_AI_PROVIDER is deepseek, otherwise default deepseek-chat
				mergedOptions.model =
					(env.DEFAULT_AI_PROVIDER === 'deepseek' && env.DEFAULT_AI_MODEL) || 'deepseek-chat';
			} else {
				mergedOptions.model = env.CLAUDE_MODEL || 'claude-3-5-sonnet-latest';
			}
		}

		return provider.generateChat(mergedOptions as any);
	}
}

export const aiRouter = new AIRouter();
