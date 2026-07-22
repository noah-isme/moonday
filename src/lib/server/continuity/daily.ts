export type DailyContinuityInput = {
	latestMood?: {
		moodLabel: string;
		moodScore: number;
		energyLevel?: number | null;
		stressLevel?: number | null;
	} | null;
	goal?: { title: string; content: string } | null;
	conversationSummary?: string | null;
};

export type DailyContinuity = {
	source: 'mood' | 'goal' | 'conversation' | 'check_in';
	prompt: string;
};

const compact = (value: string, limit = 150) => {
	const normalized = value.replace(/\s+/g, ' ').trim();
	return normalized.length > limit ? `${normalized.slice(0, limit - 1).trimEnd()}…` : normalized;
};

/** Builds one optional, non-diagnostic daily opening from user-approved context. */
export function buildDailyContinuity(input: DailyContinuityInput): DailyContinuity {
	if (input.latestMood && (input.latestMood.stressLevel ?? 0) >= 4) {
		return {
			source: 'mood',
			prompt: `Your last check-in carried a fair amount of stress. We can keep today small—what would make the next hour feel a little lighter?`
		};
	}

	if (input.goal) {
		return {
			source: 'goal',
			prompt: `You previously wanted to work on “${compact(input.goal.title, 90)}.” Would you like to choose one small next step for it today?`
		};
	}

	if (input.conversationSummary) {
		return {
			source: 'conversation',
			prompt: `Yesterday left a thread worth revisiting: ${compact(input.conversationSummary, 180)} Would you like to continue, reflect, or start fresh?`
		};
	}

	return {
		source: 'check_in',
		prompt: `A new day, a small check-in. How are you arriving today?`
	};
}
