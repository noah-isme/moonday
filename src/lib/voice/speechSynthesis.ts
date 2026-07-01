export interface SpeechSynthesisOptions {
	lang?: string;
	voiceName?: string;
	rate?: number;
	pitch?: number;
	onStart?: () => void;
	onEnd?: () => void;
	onError?: (event: any) => void;
}

export class MoondaySpeechSynthesis {
	private isEnabled = true;

	constructor() {
		if (typeof window !== 'undefined') {
			const stored = localStorage.getItem('moonday_voice_output_enabled');
			if (stored !== null) {
				this.isEnabled = stored === 'true';
			}
		}
	}

	public toggle(enabled?: boolean): boolean {
		this.isEnabled = enabled ?? !this.isEnabled;
		if (typeof window !== 'undefined') {
			localStorage.setItem('moonday_voice_output_enabled', String(this.isEnabled));
		}
		if (!this.isEnabled) {
			this.cancel();
		}
		return this.isEnabled;
	}

	public getEnabled(): boolean {
		return this.isEnabled;
	}

	public speak(text: string, options: SpeechSynthesisOptions = {}): void {
		if (!this.isEnabled) return;
		if (typeof window === 'undefined') return;

		const synth = window.speechSynthesis;
		if (!synth) {
			console.warn('Web Speech API (SpeechSynthesis) is not supported in this browser.');
			return;
		}

		// Cancel any ongoing speech first
		synth.cancel();

		if (!text) return;

		const utterance = new SpeechSynthesisUtterance(text);
		utterance.lang = options.lang ?? 'en-US';
		utterance.rate = options.rate ?? 1.0;
		utterance.pitch = options.pitch ?? 1.0;

		if (options.voiceName) {
			const voices = synth.getVoices();
			const selectedVoice = voices.find((v) => v.name === options.voiceName);
			if (selectedVoice) {
				utterance.voice = selectedVoice;
			}
		}

		utterance.onstart = () => {
			options.onStart?.();
		};

		utterance.onend = () => {
			options.onEnd?.();
		};

		utterance.onerror = (event) => {
			options.onError?.(event);
		};

		synth.speak(utterance);
	}

	public cancel(): void {
		if (typeof window !== 'undefined' && window.speechSynthesis) {
			window.speechSynthesis.cancel();
		}
	}

	public getVoices(): SpeechSynthesisVoice[] {
		if (typeof window !== 'undefined' && window.speechSynthesis) {
			return window.speechSynthesis.getVoices();
		}
		return [];
	}

	public isSupported(): boolean {
		if (typeof window === 'undefined') return false;
		return !!window.speechSynthesis;
	}
}

export const moondaySpeechSynthesis = new MoondaySpeechSynthesis();
