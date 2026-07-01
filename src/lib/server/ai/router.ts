import { env } from '$env/dynamic/private';
import { ClaudeProvider } from './providers/claude';
import { DeepSeekProvider } from './providers/deepseek';
import type { AIProvider, AIProviderName, GenerateChatOptions, GenerateChatResult } from './types';

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
			deepseek: new DeepSeekProvider()
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

		if (providerName === 'deepseek' && !hasDeepseekKey && hasClaudeKey) {
			providerName = 'claude';
		} else if (providerName === 'claude' && !hasClaudeKey && hasDeepseekKey) {
			providerName = 'deepseek';
		}

		return this.providers[providerName];
	}

	async generateChat(
		taskType: RoutingTaskType,
		options: GenerateChatOptions
	): Promise<GenerateChatResult> {
		// Let options.provider override the routed provider if explicitly specified
		let provider: AIProvider;
		if (options.provider) {
			provider = this.providers[options.provider];
		} else {
			provider = this.getProviderForTask(taskType);
		}

		// Configure model based on provider if not specified in options
		const mergedOptions = { ...options };
		if (!mergedOptions.model) {
			const config = this.route(taskType);
			if (provider.name === config.provider) {
				mergedOptions.model = config.model;
			} else if (provider.name === 'deepseek') {
				mergedOptions.model = env.DEFAULT_AI_MODEL || 'deepseek-chat';
			} else {
				mergedOptions.model = env.CLAUDE_MODEL || 'claude-3-5-sonnet-latest';
			}
		}

		return provider.generateChat(mergedOptions);
	}
}

export const aiRouter = new AIRouter();
