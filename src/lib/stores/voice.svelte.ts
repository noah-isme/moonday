import { browser } from '$app/environment';
import { settingsStore } from './settings.svelte';

const MAX_LOCAL_SPEECH_CHARACTERS = 2_000;
const MAX_LOCAL_SPEECH_CHUNK_CHARACTERS = 280;

export class VoiceStore {
	isSupported = $state<boolean>(false);
	isSynthesisSupported = $state<boolean>(false);
	isListening = $state<boolean>(false);
	isSpeaking = $state<boolean>(false);
	isPreparingSpeech = $state<boolean>(false);
	isTranscribing = $state<boolean>(false);
	transcript = $state<string>('');
	errorMessage = $state<string | null>(null);
	recognitionState = $state<'idle' | 'starting' | 'listening' | 'stopping'>('idle');
	voices = $state<SpeechSynthesisVoice[]>([]);

	private recorder: MediaRecorder | null = null;
	private mediaStream: MediaStream | null = null;
	private recordingRequestId = 0;
	private currentUtterance: SpeechSynthesisUtterance | null = null;
	private currentAudio: HTMLAudioElement | null = null;
	private currentAudioUrl: string | null = null;
	private speechAbortController: AbortController | null = null;
	private speechRequestId = 0;
	private pendingSpeechChunks: string[] = [];
	private stopFallbackTimer: ReturnType<typeof setTimeout> | null = null;

	// Callback hooks for when speech transcript changes or finishes
	onTranscriptChange: ((text: string) => void) | null = null;
	onSpeechEnd: (() => void) | null = null;

	constructor() {
		this.initialize();
	}

	initialize() {
		if (!browser) return;

		this.isSupported = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
		this.isSynthesisSupported = !!window.speechSynthesis;

		if (window.speechSynthesis) {
			const loadVoices = () => {
				this.voices = window.speechSynthesis.getVoices();
			};
			loadVoices();
			window.speechSynthesis.onvoiceschanged = loadVoices;
		}

	}

	private finishListening() {
		if (this.stopFallbackTimer) {
			clearTimeout(this.stopFallbackTimer);
			this.stopFallbackTimer = null;
		}
		this.recognitionState = 'idle';
		this.isListening = false;
	}

	private releaseMicrophone() {
		this.mediaStream?.getTracks().forEach((track) => track.stop());
		this.mediaStream = null;
		this.recorder = null;
	}

	private preferredMimeType() {
		return MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')
			? 'audio/webm;codecs=opus'
			: MediaRecorder.isTypeSupported?.('audio/webm')
				? 'audio/webm'
				: '';
	}

	private getRecognitionLanguage() {
		if (settingsStore.responseLanguage === 'en') return 'en-US';
		if (settingsStore.responseLanguage === 'id') return 'id-ID';
		const browserLanguage = browser ? navigator.language?.toLowerCase() : '';
		return browserLanguage?.startsWith('en') ? 'en-US' : 'id-ID';
	}

	private getSpeechLanguage(text: string) {
		if (settingsStore.responseLanguage === 'en') return 'en-US';
		if (settingsStore.responseLanguage === 'id') return 'id-ID';
		const indonesianMarkers = /\b(aku|kamu|yang|dan|tidak|dengan|untuk|saya|ini|itu|terima kasih)\b/i;
		return indonesianMarkers.test(text) ? 'id-ID' : 'en-US';
	}

