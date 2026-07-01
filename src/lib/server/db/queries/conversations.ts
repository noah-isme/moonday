import { db } from '../client';
import { conversations } from '../schema';
import { eq, desc } from 'drizzle-orm';

export interface CreateConversationInput {
	userId: string;
	title?: string;
	activeCharacterId?: string;
	summary?: string;
	lastEmotionLabel?: string;
	lastMoodScore?: number;
}

export interface UpdateConversationInput {
	title?: string;
	activeCharacterId?: string | null;
	summary?: string;
	lastEmotionLabel?: string;
	lastMoodScore?: number;
}

export async function createConversation(input: CreateConversationInput) {
	const [result] = await db
		.insert(conversations)
		.values({
			userId: input.userId,
			title: input.title || 'New Reflection',
			activeCharacterId: input.activeCharacterId,
			summary: input.summary,
			lastEmotionLabel: input.lastEmotionLabel,
			lastMoodScore: input.lastMoodScore
		})
		.returning();
	return result;
}

export async function getConversationById(id: string) {
	const [result] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
	return result || null;
}

export async function getConversationsByUserId(userId: string) {
	return db
		.select()
		.from(conversations)
		.where(eq(conversations.userId, userId))
		.orderBy(desc(conversations.updatedAt));
}

export async function updateConversation(id: string, input: UpdateConversationInput) {
	const [result] = await db
		.update(conversations)
		.set({
			...input,
			updatedAt: new Date()
		})
		.where(eq(conversations.id, id))
		.returning();
	return result || null;
}

export async function deleteConversation(id: string) {
	const [result] = await db.delete(conversations).where(eq(conversations.id, id)).returning();
	return result || null;
}
