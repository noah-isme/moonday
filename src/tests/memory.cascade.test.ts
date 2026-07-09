import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { db, client } from '../lib/server/db/client';
import { users, conversations, messages, memories, memoryEmbeddings, characterProfiles } from '../lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createMemoryWithEmbedding } from '../lib/server/db/queries/memories';
import { POST as chatPOST } from '../routes/api/chat/+server';
import { aiRouter } from '../lib/server/ai/router';
import { getDefaultCharacterProfile } from '../lib/server/db/queries/characters';

describe('Memory Cascade and Truncation Sweeper Tests', () => {
	let testUserId: string;
	let testConversationId: string;
	let testCharacterId: string;

	beforeAll(async () => {
		// Clean up or find default character
		const defaultChar = await getDefaultCharacterProfile();
		if (defaultChar) {
			testCharacterId = defaultChar.id;
		} else {
			const profiles = await db.select().from(characterProfiles).limit(1);
			if (profiles.length > 0) {
				testCharacterId = profiles[0].id;
			}
		}

		// Clean up or find/create test user
		const existingUser = await db.select().from(users).where(eq(users.displayName, 'Cascade Test User')).limit(1);
		if (existingUser.length > 0) {
			testUserId = existingUser[0].id;
		} else {
			const [user] = await db
				.insert(users)
				.values({
					displayName: 'Cascade Test User'
				})
				.returning();
			testUserId = user.id;
		}

		// Create a test conversation
		const [conv] = await db
			.insert(conversations)
			.values({
				userId: testUserId,
				activeCharacterId: testCharacterId,
				title: 'Cascade Test Conversation'
			})
			.returning();
		testConversationId = conv.id;
	});

	afterAll(async () => {
		// Clean up conversation
		if (testConversationId) {
			await db.delete(conversations).where(eq(conversations.id, testConversationId));
		}
		// Clean up test user
		if (testUserId) {
			await db.delete(users).where(eq(users.id, testUserId));
		}
		// Close DB connection
		await client.end();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should automatically cascade delete memory and its embeddings when the source message is deleted at DB level', async () => {
		// 1. Create a message
		const [msg] = await db
			.insert(messages)
			.values({
				conversationId: testConversationId,
				role: 'user',
				content: 'Message for cascade testing',
				provider: 'deepseek',
				model: 'deepseek-chat',
				emotionLabel: 'neutral',
				moodScore: 0
			})
			.returning();

		// 2. Create memory with embedding linked to the message
		const mockEmbedding = new Array(384).fill(0).map((_, i) => (i === 0 ? 1.0 : 0.0));
		const memory = await createMemoryWithEmbedding(
			{
				userId: testUserId,
				type: 'preference',
				title: 'Coding Pref Cascade',
				content: 'User prefers TypeScript for scripting.',
				importance: 7,
				confidence: 0.96,
				sourceConversationId: testConversationId,
				sourceMessageId: msg.id
			},
			mockEmbedding
		);

		// 3. Verify they exist in DB
		const memoryInDb = await db.select().from(memories).where(eq(memories.id, memory.id)).limit(1);
		expect(memoryInDb.length).toBe(1);

		const embeddingInDb = await db
			.select()
			.from(memoryEmbeddings)
			.where(eq(memoryEmbeddings.memoryId, memory.id));
		expect(embeddingInDb.length).toBe(1);

		// 4. Delete the message
		await db.delete(messages).where(eq(messages.id, msg.id));

		// 5. Verify the memory and its embedding are deleted via database cascade
		const memoryDeleted = await db.select().from(memories).where(eq(memories.id, memory.id));
		expect(memoryDeleted.length).toBe(0);

		const embeddingDeleted = await db
			.select()
			.from(memoryEmbeddings)
			.where(eq(memoryEmbeddings.memoryId, memory.id));
		expect(embeddingDeleted.length).toBe(0);
	});

	it('should successfully sweep associated memories of subsequent deleted messages during timeline truncation / edit', async () => {
		// 1. Set up consecutive messages with strict createdAt timestamps
		const now = Date.now();
		const T1 = new Date(now - 10000);
		const T2 = new Date(now - 8000);
		const T3 = new Date(now - 6000);
		const T4 = new Date(now - 4000);

		const [msg1] = await db
			.insert(messages)
			.values({
				conversationId: testConversationId,
				role: 'user',
				content: 'T1 user message',
				createdAt: T1
			})
			.returning();

		const [msg2] = await db
			.insert(messages)
			.values({
				conversationId: testConversationId,
				role: 'assistant',
				content: 'T2 assistant response',
				createdAt: T2
			})
			.returning();

		const [msg3] = await db
			.insert(messages)
			.values({
				conversationId: testConversationId,
				role: 'user',
				content: 'T3 user message (to be edited)',
				createdAt: T3
			})
			.returning();

		const [msg4] = await db
			.insert(messages)
			.values({
				conversationId: testConversationId,
				role: 'assistant',
				content: 'T4 assistant response (to be truncated)',
				createdAt: T4
			})
			.returning();

		// 2. Create memory referring to msg4 (subsequent to msg3)
		const mockEmbedding = new Array(384).fill(0).map((_, i) => (i === 0 ? 1.0 : 0.0));
		const memory = await createMemoryWithEmbedding(
			{
				userId: testUserId,
				type: 'preference',
				title: 'Subsequent Memory',
				content: 'This memory is linked to the message that will be deleted',
				importance: 5,
				confidence: 0.95,
				sourceConversationId: testConversationId,
				sourceMessageId: msg4.id
			},
			mockEmbedding
		);

		// 3. Verify memory is in DB
		const memoryInDb = await db.select().from(memories).where(eq(memories.id, memory.id));
		expect(memoryInDb.length).toBe(1);

		// 4. Mock the AI router so editing doesn't fail on LLM generation
		vi.spyOn(aiRouter, 'generateChat').mockImplementation(async (taskType) => {
			if (taskType === 'emotional_reason') {
				return {
					content: JSON.stringify({
						primaryEmotion: 'neutral',
						moodScore: 0,
						confidence: 1.0,
						shouldStoreMemory: false
					}),
					provider: 'deepseek',
					model: 'deepseek-chat'
				};
			}
			return {
				content: 'Mocked assistant response to edited T3 message',
				provider: 'deepseek',
				model: 'deepseek-chat'
			};
		});

		// 5. Invoke the POST chat endpoint to edit msg3
		const payload = JSON.stringify({
			conversationId: testConversationId,
			message: 'T3 user message (edited!)',
			editId: msg3.id
		});

		const request = new Request('http://localhost/api/chat', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': String(payload.length)
			},
			body: payload
		});

		const mockEvent = {
			request,
			getClientAddress: () => `127.0.0.${Math.floor(Math.random() * 254) + 1}`
		};

		const response = await chatPOST(mockEvent as any);
		expect(response.status).toBe(200);

		// 6. Verify that msg4 (the subsequent message) was deleted
		const msg4Check = await db.select().from(messages).where(eq(messages.id, msg4.id));
		expect(msg4Check.length).toBe(0);

		// 7. Verify that the memory referencing msg4 was deleted by the sweeper logic inside the edit transaction
		const memoryCheck = await db.select().from(memories).where(eq(memories.id, memory.id));
		expect(memoryCheck.length).toBe(0);

		const embeddingCheck = await db
			.select()
			.from(memoryEmbeddings)
			.where(eq(memoryEmbeddings.memoryId, memory.id));
		expect(embeddingCheck.length).toBe(0);
	});
});
