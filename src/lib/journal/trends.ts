export type TrendRange = 'day' | 'week' | 'month';

export type TrendLog = {
	moodScore: number;
	moodLabel?: string;
	label?: string;
	createdAt?: string;
	date?: string;
};

export type TrendSeriesPoint = {
	timestamp: number;
	score: number;
	label: string;
	count: number;
	moodLabel?: string;
};

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthLabels = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];

function parseLogDate(log: TrendLog) {
	const value = log.createdAt || log.date;
	if (!value) return null;
	const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
	const start = startOfDay(date);
	const daysSinceMonday = (start.getDay() + 6) % 7;
	start.setDate(start.getDate() - daysSinceMonday);
	return start;
}

function average(values: number[]) {
	return values.reduce((total, value) => total + value, 0) / values.length;
}

function groupLogs(
	logs: Array<{ log: TrendLog; date: Date }>,
	keyFor: (date: Date) => number,
	labelFor: (date: Date) => string
) {
	const groups = new Map<number, Array<{ log: TrendLog; date: Date }>>();

	for (const item of logs) {
		const key = keyFor(item.date);
		groups.set(key, [...(groups.get(key) || []), item]);
	}

	return [...groups.entries()]
		.sort(([a], [b]) => a - b)
		.map(([timestamp, entries]) => {
			const latest = entries.at(-1);
			return {
				timestamp,
				score: average(entries.map(({ log }) => log.moodScore)),
				label: labelFor(new Date(timestamp)),
				count: entries.length,
				moodLabel: latest?.log.moodLabel || latest?.log.label
			};
		});
}

export function buildTrendSeries(
	logs: TrendLog[],
	range: TrendRange,
	now = new Date()
): TrendSeriesPoint[] {
	const validLogs = logs
		.map((log) => ({ log, date: parseLogDate(log) }))
		.filter((item): item is { log: TrendLog; date: Date } => item.date !== null)
		.sort((a, b) => a.date.getTime() - b.date.getTime());

	if (range === 'day') {
		const start = startOfDay(now);
		const end = new Date(start);
		end.setDate(end.getDate() + 1);

		return validLogs
			.filter(({ date }) => date >= start && date < end)
			.map(({ log, date }) => ({
				timestamp: date.getTime(),
				score: log.moodScore,
				label: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(
					2,
					'0'
				)}`,
				count: 1,
				moodLabel: log.moodLabel || log.label
			}));
	}

	if (range === 'week') {
		const start = startOfWeek(now);
		const end = new Date(start);
		end.setDate(end.getDate() + 7);
		const weeklyLogs = validLogs.filter(({ date }) => date >= start && date < end);

		return groupLogs(
			weeklyLogs,
			(date) => startOfDay(date).getTime(),
			(date) => weekdayLabels[date.getDay()]
		);
	}

	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
	const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
	const monthlyLogs = validLogs.filter(({ date }) => date >= monthStart && date < monthEnd);

	return groupLogs(
		monthlyLogs,
		(date) => startOfWeek(date).getTime(),
		(weekStart) => {
			const visibleStart = weekStart < monthStart ? monthStart : weekStart;
			const weekEnd = new Date(weekStart);
			weekEnd.setDate(weekEnd.getDate() + 6);
			const visibleEnd = weekEnd >= monthEnd ? new Date(monthEnd.getTime() - 1) : weekEnd;
			return `${visibleStart.getDate()}–${visibleEnd.getDate()} ${monthLabels[visibleEnd.getMonth()]}`;
		}
	);
}