	private prepareSpeechText(text: string) {
		const cleanText = text
			.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
			.replace(/[*#_`~]/g, '')
			.replace(/\r\n?/g, '\n')
			.replace(/[ \t]+/g, ' ')
			.replace(/\n{3,}/g, '\n\n')
			.trim();
		if (!cleanText) return '';
		return cleanText.slice(0, MAX_LOCAL_SPEECH_CHARACTERS).trim();
	}

	private splitSpeechIntoChunks(text: string) {
		const chunks: string[] = [];
		let currentChunk = '';
		const addPart = (part: string) => {
			const cleanPart = part.trim();
			if (!cleanPart) return;
			if (currentChunk && currentChunk.length + cleanPart.length + 1 > MAX_LOCAL_SPEECH_CHUNK_CHARACTERS) {
				chunks.push(currentChunk);
				currentChunk = '';
			}
			if (cleanPart.length <= MAX_LOCAL_SPEECH_CHUNK_CHARACTERS) {
				currentChunk = currentChunk ? `${currentChunk} ${cleanPart}` : cleanPart;
				return;
			}
			const words = cleanPart.split(/\s+/);
			for (const word of words) {
				if (currentChunk && currentChunk.length + word.length + 1 > MAX_LOCAL_SPEECH_CHUNK_CHARACTERS) {
					chunks.push(currentChunk);
					currentChunk = '';
				}
				currentChunk = currentChunk ? `${currentChunk} ${word}` : word;
			}
		};

		for (const paragraph of text.split(/\n{2,}/)) {
			for (const sentence of paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [paragraph]) {
				addPart(sentence);
			}
		}
		if (currentChunk) chunks.push(currentChunk);
		return chunks;
	}

	async startListening() {
		this.initialize();
		if (!this.isSupported) {
			this.errorMessage = 'This browser cannot record microphone audio. Type your message instead.';
			return;
		}
		if (this.recognitionState !== 'idle') {
			console.warn(
				'Speech recognition is already starting or running. State:',
				this.recognitionState
			);
			return;
		}
		if (this.isSpeaking) {
			this.stopSpeaking();
		}
		this.recognitionState = 'starting';
		this.isListening = true;
		this.transcript = '';
		this.errorMessage = null;
		const requestId = ++this.recordingRequestId;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			if (requestId !== this.recordingRequestId) {
				stream.getTracks().forEach((track) => track.stop());
				return;
			}
			this.mediaStream = stream;
			const chunks: Blob[] = [];
			const mimeType = this.preferredMimeType();
			this.recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
			this.recorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunks.push(event.data);
			};
			this.recorder.onstop = async () => {
				this.releaseMicrophone();
				this.finishListening();
				if (!chunks.length) return;
				this.isTranscribing = true;
				try {
					const audio = new Blob(chunks, { type: mimeType || 'audio/webm' });
					const formData = new FormData();
					formData.append('audio', audio, 'dictation.webm');
					formData.append('language', settingsStore.responseLanguage);
					const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
					const data = await response.json();
					if (!response.ok) throw new Error(data.error?.message || 'Unable to transcribe audio.');
					this.transcript = String(data.text || '').trim();
					if (!this.transcript) this.errorMessage = 'No speech was detected. Try a little closer to the microphone.';
					else this.onTranscriptChange?.(this.transcript);
				} catch (error) {
					this.errorMessage = error instanceof Error ? error.message : 'Unable to transcribe audio.';
				} finally {
					this.isTranscribing = false;
				}
			};
			this.recorder.start();
			this.recognitionState = 'listening';
		} catch (e) {
			this.finishListening();
			this.errorMessage =
				e instanceof DOMException && e.name === 'NotAllowedError'
					? 'Microphone access was denied. Allow microphone access in your browser settings, then try again.'
					: 'Unable to start microphone recording. Check that another app is not using the microphone.';
		}
	}

	stopListening() {
		if (!this.recorder && this.recognitionState !== 'starting') return;
		if (this.recognitionState === 'idle' || this.recognitionState === 'stopping') {
			return;
		}

		this.recognitionState = 'stopping';
		this.isListening = false;
		if (this.recorder?.state === 'recording') this.recorder.stop();
		else {
			this.recordingRequestId++;
			this.releaseMicrophone();
			this.finishListening();
		}
	}

	async speak(text: string) {
		if (!browser || !settingsStore.voiceOutputEnabled) return;
		if (this.currentAudio && this.currentAudio.paused) {
			try {
				this.errorMessage = null;
				await this.currentAudio.play();
				this.isSpeaking = true;
			} catch {
				this.errorMessage = 'Your browser blocked audio playback. Allow sound for this site, then try again.';
			}
			return;
		}
		this.stopSpeaking();
		const cleanText = this.prepareSpeechText(text);
		if (!cleanText) return;

		const requestId = ++this.speechRequestId;
		const language = this.getSpeechLanguage(cleanText);
		const useLocalKokoro = language.toLowerCase() === 'en-us' && typeof Audio !== 'undefined';
		// Kokoro's local model does not provide an Indonesian voice. Keep browser output as a
		// useful fallback there rather than producing distorted speech.
		if (useLocalKokoro) {
			this.pendingSpeechChunks = this.splitSpeechIntoChunks(cleanText);
			this.errorMessage = null;
			await this.playNextLocalChunk(requestId);
			return;
		}

		this.speakWithBrowser(
			cleanText,
			language,
			null
		);
	}

