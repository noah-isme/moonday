import { browser } from '$app/environment';
import { settingsStore } from './settings.svelte';

export class VoiceStore {
	isSupported = $state<boolean>(false);
	isListening = $state<boolean>(false);
	isSpeaking = $state<boolean>(false);
	transcript = $state<string>('');
	errorMessage = $state<string | null>(null);
	recognitionState = $state<'idle' | 'starting' | 'listening' | 'stopping'>('idle');

	private recognition: any = null;
	private currentUtterance: SpeechSynthesisUtterance | null = null;

	// Callback hooks for when speech transcript changes or finishes
	onTranscriptChange: ((text: string) => void) | null = null;
	onSpeechEnd: (() => void) | null = null;

	constructor() {
		if (browser) {
			const SpeechRecognition =
				(window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
			this.isSupported = !!SpeechRecognition;

			if (SpeechRecognition) {
				this.recognition = new SpeechRecognition();
				this.recognition.continuous = false;
				this.recognition.interimResults = true;
				this.recognition.lang = 'id-ID';

				this.recognition.onstart = () => {
					if (this.recognitionState === 'stopping') {
						try {
							this.recognition.abort();
						} catch (e) {
							console.error('Error aborting onstart in VoiceStore:', e);
						}
						return;
					}
					this.recognitionState = 'listening';
					this.isListening = true;
					this.transcript = '';
				};

				this.recognition.onresult = (event: any) => {
					let resultText = '';
					for (let i = event.resultIndex; i < event.results.length; ++i) {
						resultText += event.results[i][0].transcript;
					}
					this.transcript = resultText;
					if (this.onTranscriptChange) {
						this.onTranscriptChange(this.transcript);
					}
				};

				this.recognition.onerror = (event: any) => {
					console.error('Speech recognition error:', event.error);
					this.recognitionState = 'idle';
					this.isListening = false;

					switch (event.error) {
						case 'not-allowed':
						case 'permission-denied':
							this.errorMessage =
								'Microphone access denied. Please allow microphone permissions in your browser settings.';
							break;
						case 'no-speech':
							this.errorMessage = 'No speech was detected. Please try again.';
							break;
						case 'network':
							this.errorMessage = 'Network error occurred. Please check your internet connection.';
							break;
						case 'aborted':
							this.errorMessage = null;
							break;
						default:
							this.errorMessage = `Speech recognition error: ${event.error}`;
							break;
					}

					if (this.errorMessage && typeof window !== 'undefined') {
						window.alert(this.errorMessage);
					}
				};

				this.recognition.onend = () => {
					this.recognitionState = 'idle';
					this.isListening = false;
					if (this.onSpeechEnd && this.transcript.trim()) {
						this.onSpeechEnd();
					}
				};
			}
		}
	}

	startListening() {
		if (!this.recognition) {
			console.warn('Speech recognition not supported in this browser.');
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

		try {
			this.recognition.start();
		} catch (e) {
			console.error('Error starting speech recognition:', e);
			this.recognitionState = 'idle';
			this.isListening = false;
		}
	}

	stopListening() {
		if (!this.recognition) return;
		if (this.recognitionState === 'idle' || this.recognitionState === 'stopping') {
			return;
		}

		const previousState = this.recognitionState;
		this.recognitionState = 'stopping';

		try {
			if (previousState === 'starting') {
				this.recognition.abort();
			} else {
				this.recognition.stop();
			}
		} catch (e) {
			console.error('Error stopping speech recognition:', e);
			this.recognitionState = 'idle';
			this.isListening = false;
		}
	}

	speak(text: string) {
		if (!browser || !window.speechSynthesis || !settingsStore.voiceOutputEnabled) return;

		this.stopSpeaking();

		// Strip out markdown elements for better pronunciation
		const cleanText = text
			.replace(/[*#_`~]/g, '')
			.replace(/\[.*?\]\(.*?\)/g, '')
			.trim();

		if (!cleanText) return;

		this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
		this.currentUtterance.rate = 1.0;
		this.currentUtterance.pitch = 1.0;

		// Select a nice gentle female or robotic voice if available
		const voices = window.speechSynthesis.getVoices();
		const preferredVoice = voices.find(
			(v) =>
				v.lang.startsWith('en') &&
				(v.name.includes('Google') ||
					v.name.includes('Natural') ||
					v.name.includes('Zira') ||
					v.name.includes('Samantha'))
		);
		if (preferredVoice) {
			this.currentUtterance.voice = preferredVoice;
		}

		this.currentUtterance.onstart = () => {
			this.isSpeaking = true;
		};

		this.currentUtterance.onend = () => {
			this.isSpeaking = false;
			this.currentUtterance = null;
		};

		this.currentUtterance.onerror = () => {
			this.isSpeaking = false;
			this.currentUtterance = null;
		};

		window.speechSynthesis.speak(this.currentUtterance);
	}

	stopSpeaking() {
		if (browser && window.speechSynthesis) {
			window.speechSynthesis.cancel();
			this.isSpeaking = false;
			this.currentUtterance = null;
		}
	}
}

export const voiceStore = new VoiceStore();
