export type MoonState =
	'idle' | 'listening' | 'thinking' | 'speaking' | 'happy' | 'concerned' | 'sleepy';

export class UIStore {
	moonState = $state<MoonState>('idle');
	private timeoutId: any = null;

	setMoonState(state: MoonState) {
		this.moonState = state;

		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}

		if (state === 'speaking' || state === 'thinking') {
			this.timeoutId = setTimeout(() => {
				this.moonState = 'idle';
				this.timeoutId = null;
			}, 10000);
		}
	}
}

export const uiStore = new UIStore();
