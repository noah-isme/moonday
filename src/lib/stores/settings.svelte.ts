import { browser } from '$app/environment';

export class SettingsStore {
	provider = $state<'deepseek' | 'claude' | 'groq'>('deepseek');
	model = $state<string>('deepseek-chat');
	voiceInputEnabled = $state<boolean>(true);
	voiceOutputEnabled = $state<boolean>(true);
	memoryExtractionEnabled = $state<boolean>(true);

	constructor() {
		if (browser) {
			const saved = localStorage.getItem('moonday_settings');
			if (saved) {
				try {
					const parsed = JSON.parse(saved);
					if (parsed.provider) this.provider = parsed.provider;
					if (parsed.model) this.model = parsed.model;
					if (parsed.voiceInputEnabled !== undefined)
						this.voiceInputEnabled = parsed.voiceInputEnabled;
					if (parsed.voiceOutputEnabled !== undefined)
						this.voiceOutputEnabled = parsed.voiceOutputEnabled;
					if (parsed.memoryExtractionEnabled !== undefined)
						this.memoryExtractionEnabled = parsed.memoryExtractionEnabled;
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
							voiceInputEnabled: this.voiceInputEnabled,
							voiceOutputEnabled: this.voiceOutputEnabled,
							memoryExtractionEnabled: this.memoryExtractionEnabled
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

	toggleVoiceInput() {
		this.voiceInputEnabled = !this.voiceInputEnabled;
	}

	toggleVoiceOutput() {
		this.voiceOutputEnabled = !this.voiceOutputEnabled;
	}

	toggleMemoryExtraction() {
		this.memoryExtractionEnabled = !this.memoryExtractionEnabled;
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
