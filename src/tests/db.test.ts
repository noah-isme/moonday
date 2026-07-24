import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, client } from '../lib/server/db/client';
import { users } from '../lib/server/db/schema';
import {
	createConversation,
	getConversationById,
	getConversationsByUserId,
	updateConversation
} from '../lib/server/db/queries/conversations';
import {
	createMessage,
	getMessagesByConversationId,
	updateMessageEmotion
} from '../lib/server/db/queries/messages';
import {
	createMoodLog,
	getMoodLogsByUserId,
	getLatestMoodLogByUserId
} from '../lib/server/db/queries/mood';
import {
	createMemoryWithEmbedding,
	getMemoriesByUserId,
	searchMemories,
	deleteMemory
} from '../lib/server/db/queries/memories';
import {
	createDailyReflection,
	getDailyReflectionByDate,
	getDailyReflectionsByUserId
} from '../lib/server/db/queries/reflections';
import {
	getCharacterProfiles,
	getDefaultCharacterProfile
} from '../lib/server/db/queries/characters';
import { eq } from 'drizzle-orm';

describe('Database and Schema Operations', () => {
	let testUserId: string;
	let testConversationId: string;
	let testCharacterId: string;
	let testMessageId: string;

	beforeAll(async () => {
		// Clean up any test users from previous runs
		await db.delete(users).where(eq(users.displayName, 'Test User'));

		// Insert a test user
		const [user] = await db
			.insert(users)
			.values({
				displayName: 'Test User'
			})
			.returning();
		testUserId = user.id;

		// Get default character
		const defaultChar = await getDefaultCharacterProfile();
		if (defaultChar) {
			testCharacterId = defaultChar.id;
		} else {
			const profiles = await getCharacterProfiles();
			if (profiles.length > 0) {
				testCharacterId = profiles[0].id;
			}
		}
	});

	afterAll(async () => {
		if (testUserId) {
			await db.delete(users).where(eq(users.id, testUserId));
		}
		await client.end();
	});

	it('should check if character profiles were successfully seeded', async () => {
		const profiles = await getCharacterProfiles();
		expect(profiles.length).toBeGreaterThan(0);

		const defaultProfile = await getDefaultCharacterProfile();
		expect(defaultProfile).not.toBeNull();
		expect(defaultProfile?.name).toBe('Friendly MOONDAY');
	});

	it('should support conversations CRUD', async () => {
		const conv = await createConversation({
			userId: testUserId,
			title: 'Initial Reflection Session',
			activeCharacterId: testCharacterId,
			summary: 'User wants to test database capabilities',
			lastEmotionLabel: 'motivated',
			lastMoodScore: 4
		});

		expect(conv).not.toBeNull();
		expect(conv.id).toBeDefined();
		testConversationId = conv.id;

		// Retrieve
		const fetched = await getConversationById(testConversationId);
		expect(fetched).not.toBeNull();
		expect(fetched?.title).toBe('Initial Reflection Session');

		// List
		const list = await getConversationsByUserId(testUserId);
		expect(list.some((c) => c.id === testConversationId)).toBe(true);

		// Update
		const updated = await updateConversation(testConversationId, {
			title: 'Updated Reflection Session',
			lastMoodScore: 5
		});
		expect(updated?.title).toBe('Updated Reflection Session');
		expect(updated?.lastMoodScore).toBe(5);
	});

	it('should support messages operations', async () => {
		const msg = await createMessage({
			conversationId: testConversationId,
			role: 'user',
			content: "Hello, MOONDAY. Let's explore some reflections.",
			provider: 'deepseek',
			model: 'deepseek-chat',
			emotionLabel: 'neutral',
			moodScore: 0
		});

		expect(msg).not.toBeNull();
		expect(msg.id).toBeDefined();
		testMessageId = msg.id;

		// Fetch messages
		const msgs = await getMessagesByConversationId(testConversationId);
		expect(msgs.length).toBeGreaterThan(0);
		expect(msgs[0].content).toBe("Hello, MOONDAY. Let's explore some reflections.");

		// Update emotion
		const updated = await updateMessageEmotion(testMessageId, 'happy', 4);
		expect(updated?.emotionLabel).toBe('happy');
		expect(updated?.moodScore).toBe(4);
	});

	it('should support mood logging operations', async () => {
		const mood = await createMoodLog({
			userId: testUserId,
			moodLabel: 'hopeful',
			moodScore: 3,
			energyLevel: 4,
			stressLevel: 2,
			note: 'Feeling positive about building the database.'
		});

		expect(mood).not.toBeNull();
		expect(mood.moodLabel).toBe('hopeful');

		const latest = await getLatestMoodLogByUserId(testUserId);
		expect(latest).not.toBeNull();
		expect(latest?.moodLabel).toBe('hopeful');

		const logs = await getMoodLogsByUserId(testUserId);
		expect(logs.length).toBeGreaterThan(0);
	});

	it('should support memories and pgvector similarity search operations', async () => {
		// Create test memory with dummy embedding
		const mockEmbedding1 = new Array(384).fill(0).map((_, i) => (i === 0 ? 1.0 : 0.0));
		const mockEmbedding2 = new Array(384).fill(0).map((_, i) => (i === 1 ? 1.0 : 0.0));

		const memory1 = await createMemoryWithEmbedding(
			{
				userId: testUserId,
				type: 'preference',
				title: 'Coding Preference',
				content: 'User prefers using TypeScript for server-side logic.',
				importance: 8,
				confidence: 0.95,
				sourceConversationId: testConversationId,
				sourceMessageId: testMessageId
			},
			mockEmbedding1
		);

		const memory2 = await createMemoryWithEmbedding(
			{
				userId: testUserId,
				type: 'personal_goal',
				title: 'Database Goal',
				content: 'User wants to launch an AI daily companion application.',
				importance: 9,
				confidence: 0.98,
				sourceConversationId: testConversationId,
				sourceMessageId: testMessageId
			},
			mockEmbedding2
		);

		expect(memory1).not.toBeNull();
		expect(memory2).not.toBeNull();

		// Get all memories
		const list = await getMemoriesByUserId(testUserId);
		expect(list.length).toBeGreaterThanOrEqual(2);

		// Similarity search using vector query close to mockEmbedding1
		const queryVec = new Array(384).fill(0).map((_, i) => (i === 0 ? 0.99 : i === 1 ? 0.01 : 0.0));
		const searchResults = await searchMemories(testUserId, queryVec, 5);

		expect(searchResults.length).toBeGreaterThan(0);
		// The first result should be the coding preference memory (mockEmbedding1) because its first dimension is 1.0
		expect(searchResults[0].title).toBe('Coding Preference');
		expect(searchResults[0].similarity).toBeGreaterThan(0.95);

		// Clean up
		await deleteMemory(memory1.id);
		await deleteMemory(memory2.id);
	});

	it('should support daily reflections operations', async () => {
		const dateStr = '2026-07-01';
		const reflection = await createDailyReflection({
			userId: testUserId,
			date: dateStr,
			moodSummary: 'A productive day setting up local database infrastructure.',
			emotionalSummary: 'Motivated and focused with minimal stress.',
			importantEvents: 'Successfully completed PostgreSQL schema migrations and enabled pgvector.',
			suggestedFocus: 'Focus on database query testing tomorrow.'
		});

		expect(reflection).not.toBeNull();
		expect(reflection.date).toBe(dateStr);

		const fetched = await getDailyReflectionByDate(testUserId, dateStr);
		expect(fetched).not.toBeNull();
		expect(fetched?.moodSummary).toBe('A productive day setting up local database infrastructure.');

		const history = await getDailyReflectionsByUserId(testUserId);
		expect(history.length).toBeGreaterThan(0);
		expect(history[0].date).toBe(dateStr);
	});
});
