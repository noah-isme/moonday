import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { webSearch, fetchFromSearXNG } from '../lib/server/tools/browser';

vi.mock('$env/dynamic/private', () => {
	return {
		env: {
			SEARXNG_BASE_URL: 'http://localhost:8080',
			TAVILY_API_KEY: 'mock-tavily-key',
			BRAVE_SEARCH_API_KEY: 'mock-brave-key'
		}
	};
});

describe('Browser Tools Search Integration', () => {
	beforeEach(() => {
		// Mock env keys in process.env too
		process.env.SEARXNG_BASE_URL = 'http://localhost:8080';
		process.env.TAVILY_API_KEY = 'mock-tavily-key';
		process.env.BRAVE_SEARCH_API_KEY = 'mock-brave-key';
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('fetchFromSearXNG should correctly map and limit results to top 3', async () => {
		const mockSearXResponse = {
			ok: true,
			status: 200,
			json: async () => ({
				results: [
					{ title: 'Title 1', url: 'https://site1.com', content: 'Content 1' },
					{ title: 'Title 2', url: 'https://site2.com', snippet: 'Snippet 2' },
					{ title: 'Title 3', url: 'https://site3.com', content: 'Content 3' },
					{ title: 'Title 4', url: 'https://site4.com', content: 'Content 4' }
				]
			})
		} as Response;

		vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockSearXResponse);

		const results = await fetchFromSearXNG('test query');

		expect(results).toHaveLength(3);
		expect(results[0]).toEqual({
			title: 'Title 1',
			url: 'https://site1.com',
			snippet: 'Content 1'
		});
		expect(results[1]).toEqual({
			title: 'Title 2',
			url: 'https://site2.com',
			snippet: 'Snippet 2'
		});
	});

	it('webSearch should fallback to Tavily when SearXNG times out or fails', async () => {
		// SearXNG abort/timeout mock (throws AbortError) followed by Tavily success mock
		vi.spyOn(globalThis, 'fetch')
			.mockRejectedValueOnce(new DOMException('The user aborted a request.', 'AbortError'))
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({
					results: [{ title: 'Tavily Hit', url: 'https://tavily.com/1', content: 'Tavily text' }]
				})
			} as Response);

		const results = await webSearch('search query');

		expect(results).toHaveLength(1);
		expect(results[0]).toEqual({
			title: 'Tavily Hit',
			url: 'https://tavily.com/1',
			snippet: 'Tavily text'
		});
	});

	it('webSearch should fallback to Brave when both SearXNG and Tavily fail', async () => {
		// Fail SearXNG, fail Tavily, succeed Brave
		vi.spyOn(globalThis, 'fetch')
			.mockRejectedValueOnce(new Error('SearXNG service down'))
			.mockRejectedValueOnce(new Error('Tavily quota exceeded'))
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({
					web: {
						results: [{ title: 'Brave Hit', url: 'https://brave.com/1', description: 'Brave text' }]
					}
				})
			} as Response);

		const results = await webSearch('query text');

		expect(results).toHaveLength(1);
		expect(results[0]).toEqual({
			title: 'Brave Hit',
			url: 'https://brave.com/1',
			snippet: 'Brave text'
		});
	});

	it('webSearch should return an empty array and log a warning if all search providers fail', async () => {
		// Mock all calls to throw errors
		vi.spyOn(globalThis, 'fetch')
			.mockRejectedValueOnce(new Error('SearXNG error'))
			.mockRejectedValueOnce(new Error('Tavily error'))
			.mockRejectedValueOnce(new Error('Brave error'));

		const results = await webSearch('unlucky query');

		expect(results).toEqual([]);
	});
});
