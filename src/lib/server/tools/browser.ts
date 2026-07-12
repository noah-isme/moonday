import { env } from '$env/dynamic/private';

export interface SearchResult {
	title: string;
	url: string;
	snippet: string;
}

export interface SearXNGResult {
	title: string;
	url: string;
	content?: string;
	snippet?: string;
}

/**
 * Fetch search results from local self-hosted SearXNG with a strict 6-second timeout.
 */
export async function fetchFromSearXNG(query: string): Promise<SearchResult[]> {
	const baseUrl = process.env.SEARXNG_BASE_URL || env.SEARXNG_BASE_URL || 'http://localhost:8080';
	const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=id-ID`;

	const controller = new AbortController();
	const timeoutId = setTimeout(() => {
		controller.abort();
	}, 6000);

	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: {
				'Accept': 'application/json'
			}
		});

		if (!res.ok) {
			throw new Error(`SearXNG returned status ${res.status}: ${res.statusText}`);
		}

		const data = (await res.json()) as { results?: SearXNGResult[] };
		const results = data.results || [];

		// Ambil 3 hasil teratas (slice(0, 3)) dan mapping ke format standar
		return results.slice(0, 3).map((r) => ({
			title: r.title || 'Untitled',
			url: r.url || '',
			snippet: r.content || r.snippet || ''
		}));
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Fetch search results from Tavily Search API.
 */
export async function fetchFromTavily(query: string): Promise<SearchResult[]> {
	const tavilyKey = process.env.TAVILY_API_KEY || env.TAVILY_API_KEY;
	if (!tavilyKey) {
		throw new Error('TAVILY_API_KEY is not configured');
	}

	const res = await fetch('https://api.tavily.com/search', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			api_key: tavilyKey,
			query,
			search_depth: 'basic',
			max_results: 5
		})
	});

	if (!res.ok) {
		throw new Error(`Tavily search API responded with status ${res.status}: ${res.statusText}`);
	}

	const data = (await res.json()) as any;
	if (data && Array.isArray(data.results)) {
		return data.results.map((r: any) => ({
			title: r.title || 'Untitled',
			url: r.url || '',
			snippet: r.content || r.snippet || ''
		}));
	}
	return [];
}

/**
 * Fetch search results from Brave Search API.
 */
export async function fetchFromBrave(query: string): Promise<SearchResult[]> {
	const braveKey = process.env.BRAVE_SEARCH_API_KEY || env.BRAVE_SEARCH_API_KEY;
	if (!braveKey) {
		throw new Error('BRAVE_SEARCH_API_KEY is not configured');
	}

	const url = new URL('https://api.search.brave.com/res/v1/web/search');
	url.searchParams.set('q', query);
	url.searchParams.set('count', '5');

	const res = await fetch(url.toString(), {
		headers: {
			'Accept': 'application/json',
			'X-Subscription-Token': braveKey
		}
	});

	if (!res.ok) {
		throw new Error(`Brave search API responded with status ${res.status}: ${res.statusText}`);
	}

	const data = (await res.json()) as any;
	if (data && data.web && Array.isArray(data.web.results)) {
		return data.web.results.map((r: any) => ({
			title: r.title || 'Untitled',
			url: r.url || '',
			snippet: r.description || r.snippet || ''
		}));
	}
	return [];
}

/**
 * Main webSearch dispatcher with fallback chain.
 */
export async function webSearch(query: string): Promise<SearchResult[]> {
	// Priority 1: SearXNG
	try {
		console.log(`[WebSearch] Querying SearXNG for: "${query}"`);
		const results = await fetchFromSearXNG(query);
		if (results.length >= 1) {
			console.log(`[WebSearch] SearXNG returned ${results.length} results.`);
			return results;
		}
		console.warn('[WebSearch] SearXNG returned empty results, trying fallback.');
	} catch (error) {
		console.error('[WebSearch] SearXNG query failed:', error);
	}

	// Priority 2: Tavily API
	const tavilyKey = process.env.TAVILY_API_KEY || env.TAVILY_API_KEY;
	if (tavilyKey) {
		try {
			console.log(`[WebSearch] Querying Tavily for: "${query}"`);
			const results = await fetchFromTavily(query);
			console.log(`[WebSearch] Tavily returned ${results.length} results.`);
			return results;
		} catch (error) {
			console.error('[WebSearch] Tavily query failed:', error);
		}
	}

	// Priority 3: Brave API
	const braveKey = process.env.BRAVE_SEARCH_API_KEY || env.BRAVE_SEARCH_API_KEY;
	if (braveKey) {
		try {
			console.log(`[WebSearch] Querying Brave for: "${query}"`);
			const results = await fetchFromBrave(query);
			console.log(`[WebSearch] Brave returned ${results.length} results.`);
			return results;
		} catch (error) {
			console.error('[WebSearch] Brave query failed:', error);
		}
	}

	// Fail-Safe
	console.error('🚨 [RED FLAG] [WebSearch] All search engines failed or are unconfigured!');
	return [];
}

/**
 * Reads a web URL and returns its markdown contents via Jina Reader.
 * Truncates output to 6,000 characters.
 */
export async function deepRead(url: string): Promise<string> {
	try {
		// Zero-RAM Leak Law: Pure fetch to Jina AI Reader
		const jinaUrl = 'https://r.jina.ai/' + url;
		const res = await fetch(jinaUrl, {
			headers: {
				'X-Return-Format': 'markdown'
			}
		});

		if (!res.ok) {
			throw new Error(`Jina AI Reader responded with status ${res.status}: ${res.statusText}`);
		}

		const text = await res.text();
		
		// Truncate if exceeds 6,000 characters
		if (text.length > 6000) {
			return text.substring(0, 6000) + '\n\n[Content truncated to 6000 characters...]';
		}
		return text;
	} catch (error) {
		console.error(`deepRead failed for URL ${url}:`, error);
		throw error;
	}
}

/**
 * OpenAI Tool Specification for Groq
 */
export const searchToolsSpecification = [
	{
		type: 'function',
		function: {
			name: 'web_search',
			description: 'Search the web for up-to-date information on a given query or topic. Returns top titles, URLs, and snippets.',
			parameters: {
				type: 'object',
				properties: {
					query: {
						type: 'string',
						description: 'The search query to look up on the web.'
					}
				},
				required: ['query']
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'deep_read',
			description: 'Read the full webpage content from a specific URL, returned in clean markdown format.',
			parameters: {
				type: 'object',
				properties: {
					url: {
						type: 'string',
						description: 'The exact web URL to fetch and read.'
					}
				},
				required: ['url']
			}
		}
	}
];

/**
 * Executes the requested tool and handles fallbacks gracefully.
 */
export async function executeTool(name: string, args: any): Promise<string> {
	try {
		if (name === 'web_search') {
			const query = args.query;
			if (!query) {
				throw new Error('Missing "query" parameter for web_search');
			}
			const results = await webSearch(query);
			return JSON.stringify(results, null, 2);
		} else if (name === 'deep_read') {
			const url = args.url;
			if (!url) {
				throw new Error('Missing "url" parameter for deep_read');
			}
			const markdown = await deepRead(url);
			return markdown;
		} else {
			throw new Error(`Unsupported tool: ${name}`);
		}
	} catch (error) {
		console.error(`executeTool "${name}" failed. Applying fallback:`, error);
		// Rule 2: Zero-leak fallback message back to LLM
		return '[System: Failed to access deep web content. Using general knowledge.]';
	}
}
