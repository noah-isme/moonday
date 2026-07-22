import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, desc, eq, gte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { dailyReflections, memories, moodLogs, users, weeklyReflections } from '$lib/server/db/schema';
import { buildWeeklyDraft, startOfWeek } from '$lib/server/journal/weekly';

async function getUser() {
	let [user] = await db.select().from(users).limit(1);
	if (!user) [user] = await db.insert(users).values({ displayName: 'Local User' }).returning();
	return user;
}

async function sources(userId: string, weekStart: string) {
	const start = new Date(`${weekStart}T00:00:00.000Z`);
	const [moods, reflections, approvedMemories] = await Promise.all([
		db.select({ moodScore: moodLogs.moodScore, stressLevel: moodLogs.stressLevel, createdAt: moodLogs.createdAt }).from(moodLogs).where(and(eq(moodLogs.userId, userId), gte(moodLogs.createdAt, start))).orderBy(desc(moodLogs.createdAt)),
		db.select({ moodSummary: dailyReflections.moodSummary, suggestedFocus: dailyReflections.suggestedFocus }).from(dailyReflections).where(and(eq(dailyReflections.userId, userId), gte(dailyReflections.date, weekStart))).orderBy(desc(dailyReflections.date)).limit(7),
		db.select({ title: memories.title, content: memories.content }).from(memories).where(and(eq(memories.userId, userId), eq(memories.type, 'personal_goal'))).orderBy(desc(memories.updatedAt)).limit(3)
	]);
	return { moods, reflections, goals: approvedMemories };
}

export const GET: RequestHandler = async () => {
	try {
		const user = await getUser();
		const weekStart = startOfWeek();
		const [source, reflection] = await Promise.all([
			sources(user.id, weekStart),
			db.select().from(weeklyReflections).where(and(eq(weeklyReflections.userId, user.id), eq(weeklyReflections.weekStart, weekStart))).limit(1)
		]);
		return json({ weekStart, timeline: source, draft: buildWeeklyDraft(source), reflection: reflection[0] || null });
	} catch {
		return json({ error: { code: 'DATABASE_ERROR', message: 'Unable to load your weekly reflection.' } }, { status: 500 });
	}
};

export const POST: RequestHandler = async () => {
	try {
		const user = await getUser();
		const weekStart = startOfWeek();
		const draft = buildWeeklyDraft(await sources(user.id, weekStart));
		const [reflection] = await db.insert(weeklyReflections).values({ userId: user.id, weekStart, ...draft }).onConflictDoUpdate({ target: [weeklyReflections.userId, weeklyReflections.weekStart], set: { ...draft, status: 'active', correction: null, updatedAt: new Date() } }).returning();
		return json({ reflection }, { status: 201 });
	} catch {
		return json({ error: { code: 'DATABASE_ERROR', message: 'Unable to create your weekly reflection.' } }, { status: 500 });
	}
};

const feedbackSchema = z.object({ id: z.string().uuid(), action: z.enum(['dismiss', 'correct']), correction: z.string().trim().min(1).max(1000).optional() }).refine((value) => value.action !== 'correct' || !!value.correction, { message: 'A correction is required.' });

export const PATCH: RequestHandler = async ({ request }) => {
	try {
		const { id, action, correction } = feedbackSchema.parse(await request.json());
		const [reflection] = await db.update(weeklyReflections).set({ status: action === 'dismiss' ? 'dismissed' : 'corrected', correction: action === 'correct' ? correction : null, updatedAt: new Date() }).where(eq(weeklyReflections.id, id)).returning();
		if (!reflection) return json({ error: { code: 'NOT_FOUND', message: 'Weekly reflection not found.' } }, { status: 404 });
		return json({ reflection });
	} catch (error) {
		if (error instanceof z.ZodError) return json({ error: { code: 'VALIDATION_ERROR', message: 'Please provide a valid correction.' } }, { status: 400 });
		return json({ error: { code: 'DATABASE_ERROR', message: 'Unable to update your weekly reflection.' } }, { status: 500 });
	}
};
