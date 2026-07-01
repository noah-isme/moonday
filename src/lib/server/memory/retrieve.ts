import { db } from '../db';
import { memories, memoryEmbeddings } from '../db/schema';
import { embeddingService } from '../ai/embeddings';
import { eq, sql } from 'drizzle-orm';

export async function retrieveMemories(
	userId: string,
	queryText: string,
	limit = 5,
	similarityThreshold = 0.5
): Promise<
	Array<{ id: string; type: string; title: string; content: string; similarity: number }>
> {
	try {
		const queryEmbedding = await embeddingService.getEmbedding(queryText);
		const embeddingString = `[${queryEmbedding.join(',')}]`;

		// Perform similarity search using pgvector cosine distance operator <=>
		// 1 - (embedding <=> queryEmbedding) = cosine similarity
		const results = await db
			.select({
				id: memories.id,
				type: memories.type,
				title: memories.title,
				content: memories.content,
				similarity: sql<number>`1 - (${memoryEmbeddings.embedding} <=> ${embeddingString}::vector)`
			})
			.from(memories)
			.innerJoin(memoryEmbeddings, eq(memories.id, memoryEmbeddings.memoryId))
			.where(sql`${memories.userId} = ${userId}`)
			.orderBy(sql`${memoryEmbeddings.embedding} <=> ${embeddingString}::vector`)
			.limit(limit);

		// Filter by similarity threshold
		return results.filter((r) => r.similarity >= similarityThreshold);
	} catch (error) {
		console.error('Failed to retrieve memories:', error);
		// Return empty list as fallback
		return [];
	}
}
