import { db } from '../client';
import { messages } from '../schema';
import { eq, asc } from 'drizzle-orm';

export interface CreateMessageInput {
	conversationId: string;
	role: string; // 'user' | 'assistant' | 'system'
	content: string;
	provider?: string;
	model?: string;
	emotionLabel?: string;
	moodScore?: number;
}

export async function createMessage(input: CreateMessageInput) {
	const [result] = await db
		.insert(messages)
		.values({
			conversationId: input.conversationId,
			role: input.role,
			content: input.content,
			provider: input.provider,
			model: input.model,
			emotionLabel: input.emotionLabel,
			moodScore: input.moodScore
		})
		.returning();
	return result;
}

export async function getMessagesByConversationId(conversationId: string) {
	return db
		.select()
		.from(messages)
		.where(eq(messages.conversationId, conversationId))
		.orderBy(asc(messages.createdAt));
}

export async function updateMessageEmotion(id: string, emotionLabel: string, moodScore: number) {
	const [result] = await db
		.update(messages)
		.set({
			emotionLabel,
			moodScore
		})
		.where(eq(messages.id, id))
		.returning();
	return result || null;
}

export async function deleteMessagesByConversationId(conversationId: string) {
	return db.delete(messages).where(eq(messages.conversationId, conversationId)).returning();
}
