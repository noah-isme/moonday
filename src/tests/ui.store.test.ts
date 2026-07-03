import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UIStore, uiStore } from '../lib/stores/ui.svelte';

describe('UIStore', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('should initialize with idle state', () => {
		const store = new UIStore();
		expect(store.moonState).toBe('idle');
	});

	it('should update moonState when setMoonState is called', () => {
		const store = new UIStore();
		store.setMoonState('listening');
		expect(store.moonState).toBe('listening');
	});

	it('should auto-idle speaking state after 10 seconds', () => {
		const store = new UIStore();
		store.setMoonState('speaking');
		expect(store.moonState).toBe('speaking');

		// Fast-forward 9.9 seconds - should still be speaking
		vi.advanceTimersByTime(9900);
		expect(store.moonState).toBe('speaking');

		// Fast-forward to 10 seconds
		vi.advanceTimersByTime(100);
		expect(store.moonState).toBe('idle');
	});

	it('should auto-idle thinking state after 10 seconds', () => {
		const store = new UIStore();
		store.setMoonState('thinking');
		expect(store.moonState).toBe('thinking');

		// Fast-forward 10 seconds
		vi.advanceTimersByTime(10000);
		expect(store.moonState).toBe('idle');
	});

	it('should not auto-idle listening or sleepy states', () => {
		const store = new UIStore();
		store.setMoonState('listening');
		vi.advanceTimersByTime(10000);
		expect(store.moonState).toBe('listening');

		store.setMoonState('sleepy');
		vi.advanceTimersByTime(10000);
		expect(store.moonState).toBe('sleepy');
	});

	it('should clear previous timeout when state is changed to another timed state', () => {
		const store = new UIStore();
		store.setMoonState('speaking');

		// Advance 5 seconds
		vi.advanceTimersByTime(5000);
		expect(store.moonState).toBe('speaking');

		// Switch to thinking, which should clear speaking timeout and set new thinking timeout
		store.setMoonState('thinking');

		// Advance another 6 seconds. If speaking timeout was not cleared, it would have fired at 10s total (which is 5s from switch), resetting state to idle.
		// But since thinking started, it needs 10s from the switch.
		vi.advanceTimersByTime(6000);
		expect(store.moonState).toBe('thinking');

		// Advance remaining 4 seconds (10s total for thinking)
		vi.advanceTimersByTime(4000);
		expect(store.moonState).toBe('idle');
	});

	it('should clear timeout when state is changed to a non-timed state', () => {
		const store = new UIStore();
		store.setMoonState('speaking');

		// Advance 5 seconds
		vi.advanceTimersByTime(5000);

		// Change to non-timed state
		store.setMoonState('listening');

		// Advance another 10 seconds. Should remain in listening state.
		vi.advanceTimersByTime(10000);
		expect(store.moonState).toBe('listening');
	});

	it('should export a singleton uiStore instance', () => {
		expect(uiStore).toBeInstanceOf(UIStore);
	});
});
