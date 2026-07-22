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
globalThis.SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
	text: string;
	lang = '';
	rate = 1;
	pitch = 1;
	voice: SpeechSynthesisVoice | null = null;
	onstart: (() => void) | null = null;
	onend: (() => void) | null = null;
	onerror: (() => void) | null = null;

	constructor(text: string) {
		this.text = text;
	}
} as any;

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

	it('should use Indonesian recognition by default and honor an explicit response language', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const { settingsStore } = await import('../lib/stores/settings.svelte');
		settingsStore.setResponseLanguage('id');
		const store = new VoiceStore();
		expect(store['recognition'].lang).toBe('id-ID');
		settingsStore.setResponseLanguage('en');
		store.startListening();
		expect(store['recognition'].lang).toBe('en-US');
	});

	it('keeps the transcript available for review after recognition ends', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		const onSpeechEnd = vi.fn();
		store.onSpeechEnd = onSpeechEnd;
		store.startListening();
		store['recognition'].onresult({
			resultIndex: 0,
			results: [[{ transcript: 'Please keep this as a draft.' }]]
		});
		store['recognition'].onend();
		expect(store.transcript).toBe('Please keep this as a draft.');
		expect(onSpeechEnd).toHaveBeenCalledTimes(1);
	});

	it('limits spoken output to a concise, readable excerpt', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		store.speak('One. Two. Three. Four. Five.');
		const utterance = (window.speechSynthesis.speak as any).mock.calls.at(-1)[0];
		expect(utterance.text).toBe('One. Two. Three.');
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
