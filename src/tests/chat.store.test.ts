import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatStore } from '../lib/stores/chat.svelte';

describe('ChatStore isRerolling and guard clauses', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('should initialize isRerolling as false', () => {
		const store = new ChatStore();
		expect(store.isRerolling).toBe(false);
	});

	it('should not reroll if there is no active conversation or messages', async () => {
		const store = new ChatStore();
		store.activeId = null;

		const spyFetch = vi.spyOn(globalThis, 'fetch');
		await store.rerollLastMessage();
		expect(spyFetch).not.toHaveBeenCalled();
		expect(store.isRerolling).toBe(false);
	});

	it('should respect isStreaming, isThinking, or isRerolling guard clause', async () => {
		const store = new ChatStore();
		store.activeId = 'conv-1';
		store.messages['conv-1'] = [
			{ id: '1', role: 'user', content: 'hello', createdAt: new Date().toISOString() },
			{ id: '2', role: 'assistant', content: 'hi', createdAt: new Date().toISOString() }
		];

		const spyFetch = vi.spyOn(globalThis, 'fetch');

		// Test isStreaming guard
		store.isStreaming = true;
		await store.rerollLastMessage();
		expect(spyFetch).not.toHaveBeenCalled();
		store.isStreaming = false;

		// Test isThinking guard
		store.isThinking = true;
		await store.rerollLastMessage();
		expect(spyFetch).not.toHaveBeenCalled();
		store.isThinking = false;

		// Test isRerolling guard
		store.isRerolling = true;
		await store.rerollLastMessage();
		expect(spyFetch).not.toHaveBeenCalled();
		store.isRerolling = false;
	});

	it('should set isRerolling during the fetch flow and reset on completion', async () => {
		const store = new ChatStore();
		store.activeId = 'conv-1';
		store.messages['conv-1'] = [
			{ id: '1', role: 'user', content: 'hello', createdAt: new Date().toISOString() },
			{ id: '2', role: 'assistant', content: 'hi', createdAt: new Date().toISOString() }
		];

		// Mock a successful fetch that returns readable stream or similar
		const mockReader = {
			read: vi.fn().mockResolvedValue({ done: true, value: new Uint8Array() }),
			releaseLock: vi.fn()
		};
		const mockResponse = {
			ok: true,
			body: {
				getReader: () => mockReader
			}
		};
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

		const promise = store.rerollLastMessage();
		// In the middle of execution, isRerolling should be true
		expect(store.isRerolling).toBe(true);

		await promise;
		// After execution, isRerolling should be false
		expect(store.isRerolling).toBe(false);
	});
});
