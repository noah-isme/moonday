import { describe, expect, it } from 'vitest';
import { buildDailyContinuity } from '../lib/server/continuity/daily';

describe('daily continuity', () => {
	it('prioritizes a high-stress check-in without diagnosing the user', () => {
		const result = buildDailyContinuity({
			latestMood: { moodLabel: 'overwhelmed', moodScore: -3, stressLevel: 5 }
		});
		expect(result.source).toBe('mood');
		expect(result.prompt).toContain('stress');
	});

	it('follows up on a user goal before a generic conversation recap', () => {
		const result = buildDailyContinuity({
			goal: { title: 'Finish MOONDAY memory controls', content: 'Complete the privacy flow.' },
			conversationSummary: 'User discussed an unfinished task.'
		});
		expect(result.source).toBe('goal');
		expect(result.prompt).toContain('Finish MOONDAY');
	});
});
