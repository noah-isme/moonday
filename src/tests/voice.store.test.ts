/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock browser check
vi.mock('$app/environment', () => {
	globalThis.localStorage = {
		getItem: () => null,
		setItem: () => {},
		clear: () => {},
		removeItem: () => {},
		key: () => null,
		length: 0
	};
	return {
		browser: true
	};
});

globalThis.window = {
	speechSynthesis: {
		speak: vi.fn(),
		cancel: vi.fn(),
		getVoices: vi.fn().mockReturnValue([])
	},
	alert: vi.fn()
} as any;

globalThis.alert = vi.fn();

describe('VoiceStore', () => {
	let mockStart: any;
	let mockStop: any;
	let mockAbort: any;

	beforeEach(() => {
		mockStart = vi.fn();
		mockStop = vi.fn();
		mockAbort = vi.fn();

		function MockSpeechRecognition(this: any) {
			this.start = mockStart;
			this.stop = mockStop;
			this.abort = mockAbort;
			this.continuous = false;
			this.interimResults = false;
			this.lang = 'en-US';
			this.onstart = null;
			this.onend = null;
			this.onerror = null;
			this.onresult = null;
		}

		(window as any).SpeechRecognition = MockSpeechRecognition;
		(window as any).webkitSpeechRecognition = undefined;

		// Mock alert
		(window as any).alert = vi.fn();
		(globalThis as any).alert = (window as any).alert;
	});

	afterEach(() => {
		delete (window as any).SpeechRecognition;
	});

	it('should support speech recognition if window.SpeechRecognition exists', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		expect(store.isSupported).toBe(true);
	});

	it('should lock language to id-ID', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		// In the constructor, recognition lang is set to id-ID
		expect(store['recognition'].lang).toBe('id-ID');
	});

	it('should transition to starting state when startListening is called', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		store.startListening();
		expect(store.recognitionState).toBe('starting');
		expect(store.isListening).toBe(true);
		expect(mockStart).toHaveBeenCalledTimes(1);
	});

	it('should transition to listening state on start callback', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		store.startListening();
		// Simulate onstart
		store['recognition'].onstart();
		expect(store.recognitionState).toBe('listening');
		expect(store.isListening).toBe(true);
	});

	it('should handle double click (immediate stop during starting) gracefully by aborting', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		store.startListening();
		expect(store.recognitionState).toBe('starting');

		// Double click calls stopListening before onstart
		store.stopListening();
		expect(store.recognitionState).toBe('stopping');
		expect(mockAbort).toHaveBeenCalledTimes(1);
		expect(mockStop).not.toHaveBeenCalled();
	});

	it('should call stop() when stopping during listening state', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		store.startListening();
		store['recognition'].onstart();
		expect(store.recognitionState).toBe('listening');

		store.stopListening();
		expect(store.recognitionState).toBe('stopping');
		expect(mockStop).toHaveBeenCalledTimes(1);
		expect(mockAbort).not.toHaveBeenCalled();
	});

	it('should handle permission-denied / not-allowed error', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		store.startListening();

		// Simulate error
		store['recognition'].onerror({ error: 'not-allowed' });
		expect(store.recognitionState).toBe('idle');
		expect(store.isListening).toBe(false);
		expect(store.errorMessage).toContain('Microphone access denied');
		expect(window.alert).toHaveBeenCalled();
	});

	it('should handle no-speech error', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		store.startListening();

		// Simulate error
		store['recognition'].onerror({ error: 'no-speech' });
		expect(store.recognitionState).toBe('idle');
		expect(store.isListening).toBe(false);
		expect(store.errorMessage).toContain('No speech was detected');
		expect(window.alert).toHaveBeenCalled();
	});
});
