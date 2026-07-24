import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

class MockMediaRecorder {
	static isTypeSupported = vi.fn().mockReturnValue(true);
	state: 'inactive' | 'recording' = 'inactive';
	ondataavailable: ((event: { data: Blob }) => void) | null = null;
	onstop: (() => Promise<void> | void) | null = null;
	constructor(
		public stream: MediaStream,
		public options?: MediaRecorderOptions
	) {}
	start = vi.fn(() => (this.state = 'recording'));
	stop = vi.fn(() => (this.state = 'inactive'));
}

class MockSpeechSynthesisUtterance {
	text: string;
	lang = '';
	rate = 1;
	pitch = 1;
	voice: SpeechSynthesisVoice | null = null;
	onstart: (() => void) | null = null;
	onend: (() => void) | null = null;
	onerror: ((event: { error: string }) => void) | null = null;
	constructor(text: string) {
		this.text = text;
	}
}

type VoiceStoreInternals = {
	recorder: MockMediaRecorder | null;
	currentAudio: HTMLAudioElement | null;
};

const mockSpeechSynthesis = {
	speak: vi.fn(),
	cancel: vi.fn(),
	getVoices: vi.fn().mockReturnValue([])
};

const mockTrackStop = vi.fn();
const mockStream = {
	getTracks: () => [{ stop: mockTrackStop }],
	active: true,
	id: 'mock-stream-id',
	onaddtrack: null,
	onremovetrack: null,
	addTrack: vi.fn(),
	removeTrack: vi.fn(),
	clone: vi.fn(),
	getAudioTracks: vi.fn().mockReturnValue([]),
	getVideoTracks: vi.fn().mockReturnValue([]),
	getTrackById: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	dispatchEvent: vi.fn()
} as unknown as MediaStream;
let mockGetUserMedia: ReturnType<typeof vi.fn>;

Object.defineProperty(globalThis, 'window', {
	configurable: true,
	value: { speechSynthesis: mockSpeechSynthesis }
});
globalThis.localStorage = {
	getItem: () => null,
	setItem: () => {},
	clear: () => {},
	removeItem: () => {},
	key: () => null,
	length: 0
};
globalThis.SpeechSynthesisUtterance =
	MockSpeechSynthesisUtterance as typeof SpeechSynthesisUtterance;

describe('VoiceStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);
		Object.defineProperty(globalThis, 'navigator', {
			configurable: true,
			value: { language: 'en-US', mediaDevices: { getUserMedia: mockGetUserMedia } }
		});
		Object.defineProperty(globalThis, 'MediaRecorder', {
			configurable: true,
			value: MockMediaRecorder
		});
		globalThis.fetch = vi
			.fn()
			.mockResolvedValue({ ok: true, json: async () => ({ text: 'Recorded words' }) });
	});

	afterEach(() => {
		Reflect.deleteProperty(globalThis, 'MediaRecorder');
	});

	it('uses MediaRecorder when microphone recording is available', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		expect(store.isSupported).toBe(true);
		await store.startListening();
		expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
		expect(store.recognitionState).toBe('listening');
		expect((store as unknown as VoiceStoreInternals).recorder).toBeInstanceOf(MockMediaRecorder);
	});

	it('posts the stopped recording and exposes an editable transcript', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		const onTranscriptChange = vi.fn();
		store.onTranscriptChange = onTranscriptChange;
		await store.startListening();
		const recorder = (store as unknown as VoiceStoreInternals).recorder;
		expect(recorder).toBeInstanceOf(MockMediaRecorder);
		if (!recorder) throw new Error('Expected recorder to be initialized.');
		store.stopListening();
		recorder.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
		await recorder.onstop?.();
		expect(globalThis.fetch).toHaveBeenCalledWith(
			'/api/transcribe',
			expect.objectContaining({ method: 'POST' })
		);
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
		const utterance = mockSpeechSynthesis.speak.mock.calls.at(-1)?.[0] as
			MockSpeechSynthesisUtterance | undefined;
		expect(utterance).toBeDefined();
		expect(utterance!.text).toBe('One. Two. Three. Four.');
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
		Object.defineProperty(globalThis, 'Audio', {
			configurable: true,
			value: MockAudio
		});
		Object.assign(globalThis.URL, {
			createObjectURL: vi.fn().mockReturnValue('blob:moonday-audio'),
			revokeObjectURL: vi.fn()
		});
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			blob: async () => new Blob(['audio'], { type: 'audio/wav' })
		});

		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		await store.speak('Hello from local MOONDAY.');

		expect(globalThis.fetch).toHaveBeenCalledWith(
			'/api/speech',
			expect.objectContaining({ method: 'POST' })
		);
		expect((store as unknown as VoiceStoreInternals).currentAudio).toBeInstanceOf(MockAudio);
		Reflect.deleteProperty(globalThis, 'Audio');
	});

	it('does not report expected speech cancellation as a playback failure', async () => {
		const { VoiceStore } = await import('../lib/stores/voice.svelte');
		const store = new VoiceStore();
		store.speak('Hello there.');
		const utterance = mockSpeechSynthesis.speak.mock.calls.at(-1)?.[0] as
			MockSpeechSynthesisUtterance | undefined;
		expect(utterance).toBeDefined();
		expect(utterance!.onerror).toBeDefined();
		utterance!.onerror!({ error: 'canceled' });
		expect(store.errorMessage).toBeNull();
	});
});
