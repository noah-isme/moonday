export interface SpeechRecognitionOptions {
	lang?: string;
	continuous?: boolean;
	interimResults?: boolean;
	onResult?: (transcript: string, isFinal: boolean) => void;
	onStart?: () => void;
	onEnd?: () => void;
	onError?: (event: unknown) => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechRecognitionWindow = Window & {
	SpeechRecognition?: SpeechRecognitionConstructor;
	webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type SpeechRecognitionAlternative = {
	readonly transcript: string;
};

type SpeechRecognitionResult = {
	readonly isFinal: boolean;
	readonly 0: SpeechRecognitionAlternative;
};

type SpeechRecognitionResultList = {
	readonly length: number;
	readonly [index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionResultEvent = {
	readonly resultIndex: number;
	readonly results: SpeechRecognitionResultList;
};

type SpeechRecognitionInstance = {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onstart: (() => void) | null;
	onend: (() => void) | null;
	onerror: ((event: unknown) => void) | null;
	onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
	start: () => void;
	stop: () => void;
	abort: () => void;
};

export class MoondaySpeechRecognition {
	private recognition: SpeechRecognitionInstance | null = null;
	private isListening = false;
	private recognitionState: 'idle' | 'starting' | 'listening' | 'stopping' = 'idle';

	constructor(options: SpeechRecognitionOptions = {}) {
		if (typeof window === 'undefined') return;

		const speechWindow = window as SpeechRecognitionWindow;
		const SpeechRecognition =
			speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
		if (!SpeechRecognition) {
			console.warn('Web Speech API (SpeechRecognition) is not supported in this browser.');
			return;
		}

		this.recognition = new SpeechRecognition();
		this.recognition.continuous = options.continuous ?? false;
		this.recognition.interimResults = options.interimResults ?? true;
		this.recognition.lang = 'id-ID';

		this.recognition.onstart = () => {
			if (this.recognitionState === 'stopping') {
				try {
					this.recognition?.abort();
				} catch (e) {
					console.error('Error aborting onstart in MoondaySpeechRecognition:', e);
				}
				return;
			}
			this.recognitionState = 'listening';
			this.isListening = true;
			options.onStart?.();
		};

		this.recognition.onend = () => {
			this.recognitionState = 'idle';
			this.isListening = false;
			options.onEnd?.();
		};

		this.recognition.onerror = (event: unknown) => {
			this.recognitionState = 'idle';
			this.isListening = false;
			options.onError?.(event);
		};

		this.recognition.onresult = (event: SpeechRecognitionResultEvent) => {
			let finalTranscript = '';
			let interimTranscript = '';

			for (let i = event.resultIndex; i < event.results.length; ++i) {
				if (event.results[i].isFinal) {
					finalTranscript += event.results[i][0].transcript;
				} else {
					interimTranscript += event.results[i][0].transcript;
				}
			}

			const fullTranscript = finalTranscript || interimTranscript;
			options.onResult?.(fullTranscript, finalTranscript !== '');
		};
	}

	public start() {
		if (!this.recognition) return;
		if (this.recognitionState !== 'idle') {
			console.warn(
				'MoondaySpeechRecognition is already starting or running. State:',
				this.recognitionState
			);
			return;
		}

		this.recognitionState = 'starting';
		this.isListening = true;
		try {
			this.recognition.start();
		} catch (error) {
			console.error('Failed to start speech recognition:', error);
			this.recognitionState = 'idle';
			this.isListening = false;
		}
	}

	public stop() {
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
		} catch (error) {
			console.error('Failed to stop speech recognition:', error);
			this.recognitionState = 'idle';
			this.isListening = false;
		}
	}

	public getIsListening(): boolean {
		return this.isListening;
	}

	public isSupported(): boolean {
		if (typeof window === 'undefined') return false;
		const speechWindow = window as SpeechRecognitionWindow;
		return !!(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition);
	}
}
