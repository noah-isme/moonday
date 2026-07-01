import { db } from '../client';
import { moodLogs } from '../schema';
import { eq, desc, gte, lte, and } from 'drizzle-orm';

export interface CreateMoodLogInput {
	userId: string;
	moodLabel: string;
	moodScore: number; // -5 to 5
	energyLevel?: number;
	stressLevel?: number;
	note?: string;
	createdAt?: Date;
}

export async function createMoodLog(input: CreateMoodLogInput) {
	const [result] = await db
		.insert(moodLogs)
		.values({
			userId: input.userId,
			moodLabel: input.moodLabel,
			moodScore: input.moodScore,
			energyLevel: input.energyLevel,
			stressLevel: input.stressLevel,
			note: input.note,
			createdAt: input.createdAt || new Date()
		})
		.returning();
	return result;
}

export async function getMoodLogsByUserId(userId: string, limitVal = 50) {
	return db
		.select()
		.from(moodLogs)
		.where(eq(moodLogs.userId, userId))
		.orderBy(desc(moodLogs.createdAt))
		.limit(limitVal);
}

export async function getMoodLogsInDateRange(userId: string, startDate: Date, endDate: Date) {
	return db
		.select()
		.from(moodLogs)
		.where(
			and(
				eq(moodLogs.userId, userId),
				gte(moodLogs.createdAt, startDate),
				lte(moodLogs.createdAt, endDate)
			)
		)
		.orderBy(desc(moodLogs.createdAt));
}

export async function getLatestMoodLogByUserId(userId: string) {
	const [result] = await db
		.select()
		.from(moodLogs)
		.where(eq(moodLogs.userId, userId))
		.orderBy(desc(moodLogs.createdAt))
		.limit(1);
	return result || null;
}

export async function deleteMoodLog(id: string) {
	const [result] = await db.delete(moodLogs).where(eq(moodLogs.id, id)).returning();
	return result || null;
}
