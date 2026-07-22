import { browser } from '$app/environment';

export class SettingsStore {
	provider = $state<'deepseek' | 'claude' | 'groq'>('deepseek');
	model = $state<string>('deepseek-chat');
	responseLanguage = $state<'auto' | 'en' | 'id'>('auto');
	voiceInputEnabled = $state<boolean>(true);
	voiceOutputEnabled = $state<boolean>(true);
	voiceRate = $state<number>(1.15);
	voiceName = $state<string>('');
	memoryExtractionEnabled = $state<boolean>(true);
	proactiveCheckInsEnabled = $state<boolean>(true);
	proactiveCheckInFrequency = $state<'daily' | 'weekdays'>('daily');
	proactiveCheckInTime = $state<'morning' | 'afternoon' | 'evening'>('morning');

	constructor() {
		if (browser) {
			const saved = localStorage.getItem('moonday_settings');
			if (saved) {
				try {
					const parsed = JSON.parse(saved);
					if (parsed.provider) this.provider = parsed.provider;
					if (parsed.model) this.model = parsed.model;
					if (parsed.responseLanguage) this.responseLanguage = parsed.responseLanguage;
					if (parsed.voiceInputEnabled !== undefined)
						this.voiceInputEnabled = parsed.voiceInputEnabled;
					if (parsed.voiceOutputEnabled !== undefined)
						this.voiceOutputEnabled = parsed.voiceOutputEnabled;
					if (typeof parsed.voiceRate === 'number' && parsed.voiceRate >= 0.7 && parsed.voiceRate <= 1.3)
						this.voiceRate = parsed.voiceRate;
					if (typeof parsed.voiceName === 'string') this.voiceName = parsed.voiceName;
					if (parsed.memoryExtractionEnabled !== undefined)
						this.memoryExtractionEnabled = parsed.memoryExtractionEnabled;
					if (parsed.proactiveCheckInsEnabled !== undefined)
						this.proactiveCheckInsEnabled = parsed.proactiveCheckInsEnabled;
					if (
						parsed.proactiveCheckInFrequency === 'daily' ||
						parsed.proactiveCheckInFrequency === 'weekdays'
					)
						this.proactiveCheckInFrequency = parsed.proactiveCheckInFrequency;
					if (['morning', 'afternoon', 'evening'].includes(parsed.proactiveCheckInTime))
						this.proactiveCheckInTime = parsed.proactiveCheckInTime;
				} catch (e) {
					console.error('Failed to parse saved settings:', e);
				}
			}

			// Auto save settings when changed
			$effect.root(() => {
				$effect(() => {
					localStorage.setItem(
						'moonday_settings',
						JSON.stringify({
							provider: this.provider,
							model: this.model,
							responseLanguage: this.responseLanguage,
							voiceInputEnabled: this.voiceInputEnabled,
							voiceOutputEnabled: this.voiceOutputEnabled,
							voiceRate: this.voiceRate,
							voiceName: this.voiceName,
							memoryExtractionEnabled: this.memoryExtractionEnabled,
							proactiveCheckInsEnabled: this.proactiveCheckInsEnabled,
							proactiveCheckInFrequency: this.proactiveCheckInFrequency,
							proactiveCheckInTime: this.proactiveCheckInTime
						})
					);
				});
			});
		}
	}

	setProvider(provider: 'deepseek' | 'claude' | 'groq') {
		this.provider = provider;
		if (provider === 'deepseek') {
			this.model = 'deepseek-chat';
		} else if (provider === 'claude') {
			this.model = 'claude-3-5-sonnet-latest';
		} else {
			this.model = 'llama-3.3-70b-versatile';
		}
	}

	setModel(model: string) {
		this.model = model;
	}

	setResponseLanguage(language: 'auto' | 'en' | 'id') {
		this.responseLanguage = language;
	}

	toggleVoiceInput() {
		this.voiceInputEnabled = !this.voiceInputEnabled;
	}

	toggleVoiceOutput() {
		this.voiceOutputEnabled = !this.voiceOutputEnabled;
	}

	setVoiceRate(rate: number) {
		this.voiceRate = Math.min(1.3, Math.max(0.7, rate));
	}

	setVoiceName(name: string) {
		this.voiceName = name;
	}

	toggleMemoryExtraction() {
		this.memoryExtractionEnabled = !this.memoryExtractionEnabled;
	}

	toggleProactiveCheckIns() {
		this.proactiveCheckInsEnabled = !this.proactiveCheckInsEnabled;
	}

	setProactiveCheckInFrequency(frequency: 'daily' | 'weekdays') {
		this.proactiveCheckInFrequency = frequency;
	}

	setProactiveCheckInTime(time: 'morning' | 'afternoon' | 'evening') {
		this.proactiveCheckInTime = time;
	}

	async clearAllData() {
		if (browser) {
			try {
				await fetch('/api/memories', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ clearAll: true })
				});
			} catch (e) {
				console.error('Failed to clear database data:', e);
			}
			localStorage.clear();
			window.location.reload();
		}
	}
}

export const settingsStore = new SettingsStore();
