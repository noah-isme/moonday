import { db } from '../client';
import { memories, memoryEmbeddings } from '../schema';
import { eq, desc, inArray, sql } from 'drizzle-orm';

export interface CreateMemoryInput {
	userId: string;
	type: string; // 'core_memory' | 'preference' | 'emotional_pattern' | 'project_memory' | 'relationship_context' | 'personal_goal' | 'recurring_problem' | 'reflection'
	title: string;
	content: string;
	importance: number; // 1 to 10
	confidence: number; // 0.0 to 1.0
	sourceConversationId?: string | null;
	sourceMessageId?: string | null;
	isSensitive?: boolean;
}

export interface UpdateMemoryInput {
	type?: string;
	title?: string;
	content?: string;
	importance?: number;
	confidence?: number;
	lastReferencedAt?: Date | null;
	isSensitive?: boolean;
}

export async function createMemory(input: CreateMemoryInput) {
	const [result] = await db
		.insert(memories)
		.values({
			userId: input.userId,
			type: input.type,
			title: input.title,
			content: input.content,
			importance: input.importance,
			confidence: input.confidence,
			sourceConversationId: input.sourceConversationId,
			sourceMessageId: input.sourceMessageId,
			isSensitive: input.isSensitive ?? false
		})
		.returning();
	return result;
}

export async function addMemoryEmbedding(memoryId: string, embedding: number[]) {
	const embeddingString = `[${embedding.join(',')}]`;
	const [result] = await db
		.insert(memoryEmbeddings)
		.values({
			memoryId: memoryId,
			embedding: sql`${embeddingString}::vector`
		})
		.returning();
	return result;
}

export async function createMemoryWithEmbedding(input: CreateMemoryInput, embedding: number[]) {
	return db.transaction(async (tx) => {
		const [memory] = await tx
			.insert(memories)
			.values({
				userId: input.userId,
				type: input.type,
				title: input.title,
				content: input.content,
				importance: input.importance,
				confidence: input.confidence,
				sourceConversationId: input.sourceConversationId,
				sourceMessageId: input.sourceMessageId,
				isSensitive: input.isSensitive ?? false
			})
			.returning();

		const embeddingString = `[${embedding.join(',')}]`;
		await tx.insert(memoryEmbeddings).values({
			memoryId: memory.id,
			embedding: sql`${embeddingString}::vector`
		});

		return memory;
	});
}

export async function getMemoryById(id: string) {
	const [result] = await db.select().from(memories).where(eq(memories.id, id)).limit(1);
	return result || null;
}

export async function getMemoriesByUserId(userId: string) {
	return db
		.select()
		.from(memories)
		.where(eq(memories.userId, userId))
		.orderBy(desc(memories.updatedAt));
}

export async function updateMemory(id: string, input: UpdateMemoryInput) {
	const [result] = await db
		.update(memories)
		.set({
			...input,
			updatedAt: new Date()
		})
		.where(eq(memories.id, id))
		.returning();
	return result || null;
}

export async function deleteMemory(id: string) {
	const [result] = await db.delete(memories).where(eq(memories.id, id)).returning();
	return result || null;
}

export async function searchMemories(userId: string, queryEmbedding: number[], limitVal = 20) {
	const embeddingString = `[${queryEmbedding.join(',')}]`;
	const distance = sql<number>`${memoryEmbeddings.embedding} <=> ${embeddingString}::vector`;

	const results = await db
		.select({
			id: memories.id,
			userId: memories.userId,
			type: memories.type,
			title: memories.title,
			content: memories.content,
			importance: memories.importance,
			confidence: memories.confidence,
			sourceConversationId: memories.sourceConversationId,
			sourceMessageId: memories.sourceMessageId,
			lastReferencedAt: memories.lastReferencedAt,
			isSensitive: memories.isSensitive,
			createdAt: memories.createdAt,
			updatedAt: memories.updatedAt,
			embedding: memoryEmbeddings.embedding,
			similarity: sql<number>`1 - (${distance})`
		})
		.from(memories)
		.innerJoin(memoryEmbeddings, eq(memories.id, memoryEmbeddings.memoryId))
		.where(eq(memories.userId, userId))
		.orderBy(distance)
		.limit(limitVal);

	return results;
}

/** Record only the memories that were actually selected for model context. */
export async function markMemoriesReferenced(memoryIds: string[]) {
	if (memoryIds.length === 0) return;
	await db
		.update(memories)
		.set({ lastReferencedAt: new Date(), updatedAt: new Date() })
		.where(inArray(memories.id, memoryIds));
}
