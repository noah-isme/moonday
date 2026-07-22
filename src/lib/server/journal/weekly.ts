export type WeeklyMood = { moodScore: number; stressLevel: number | null; createdAt: Date };
export type WeeklySource = {
	moods: WeeklyMood[];
	goals: Array<{ title: string; content: string }>;
	reflections: Array<{ moodSummary: string | null; suggestedFocus: string | null }>;
};

export function startOfWeek(date = new Date()) {
	const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	const weekday = value.getUTCDay() || 7;
	value.setUTCDate(value.getUTCDate() - weekday + 1);
	return value.toISOString().slice(0, 10);
}

export function buildWeeklyDraft(source: WeeklySource) {
	const averageMood = source.moods.length
		? source.moods.reduce((total, mood) => total + mood.moodScore, 0) / source.moods.length
		: null;
	const stressValues = source.moods.flatMap((mood) =>
		mood.stressLevel === null ? [] : [mood.stressLevel]
	);
	const averageStress = stressValues.length
		? stressValues.reduce((total, stress) => total + stress, 0) / stressValues.length
		: null;
	const focus = source.goals[0]?.content || source.reflections[0]?.suggestedFocus || null;

	return {
		summary:
			averageMood === null
				? 'There are not enough check-ins yet for a weekly mood pattern.'
				: `Your logged mood averaged ${averageMood.toFixed(1)} out of 5 across ${source.moods.length} check-in${source.moods.length === 1 ? '' : 's'} this week.`,
		whatHelped:
			source.reflections[0]?.moodSummary ||
			(source.goals.length ? `You kept ${source.goals[0].title} in view.` : 'No clear helper is recorded yet.'),
		whatFeltHeavy:
			averageStress === null
				? 'No stress pattern is recorded yet.'
				: `Your logged stress averaged ${averageStress.toFixed(1)} out of 5. Treat this as a signal to check in, not a diagnosis.`,
		suggestedFocus: focus || 'Choose one small, realistic thing that would make the next few days easier.'
	};
}
