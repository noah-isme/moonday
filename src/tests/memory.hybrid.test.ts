import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, client } from '../lib/server/db/client';
import { users } from '../lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { saveMemory, clearAllLocalData } from '../lib/server/memory/save';
import { retrieveMemories } from '../lib/server/memory/retrieve';
import { embeddingService } from '../lib/server/ai/embeddings';

describe('Hybrid Memory Retrieve Engine', () => {
	let testUserId: string;

	beforeAll(async () => {
		// Clean up any test users from previous runs
		await db.delete(users).where(eq(users.displayName, 'Hybrid Test User'));

		// Insert a test user
		const [user] = await db
			.insert(users)
			.values({
				displayName: 'Hybrid Test User'
			})
			.returning();
		testUserId = user.id;
	});

	afterAll(async () => {
		if (testUserId) {
			await clearAllLocalData(testUserId);
			await db.delete(users).where(eq(users.id, testUserId));
		}
		await client.end();
	});

	it('should retrieve, rank, filter and format memories correctly', async () => {
		const originalGetEmbedding = embeddingService.getEmbedding;

		// Mock embedding service to return controlled cosine similarities
		const queryVector = new Array(384).fill(0);
		queryVector[0] = 1.0;

		const vectorWithSimilarityOf = (s: number, index: number) => {
			const vec = new Array(384).fill(0);
			vec[0] = s;
			vec[index] = Math.sqrt(1 - s * s);
			return vec;
		};

		embeddingService.getEmbedding = async (text: string) => {
			if (text.includes('green tea')) {
				return vectorWithSimilarityOf(0.85, 1);
			} else if (text.includes('coffee')) {
				return vectorWithSimilarityOf(0.65, 2);
			} else if (text.includes('Seattle')) {
				return vectorWithSimilarityOf(0.35, 3);
			}
			// Default query vector
			return queryVector;
		};

		try {
			// Clear any memories
			await clearAllLocalData(testUserId);

			// Save 3 memories
			const m1 = await saveMemory(testUserId, {
				type: 'preference',
				title: 'Tea Preference',
				content: 'User likes green tea.',
				importance: 5,
				confidence: 0.95
			});
			expect(m1).not.toBeNull();

			const m2 = await saveMemory(testUserId, {
				type: 'preference',
				title: 'Coffee preference',
				content: 'User dislikes coffee.',
				importance: 3,
				confidence: 0.9
			});
			expect(m2).not.toBeNull();

			const m3 = await saveMemory(testUserId, {
				type: 'preference',
				title: 'Seattle location',
				content: 'User lives in Seattle.',
				importance: 1,
				confidence: 0.92
			});
			expect(m3).not.toBeNull();

			// Test Case 1: similarityThreshold = 0.5
			const context1 = await retrieveMemories(testUserId, 'Find preferences', 5, 0.5);
			expect(context1).toContain('Relevant memories:');
			expect(context1).toContain('- [preference] User likes green tea.');
			expect(context1).toContain('- [preference] User dislikes coffee.');
			expect(context1).not.toContain('User lives in Seattle.');

			// Test Case 2: similarityThreshold = 0.7
			const context2 = await retrieveMemories(testUserId, 'Find preferences', 5, 0.7);
			expect(context2).toContain('Relevant memories:');
			expect(context2).toContain('- [preference] User likes green tea.');
			expect(context2).not.toContain('User dislikes coffee.');

			// Test Case 3: similarityThreshold = 0.9 (no memories should match)
			const context3 = await retrieveMemories(testUserId, 'Find preferences', 5, 0.9);
			expect(context3).toBe('');

		} finally {
			embeddingService.getEmbedding = originalGetEmbedding;
		}
	});

	it('should return empty string on retrieval failure', async () => {
		const originalGetEmbedding = embeddingService.getEmbedding;
		embeddingService.getEmbedding = async () => {
			throw new Error('Database or AI provider error');
		};

		try {
			const context = await retrieveMemories(testUserId, 'anything', 5, 0.5);
			expect(context).toBe('');
		} finally {
			embeddingService.getEmbedding = originalGetEmbedding;
		}
	});
});
