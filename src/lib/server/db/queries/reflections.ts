import { db } from '../client';
import { dailyReflections } from '../schema';
import { eq, desc, and } from 'drizzle-orm';

export interface CreateReflectionInput {
	userId: string;
	date: string; // 'YYYY-MM-DD'
	moodSummary?: string;
	emotionalSummary?: string;
	importantEvents?: string;
	suggestedFocus?: string;
}

export interface UpdateReflectionInput {
	moodSummary?: string;
	emotionalSummary?: string;
	importantEvents?: string;
	suggestedFocus?: string;
}

export async function createDailyReflection(input: CreateReflectionInput) {
	const [result] = await db
		.insert(dailyReflections)
		.values({
			userId: input.userId,
			date: input.date,
			moodSummary: input.moodSummary,
			emotionalSummary: input.emotionalSummary,
			importantEvents: input.importantEvents,
			suggestedFocus: input.suggestedFocus
		})
		.returning();
	return result;
}

export async function getDailyReflectionByDate(userId: string, date: string) {
	const [result] = await db
		.select()
		.from(dailyReflections)
		.where(and(eq(dailyReflections.userId, userId), eq(dailyReflections.date, date)))
		.limit(1);
	return result || null;
}

export async function getDailyReflectionsByUserId(userId: string, limitVal = 30) {
	return db
		.select()
		.from(dailyReflections)
		.where(eq(dailyReflections.userId, userId))
		.orderBy(desc(dailyReflections.date))
		.limit(limitVal);
}

export async function updateDailyReflection(id: string, input: UpdateReflectionInput) {
	const [result] = await db
		.update(dailyReflections)
		.set({
			...input,
			updatedAt: new Date()
		})
		.where(eq(dailyReflections.id, id))
		.returning();
	return result || null;
}

export async function deleteDailyReflection(id: string) {
	const [result] = await db.delete(dailyReflections).where(eq(dailyReflections.id, id)).returning();
	return result || null;
}
