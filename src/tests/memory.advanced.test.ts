import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isSensitiveContent } from '../lib/server/memory/extract';
import { saveMemory, deleteMemory, clearAllLocalData } from '../lib/server/memory/save';
import { embeddingService } from '../lib/server/ai/embeddings';
import { db, client } from '../lib/server/db/client';
import { users, conversations, moodLogs, dailyReflections } from '../lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getMemoryById, getMemoriesByUserId } from '../lib/server/db/queries/memories';

describe('Advanced Memory Engine Features', () => {
	let testUserId: string;

	beforeAll(async () => {
		// Clean up any test users from previous runs
		await db.delete(users).where(eq(users.displayName, 'Advanced Test User'));

		// Insert a test user
		const [user] = await db
			.insert(users)
			.values({
				displayName: 'Advanced Test User'
			})
			.returning();
		testUserId = user.id;
	});

	afterAll(async () => {
		if (testUserId) {
			await db.delete(users).where(eq(users.id, testUserId));
		}
		await client.end();
	});

	describe('Sensitivity Filter Rules (isSensitiveContent)', () => {
		it('should detect passwords and secrets', () => {
			expect(isSensitiveContent('My password is super-secret-123')).toBe(true);
			expect(isSensitiveContent('Here is the admin passwd: test')).toBe(true);
			expect(isSensitiveContent('The oauth token is token123')).toBe(true);
			expect(isSensitiveContent('Use API key: key-xyz')).toBe(true);
			expect(isSensitiveContent('jwt key value')).toBe(true);
			expect(isSensitiveContent('bearer abc123xyz')).toBe(true);
		});

		it('should detect private keys', () => {
			expect(isSensitiveContent('-----BEGIN PRIVATE KEY-----')).toBe(true);
			expect(isSensitiveContent('-----END RSA PRIVATE KEY-----')).toBe(true);
			expect(isSensitiveContent('ssh-rsa AAAAB3NzaC1yc2EAA...')).toBe(true);
			expect(isSensitiveContent('pem private key contents')).toBe(true);
		});

		it('should detect medical information', () => {
			expect(isSensitiveContent('The doctor says my diabetes is chronic')).toBe(true);
			expect(isSensitiveContent('Taking cancer medicine')).toBe(true);
			expect(isSensitiveContent('My psychologist did a symptom check')).toBe(true);
			expect(isSensitiveContent('Got a prescription for therapist therapy')).toBe(true);
		});

		it('should detect coordinates and GPS locations', () => {
			expect(isSensitiveContent('Coordinates: latitude 45.123, longitude -93.123')).toBe(true);
			expect(isSensitiveContent('GPS coordinates: 34.0522° N, 118.2437° W')).toBe(true);
			expect(isSensitiveContent('We are at coords 12.34, 56.78')).toBe(true);
		});

		it('should not false positive on normal conversations', () => {
			expect(isSensitiveContent('I want to build a moon navigation system.')).toBe(false);
			expect(isSensitiveContent('Yesterday I had pasta with tomatoes.')).toBe(false);
			expect(isSensitiveContent('Let us plan our target goal for tomorrow.')).toBe(false);
		});
	});

	describe('Memory Saving, Deduplication and User Controls', () => {
		it('should refuse to save memory if confidence is less than 0.7', async () => {
			const memoryId = await saveMemory(testUserId, {
				type: 'preference',
				title: 'Weak confidence preference',
				content: 'I might prefer green tea.',
				importance: 3,
				confidence: 0.65
			});

			expect(memoryId).toBeNull();
		});

		it('should refuse to save memory if content is sensitive', async () => {
			const memoryId = await saveMemory(testUserId, {
				type: 'core_memory',
				title: 'Sensitive token',
				content: 'My private token is token-abc-123.',
				importance: 5,
				confidence: 0.95
			});

			expect(memoryId).toBeNull();
		});

		it('should save memory successfully if it is valid, confident, and safe', async () => {
			const memoryId = await saveMemory(testUserId, {
				type: 'preference',
				title: 'Valid Preference',
				content: 'User prefers coding Svelte apps with Bun.',
				importance: 8,
				confidence: 0.95
			});

			expect(memoryId).not.toBeNull();
			if (memoryId) {
				const memory = await getMemoryById(memoryId);
				expect(memory).not.toBeNull();
				expect(memory?.title).toBe('Valid Preference');
				expect(memory?.isSensitive).toBe(false);
			}
		});

		it('should refuse to save memory if it is an exact content duplicate', async () => {
			const firstId = await saveMemory(testUserId, {
				type: 'preference',
				title: 'Unique preference',
				content: 'User is vegan and likes oat milk.',
				importance: 6,
				confidence: 0.92
			});
			expect(firstId).not.toBeNull();

			// Exact text duplicate
			const secondId = await saveMemory(testUserId, {
				type: 'preference',
				title: 'Another preference title',
				content: 'User is vegan and likes oat milk.',
				importance: 7,
				confidence: 0.95
			});
			expect(secondId).toBeNull();
		});

		it('should refuse to save memory if it is a semantic cosine duplicate (similarity >= 0.90)', async () => {
			const originalGetEmbedding = embeddingService.getEmbedding;

			const mockVec1 = new Array(384).fill(0).map((_, i) => (i === 0 ? 1.0 : 0.0));
			const mockVec2 = new Array(384)
				.fill(0)
				.map((_, i) => (i === 0 ? 0.95 : i === 1 ? 0.31225 : 0.0));

			let callCount = 0;
			embeddingService.getEmbedding = async () => {
				callCount++;
				if (callCount === 1) return mockVec1;
				return mockVec2;
			};

			try {
				const firstId = await saveMemory(testUserId, {
					type: 'project_memory',
					title: 'Semantic project memory',
					content:
						'User is currently working on building a personal emotional AI companion called MOONDAY.',
					importance: 9,
					confidence: 0.99
				});
				expect(firstId).not.toBeNull();

				// Semantically similar (rephrased slightly)
				const secondId = await saveMemory(testUserId, {
					type: 'project_memory',
					title: 'Rephrased project memory',
					content:
						'User is currently focused on building a personal daily AI companion named MOONDAY.',
					importance: 8,
					confidence: 0.97
				});
				expect(secondId).toBeNull();
			} finally {
				embeddingService.getEmbedding = originalGetEmbedding;
			}
		});

		it('should successfully support deleteMemory control', async () => {
			const id = await saveMemory(testUserId, {
				type: 'personal_goal',
				title: 'Short term goal',
				content: 'To read three technical articles this week.',
				importance: 5,
				confidence: 0.88
			});
			expect(id).not.toBeNull();
			if (id) {
				const beforeDelete = await getMemoryById(id);
				expect(beforeDelete).not.toBeNull();

				await deleteMemory(id);

				const afterDelete = await getMemoryById(id);
				expect(afterDelete).toBeNull();
			}
		});

		it('should successfully wipe all user data with clearAllLocalData', async () => {
			// Create user data across tables
			await db.insert(conversations).values({
				userId: testUserId,
				title: 'Test conversation'
			});

			await db.insert(moodLogs).values({
				userId: testUserId,
				moodLabel: 'calm',
				moodScore: 4
			});

			await db.insert(dailyReflections).values({
				userId: testUserId,
				date: '2026-07-01',
				moodSummary: 'A good test day.'
			});

			const memoryId = await saveMemory(testUserId, {
				type: 'reflection',
				title: 'Wipe reflection',
				content: 'Wipe me out.',
				importance: 5,
				confidence: 0.9
			});
			expect(memoryId).not.toBeNull();

			// Run clearance
			await clearAllLocalData(testUserId);

			// Assertions
			const userConvs = await db
				.select()
				.from(conversations)
				.where(eq(conversations.userId, testUserId));
			const userMoods = await db.select().from(moodLogs).where(eq(moodLogs.userId, testUserId));
			const userReflections = await db
				.select()
				.from(dailyReflections)
				.where(eq(dailyReflections.userId, testUserId));
			const userMemories = await getMemoriesByUserId(testUserId);

			expect(userConvs.length).toBe(0);
			expect(userMoods.length).toBe(0);
			expect(userReflections.length).toBe(0);
			expect(userMemories.length).toBe(0);
		});
	});
});
