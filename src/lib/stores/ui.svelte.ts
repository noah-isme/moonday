export type MoonState =
	'idle' | 'listening' | 'thinking' | 'speaking' | 'happy' | 'concerned' | 'sleepy';

export type NoticeTone = 'success' | 'info' | 'error';

export type UINotice = {
	message: string;
	tone: NoticeTone;
};

export class UIStore {
	moonState = $state<MoonState>('idle');
	notice = $state<UINotice | null>(null);
	private timeoutId: any = null;
	private noticeTimeoutId: any = null;

	setNotice(message: string, tone: NoticeTone = 'success') {
		this.notice = { message, tone };
		if (this.noticeTimeoutId) clearTimeout(this.noticeTimeoutId);
		this.noticeTimeoutId = setTimeout(() => {
			this.notice = null;
			this.noticeTimeoutId = null;
		}, 4000);
	}

	clearNotice() {
		this.notice = null;
		if (this.noticeTimeoutId) clearTimeout(this.noticeTimeoutId);
		this.noticeTimeoutId = null;
	}

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
