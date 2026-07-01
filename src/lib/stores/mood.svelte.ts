import { browser } from '$app/environment';

export interface MoodLog {
	id: string;
	moodLabel: string;
	moodScore: number; // -5 to 5
	energyLevel: number; // 1 to 5
	stressLevel: number; // 1 to 5
	note: string;
	createdAt: string;
}

export const MOODS = [
	{ label: 'happy', emoji: '😊', score: 4, color: 'text-yellow-400 bg-yellow-400/10' },
	{ label: 'motivated', emoji: '🚀', score: 5, color: 'text-cyan-400 bg-cyan-400/10' },
	{ label: 'hopeful', emoji: '✨', score: 3, color: 'text-violet-400 bg-violet-400/10' },
	{ label: 'calm', emoji: '🌙', score: 2, color: 'text-teal-400 bg-teal-400/10' },
	{ label: 'neutral', emoji: '😐', score: 0, color: 'text-slate-400 bg-slate-400/10' },
	{ label: 'tired', emoji: '🥱', score: -1, color: 'text-amber-600 bg-amber-600/10' },
	{ label: 'confused', emoji: '🌀', score: -2, color: 'text-purple-400 bg-purple-400/10' },
	{ label: 'anxious', emoji: '😰', score: -3, color: 'text-orange-400 bg-orange-400/10' },
	{ label: 'sad', emoji: '😢', score: -4, color: 'text-blue-400 bg-blue-400/10' },
	{ label: 'lonely', emoji: '👤', score: -3, color: 'text-indigo-400 bg-indigo-400/10' },
	{ label: 'angry', emoji: '😠', score: -4, color: 'text-red-400 bg-red-400/10' },
	{ label: 'overwhelmed', emoji: '🤯', score: -5, color: 'text-rose-500 bg-rose-500/10' }
];

// Helper to generate some dummy historical data if none exists
const getInitialLogs = (): MoodLog[] => {
	const defaultLogs: MoodLog[] = [
		{
			id: '1',
			moodLabel: 'calm',
			moodScore: 2,
			energyLevel: 3,
			stressLevel: 2,
			note: 'Had a quiet evening, finished some reading.',
			createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
		},
		{
			id: '2',
			moodLabel: 'motivated',
			moodScore: 5,
			energyLevel: 5,
			stressLevel: 3,
			note: 'Started building the new project, feeling very productive.',
			createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
		},
		{
			id: '3',
			moodLabel: 'tired',
			moodScore: -1,
			energyLevel: 1,
			stressLevel: 2,
			note: 'Woke up late, feeling a bit sluggish today.',
			createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
		},
		{
			id: '4',
			moodLabel: 'anxious',
			moodScore: -3,
			energyLevel: 3,
			stressLevel: 4,
			note: 'A bit worried about the upcoming review. Slept poorly.',
			createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
		}
	];
	return defaultLogs;
};

export class MoodStore {
	logs = $state<MoodLog[]>([]);
	checkedInToday = $derived.by(() => {
		if (this.logs.length === 0) return false;
		const todayStr = new Date().toDateString();
		return this.logs.some((log) => new Date(log.createdAt).toDateString() === todayStr);
	});

	currentCheckIn = $state<{
		moodLabel: string;
		moodScore: number;
		energyLevel: number;
		stressLevel: number;
		note: string;
	}>({
		moodLabel: 'calm',
		moodScore: 2,
		energyLevel: 3,
		stressLevel: 3,
		note: ''
	});

	constructor() {
		if (browser) {
			const saved = localStorage.getItem('moonday_mood_logs');
			if (saved) {
				try {
					this.logs = JSON.parse(saved);
				} catch (e) {
					console.error('Failed to parse mood logs:', e);
					this.logs = getInitialLogs();
				}
			} else {
				this.logs = getInitialLogs();
				localStorage.setItem('moonday_mood_logs', JSON.stringify(this.logs));
			}
		}
	}

	selectMood(label: string) {
		const mood = MOODS.find((m) => m.label === label);
		if (mood) {
			this.currentCheckIn.moodLabel = label;
			this.currentCheckIn.moodScore = mood.score;
		}
	}

	async submitCheckIn() {
		const newLog: MoodLog = {
			id: crypto.randomUUID(),
			moodLabel: this.currentCheckIn.moodLabel,
			moodScore: this.currentCheckIn.moodScore,
			energyLevel: this.currentCheckIn.energyLevel,
			stressLevel: this.currentCheckIn.stressLevel,
			note: this.currentCheckIn.note,
			createdAt: new Date().toISOString()
		};

		this.logs = [newLog, ...this.logs];
		if (browser) {
			localStorage.setItem('moonday_mood_logs', JSON.stringify(this.logs));
		}

		// Reset note field
		this.currentCheckIn.note = '';

		// Optional: post to backend API /api/mood
		try {
			await fetch('/api/mood', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newLog)
			});
		} catch (e) {
			console.log('API is offline or mock environment active. Saved locally.');
		}
	}

	deleteLog(id: string) {
		this.logs = this.logs.filter((log) => log.id !== id);
		if (browser) {
			localStorage.setItem('moonday_mood_logs', JSON.stringify(this.logs));
		}
	}
}

export const moodStore = new MoodStore();