	private async playNextLocalChunk(requestId: number) {
		const text = this.pendingSpeechChunks.shift();
		if (!text || requestId !== this.speechRequestId) return;
		this.isPreparingSpeech = true;
		this.speechAbortController = new AbortController();
		try {
			const response = await fetch('/api/speech', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text, speed: settingsStore.voiceRate, lang: 'en-us' }),
				signal: this.speechAbortController.signal
			});
			if (!response.ok) {
				const failure = await response.json().catch(() => null);
				throw new Error(failure?.error?.message || 'Local MOONDAY voice is unavailable.');
			}
			const audioBlob = await response.blob();
			if (!audioBlob.size) throw new Error('Local MOONDAY voice returned no audio.');
			if (requestId !== this.speechRequestId) return;

			const audioUrl = URL.createObjectURL(audioBlob);
			const audio = new Audio(audioUrl);
			this.currentAudio = audio;
			this.currentAudioUrl = audioUrl;
			audio.onended = () => {
				this.finishAudioPlayback(audio);
				void this.playNextLocalChunk(requestId);
			};
			audio.onplay = () => {
				this.isPreparingSpeech = false;
				this.isSpeaking = true;
			};
			audio.onerror = () => {
				this.finishAudioPlayback(audio);
				this.pendingSpeechChunks = [];
				this.errorMessage = 'MOONDAY could not play the locally generated audio. Check your system output device.';
			};
			try {
				await audio.play();
			} catch (error) {
				this.isPreparingSpeech = false;
				this.isSpeaking = false;
				if (error instanceof DOMException && error.name === 'NotAllowedError') {
					this.errorMessage = 'Your browser blocked automatic audio. Click Speak under this reply to play the prepared local clip.';
					return;
				}
				this.finishAudioPlayback(audio);
				throw error;
			}
		} catch (error) {
			if (requestId !== this.speechRequestId || (error instanceof DOMException && error.name === 'AbortError')) return;
			this.isSpeaking = false;
			this.isPreparingSpeech = false;
			this.pendingSpeechChunks = [];
			this.errorMessage = error instanceof Error ? error.message : 'Local MOONDAY voice could not generate audio.';
		}
	}

	private speakWithBrowser(cleanText: string, language: string, fallbackNotice: string | null = null) {
		if (!window.speechSynthesis) {
			this.errorMessage = 'Local MOONDAY voice is unavailable and this browser has no speech fallback.';
			return;
		}

		const utterance = new SpeechSynthesisUtterance(cleanText);
		this.currentUtterance = utterance;
		utterance.lang = language;
		utterance.rate = settingsStore.voiceRate;
		utterance.pitch = 1.0;

		const voices = this.voices.length ? this.voices : window.speechSynthesis.getVoices();
		const selectedVoice = settingsStore.voiceName
			? voices.find((voice) => voice.name === settingsStore.voiceName)
			: undefined;
		const preferredVoice = selectedVoice ?? voices.find(
			(v) =>
				v.lang.toLowerCase().startsWith(utterance.lang.slice(0, 2).toLowerCase()) &&
				(v.name.includes('Google') ||
					v.name.includes('Natural') ||
					v.name.includes('Zira') ||
					v.name.includes('Samantha'))
		);
		if (preferredVoice) {
			utterance.voice = preferredVoice;
		}

		utterance.onstart = () => {
			this.isSpeaking = true;
			this.errorMessage = fallbackNotice;
		};

		utterance.onend = () => {
			this.isSpeaking = false;
			if (this.currentUtterance === utterance) this.currentUtterance = null;
		};

		utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
			this.isSpeaking = false;
			if (this.currentUtterance === utterance) this.currentUtterance = null;
			// These are expected when a new response, manual stop, or message send interrupts speech.
			if (event.error === 'canceled' || event.error === 'interrupted') return;
			this.errorMessage = `MOONDAY could not play speech (${event.error || 'unknown error'}). Check your system output device and browser voice support.`;
		};

		window.speechSynthesis.speak(utterance);
	}

	private finishAudioPlayback(audio: HTMLAudioElement) {
		if (this.currentAudio !== audio) return;
		this.currentAudio = null;
		this.isPreparingSpeech = false;
		this.isSpeaking = false;
		if (this.currentAudioUrl) URL.revokeObjectURL(this.currentAudioUrl);
		this.currentAudioUrl = null;
	}

	stopSpeaking() {
		this.speechRequestId++;
		this.speechAbortController?.abort();
		this.speechAbortController = null;
		this.pendingSpeechChunks = [];
		this.isPreparingSpeech = false;
		if (this.currentAudio) {
			this.currentAudio.pause();
			this.currentAudio.currentTime = 0;
			this.finishAudioPlayback(this.currentAudio);
		}
		if (browser && window.speechSynthesis) {
			window.speechSynthesis.cancel();
			this.isSpeaking = false;
			this.currentUtterance = null;
		}
	}
}

export const voiceStore = new VoiceStore();
