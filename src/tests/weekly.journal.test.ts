import { describe, expect, it } from 'vitest';
import { buildWeeklyDraft, startOfWeek } from '$lib/server/journal/weekly';

describe('weekly journal reflection', () => {
	it('starts weeks on Monday in UTC', () => {
		expect(startOfWeek(new Date('2026-07-22T12:00:00Z'))).toBe('2026-07-20');
	});

	it('uses logged data and approved goals with tentative language', () => {
		const draft = buildWeeklyDraft({
			moods: [
				{ moodScore: 2, stressLevel: 2, createdAt: new Date() },
				{ moodScore: 0, stressLevel: 4, createdAt: new Date() }
			],
			goals: [{ title: 'MOONDAY', content: 'Finish the journal timeline.' }],
			reflections: []
		});
		expect(draft.summary).toContain('1.0 out of 5');
		expect(draft.whatFeltHeavy).toContain('signal to check in, not a diagnosis');
		expect(draft.suggestedFocus).toBe('Finish the journal timeline.');
	});
});
