import { db } from '../db';
import {
	memories,
	memoryEmbeddings,
	conversations,
	moodLogs,
	dailyReflections
} from '../db/schema';
import { embeddingService } from '../ai/embeddings';
import type { ExtractedMemory } from './types';
import { isSensitiveContent } from './extract';
import { eq } from 'drizzle-orm';
import { searchMemories, getMemoriesByUserId } from '../db/queries/memories';

export async function saveMemory(
	userId: string,
	extracted: ExtractedMemory,
	sourceConversationId?: string,
	sourceMessageId?: string
): Promise<string | null> {
	// 1. Enforce confidence score threshold >= 0.7 for saving memories
	if (extracted.confidence < 0.7) {
		console.log(
			`Blocked memory saving: confidence score (${extracted.confidence}) is below 0.7 threshold.`
		);
		return null;
	}

	// 2. Filter out sensitive data (passwords, credentials, API tokens, medical information, private keys)
	if (isSensitiveContent(extracted.content) || isSensitiveContent(extracted.title)) {
		console.log(`Blocked memory saving: content or title contains sensitive data.`);
		return null;
	}

	// 3. Prevent Duplicate Memories: Implement checks using exact text matching
	try {
		const existing = await getMemoriesByUserId(userId);
		const normalizedContent = extracted.content.toLowerCase().trim();
		const isExactDuplicate = existing.some(
			(m) => m.content.toLowerCase().trim() === normalizedContent
		);

		if (isExactDuplicate) {
			console.log(`Blocked duplicate memory (exact text match): "${extracted.content}"`);
			return null;
		}
	} catch (err) {
		console.error('Error checking exact duplicate memories:', err);
	}

	// 4. Generate embedding first (needed for similarity check and storing)
	let embedding: number[] = [];
	try {
		const embeddingText = `${extracted.title}: ${extracted.content}`;
		embedding = await embeddingService.getEmbedding(embeddingText);
	} catch (error) {
		console.error(`Failed to generate embedding for similarity check:`, error);
		return null;
	}

	// 5. Prevent Duplicate Memories: Implement checks using cosine similarity (via pgvector semantic search)
	try {
		const similar = await searchMemories(userId, embedding, 1);
		if (similar.length > 0 && similar[0].similarity >= 0.9) {
			console.log(
				`Blocked duplicate memory (cosine similarity: ${similar[0].similarity.toFixed(4)}): "${extracted.content}"`
			);
			return null;
		}
	} catch (err) {
		console.error('Error checking similarity duplicate memories:', err);
	}

	// 6. Insert memory metadata
	const [insertedMemory] = await db
		.insert(memories)
		.values({
			userId,
			type: extracted.type,
			title: extracted.title,
			content: extracted.content,
			importance: extracted.importance,
			confidence: extracted.confidence,
			sourceConversationId: sourceConversationId || null,
			sourceMessageId: sourceMessageId || null,
			isSensitive: false
		})
		.returning();

	if (!insertedMemory) {
		throw new Error('Failed to insert memory');
	}

	// 7. Store embedding
	try {
		await db.insert(memoryEmbeddings).values({
			memoryId: insertedMemory.id,
			embedding
		});
	} catch (error) {
		console.error(`Failed to store embedding for memory ID ${insertedMemory.id}:`, error);
	}

	return insertedMemory.id;
}

/**
 * Deletes a single memory by its ID.
 */
export async function deleteMemory(memoryId: string): Promise<void> {
	await db.delete(memories).where(eq(memories.id, memoryId));
}

/**
 * Wipes all cached profiles, chats, reflections, memories, and mood logs stored locally for the user.
 */
export async function clearAllLocalData(userId: string): Promise<void> {
	await db.transaction(async (tx) => {
		// Delete daily reflections
		await tx.delete(dailyReflections).where(eq(dailyReflections.userId, userId));
		// Delete mood logs
		await tx.delete(moodLogs).where(eq(moodLogs.userId, userId));
		// Delete memories (memoryEmbeddings will cascade delete because of foreign key constraint)
		await tx.delete(memories).where(eq(memories.userId, userId));
		// Delete conversations (messages will cascade delete because of foreign key constraint)
		await tx.delete(conversations).where(eq(conversations.userId, userId));
	});
}
