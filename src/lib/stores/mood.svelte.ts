import { browser } from '$app/environment';
import { SvelteDate } from 'svelte/reactivity';

export interface MoodLog {
	id: string;
	moodLabel: string;
	moodScore: number; // -5 to 5
	energyLevel: number; // 1 to 5
	stressLevel: number; // 1 to 5
	note: string;
	createdAt: string;
}

export type MoodIconName =
	| 'happy'
	| 'motivated'
	| 'hopeful'
	| 'calm'
	| 'neutral'
	| 'tired'
	| 'confused'
	| 'anxious'
	| 'sad'
	| 'lonely'
	| 'angry'
	| 'overwhelmed';

export const MOODS: {
	label: MoodIconName;
	icon: MoodIconName;
	score: number;
	color: string;
}[] = [
	{ label: 'happy', icon: 'happy', score: 4, color: 'text-yellow-300 bg-yellow-300/10' },
	{ label: 'motivated', icon: 'motivated', score: 5, color: 'text-cyan-300 bg-cyan-300/10' },
	{ label: 'hopeful', icon: 'hopeful', score: 3, color: 'text-violet-300 bg-violet-300/10' },
	{ label: 'calm', icon: 'calm', score: 2, color: 'text-teal-300 bg-teal-300/10' },
	{ label: 'neutral', icon: 'neutral', score: 0, color: 'text-slate-300 bg-slate-300/10' },
	{ label: 'tired', icon: 'tired', score: -1, color: 'text-amber-400 bg-amber-400/10' },
	{ label: 'confused', icon: 'confused', score: -2, color: 'text-purple-300 bg-purple-300/10' },
	{ label: 'anxious', icon: 'anxious', score: -3, color: 'text-orange-300 bg-orange-300/10' },
	{ label: 'sad', icon: 'sad', score: -4, color: 'text-blue-300 bg-blue-300/10' },
	{ label: 'lonely', icon: 'lonely', score: -3, color: 'text-indigo-300 bg-indigo-300/10' },
	{ label: 'angry', icon: 'angry', score: -4, color: 'text-red-300 bg-red-300/10' },
	{
		label: 'overwhelmed',
		icon: 'overwhelmed',
		score: -5,
		color: 'text-rose-300 bg-rose-300/10'
	}
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
		const todayStr = new SvelteDate().toDateString();
		return this.logs.some((log) => new SvelteDate(log.createdAt).toDateString() === todayStr);
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
			createdAt: new SvelteDate().toISOString()
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
		} catch {
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
