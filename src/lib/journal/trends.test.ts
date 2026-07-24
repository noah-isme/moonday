import { describe, expect, it } from 'vitest';
import { buildTrendSeries } from './trends';

const now = new Date('2026-07-24T12:00:00');
const logs = [
	{ moodScore: 2, moodLabel: 'calm', createdAt: '2026-07-24T09:00:00' },
	{ moodScore: 4, moodLabel: 'happy', createdAt: '2026-07-24T13:30:00' },
	{ moodScore: -2, moodLabel: 'confused', createdAt: '2026-07-23T18:00:00' },
	{ moodScore: 5, moodLabel: 'motivated', createdAt: '2026-07-21T10:00:00' },
	{ moodScore: 1, moodLabel: 'calm', createdAt: '2026-07-02T10:00:00' }
];

describe('buildTrendSeries', () => {
	it('keeps individual daily check-ins and labels them by time', () => {
		const series = buildTrendSeries(logs, 'day', now);

		expect(series.map((point) => point.label)).toEqual(['09:00', '13:30']);
		expect(series.map((point) => point.score)).toEqual([2, 4]);
	});

	it('groups the current week by calendar day using the average score', () => {
		const series = buildTrendSeries(logs, 'week', now);

		expect(series.map((point) => point.label)).toEqual(['Tue', 'Thu', 'Fri']);
		expect(series.at(-1)).toMatchObject({ score: 3, count: 2, moodLabel: 'happy' });
	});

	it('groups the current month into calendar weeks', () => {
		const series = buildTrendSeries(logs, 'month', now);

		expect(series.map((point) => point.label)).toEqual(['1–5 Jul', '20–26 Jul']);
		expect(series.at(-1)).toMatchObject({ count: 4, score: 2.25 });
	});
});
