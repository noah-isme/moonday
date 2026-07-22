/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

class MockMediaRecorder {
	static isTypeSupported = vi.fn().mockReturnValue(true);
	state: 'inactive' | 'recording' = 'inactive';
	ondataavailable: ((event: { data: Blob }) => void) | null = null;
	onstop: (() => Promise<void> | void) | null = null;
	constructor(public stream: MediaStream, public options?: MediaRecorderOptions) {}
	start = vi.fn(() => (this.state = 'recording'));
	stop = vi.fn(() => (this.state = 'inactive'));
}

const mockTrackStop = vi.fn();
const mockStream = { getTracks: () => [{ stop: mockTrackStop }] } as any;
let mockGetUserMedia: ReturnType<typeof vi.fn>;

globalThis.window = {
	speechSynthesis: { speak: vi.fn(), cancel: vi.fn(), getVoices: vi.fn().mockReturnValue([]) }
} as any;
globalThis.localStorage = {
	getItem: () => null,
	setItem: () => {},
	clear: () => {},
	removeItem: () => {},
	key: () => null,
	length: 0
};
globalThis.SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
	text: string;
	lang = '';
	rate = 1;
	pitch = 1;
	voice: SpeechSynthesisVoice | null = null;
	onstart: (() => void) | null = null;
	onend: (() => void) | null = null;
	onerror: (() => void) | null = null;
	constructor(text: string) { this.text = text; }
} as any;

describe('VoiceStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);
		Object.defineProperty(globalThis, 'navigator', {
			configurable: true,
			value: { language: 'en-US', mediaDevices: { getUserMedia: mockGetUserMedia } }
		});
		(globalThis as any).MediaRecorder = MockMediaRecorder;
		globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: 'Recorded words' }) }) as any;
	});

	afterEach(() => {
		delete (globalThis as any).MediaRecorder;
	});

	it('uses MediaRecorder when microphone recording is available', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		expect(store.isSupported).toBe(true);
		await store.startListening();
		expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
		expect(store.recognitionState).toBe('listening');
		expect((store as any).recorder).toBeInstanceOf(MockMediaRecorder);
	});

	it('posts the stopped recording and exposes an editable transcript', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		const onTranscriptChange = vi.fn();
		store.onTranscriptChange = onTranscriptChange;
		await store.startListening();
		const recorder = (store as any).recorder as MockMediaRecorder;
		store.stopListening();
		recorder.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
		await recorder.onstop?.();
		expect(globalThis.fetch).toHaveBeenCalledWith('/api/transcribe', expect.objectContaining({ method: 'POST' }));
		expect(store.transcript).toBe('Recorded words');
		expect(onTranscriptChange).toHaveBeenCalledWith('Recorded words');
		expect(mockTrackStop).toHaveBeenCalled();
	});

	it('reports a microphone permission failure without leaving the recorder stuck', async () => {
		mockGetUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		await store.startListening();
		expect(store.isListening).toBe(false);
		expect(store.recognitionState).toBe('idle');
		expect(store.errorMessage).toContain('Microphone access was denied');
	});

	it('keeps the full reply available for speech output', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		store.speak('One. Two. Three. Four.');
		const utterance = (window.speechSynthesis.speak as any).mock.calls.at(-1)[0];
		expect(utterance.text).toBe('One. Two. Three. Four.');
	});

	it('uses the same-origin local speech route for English when audio playback is available', async () => {
		class MockAudio {
			onended: (() => void) | null = null;
			onerror: (() => void) | null = null;
			currentTime = 0;
			play = vi.fn().mockResolvedValue(undefined);
			pause = vi.fn();
			constructor(public source: string) {}
		}
		(globalThis as any).Audio = MockAudio;
		Object.assign(globalThis.URL, {
			createObjectURL: vi.fn().mockReturnValue('blob:moonday-audio'),
			revokeObjectURL: vi.fn()
		});
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			blob: async () => new Blob(['audio'], { type: 'audio/wav' })
		}) as any;

		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		await store.speak('Hello from local MOONDAY.');

		expect(globalThis.fetch).toHaveBeenCalledWith(
			'/api/speech',
			expect.objectContaining({ method: 'POST' })
		);
		expect((store as any).currentAudio).toBeInstanceOf(MockAudio);
		delete (globalThis as any).Audio;
	});

	it('does not report expected speech cancellation as a playback failure', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		store.speak('Hello there.');
		const utterance = (window.speechSynthesis.speak as any).mock.calls.at(-1)[0];
		utterance.onerror({ error: 'canceled' });
		expect(store.errorMessage).toBeNull();
	});
});
