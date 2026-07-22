import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { characterProfiles, conversations, messages, users } from '$lib/server/db/schema';
import { z } from 'zod';

export const GET: RequestHandler = async () => {
	try {
		const [user] = await db.select().from(users).limit(1);
		if (!user) return json({ conversations: [], messages: {} });

		const savedConversationRows = await db
			.select({ conversation: conversations, characterTone: characterProfiles.tone })
			.from(conversations)
			.leftJoin(characterProfiles, eq(conversations.activeCharacterId, characterProfiles.id))
			.where(eq(conversations.userId, user.id))
			.orderBy(desc(conversations.updatedAt));
		const savedConversations = savedConversationRows.map(({ conversation, characterTone }) => ({
			...conversation,
			characterTone: characterTone ?? undefined
		}));

		if (savedConversations.length === 0) {
			return json({ conversations: [], messages: {} });
		}

		const conversationIds = savedConversations.map((conversation) => conversation.id);
		const savedMessages = await db
			.select()
			.from(messages)
			.where(inArray(messages.conversationId, conversationIds))
			.orderBy(asc(messages.createdAt));

		const messagesByConversation = Object.fromEntries(
			savedConversations.map((conversation) => [
				conversation.id,
				savedMessages.filter((message) => message.conversationId === conversation.id)
			])
		);

		return json({ conversations: savedConversations, messages: messagesByConversation });
	} catch (error) {
		console.error('Failed to load conversations:', error);
		return json(
			{
				error: { code: 'CONVERSATIONS_UNAVAILABLE', message: 'Unable to load saved conversations.' }
			},
			{ status: 500 }
		);
	}
};

const createConversationSchema = z.object({
	characterId: z.string().trim().min(1).optional(),
	sourceConversationId: z.string().uuid().optional(),
	sourceMessageId: z.string().uuid().optional()
});

const isUuid = (value: string) =>
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Create the welcome chat in PostgreSQL so the client never needs a local-only conversation. */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const input = createConversationSchema.parse(await request.json().catch(() => ({})));
		let [user] = await db.select().from(users).limit(1);
		if (!user) {
			[user] = await db.insert(users).values({ displayName: 'Local User' }).returning();
		}
		if (input.sourceConversationId && input.sourceMessageId) {
			const [sourceConversation] = await db
				.select()
				.from(conversations)
				.where(eq(conversations.id, input.sourceConversationId))
				.limit(1);
			if (!sourceConversation || sourceConversation.userId !== user.id) {
				return json(
					{ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } },
					{ status: 404 }
				);
			}
			const sourceMessages = await db
				.select()
				.from(messages)
				.where(eq(messages.conversationId, sourceConversation.id))
				.orderBy(asc(messages.createdAt));
			const branchAt = sourceMessages.findIndex((message) => message.id === input.sourceMessageId);
			if (branchAt === -1) {
				return json(
					{ error: { code: 'NOT_FOUND', message: 'Message not found.' } },
					{ status: 404 }
				);
			}
			const [conversation] = await db
				.insert(conversations)
				.values({
					userId: user.id,
					activeCharacterId: sourceConversation.activeCharacterId,
					memoryExtractionEnabled: sourceConversation.memoryExtractionEnabled,
					title: `Branch: ${sourceConversation.title || 'Reflection'}`
				})
				.returning();
			const copiedMessages = sourceMessages.slice(0, branchAt + 1);
			let branchMessages: typeof sourceMessages = [];
			if (copiedMessages.length > 0) {
				branchMessages = await db
					.insert(messages)
					.values(
						copiedMessages.map((message) => ({
							conversationId: conversation.id,
							role: message.role,
							content: message.content,
							provider: message.provider,
							model: message.model,
							emotionLabel: message.emotionLabel,
							moodScore: message.moodScore
						}))
					)
					.returning();
			}
			return json({ conversation, messages: branchMessages }, { status: 201 });
		}

		let character;
		if (input.characterId && isUuid(input.characterId)) {
			[character] = await db
				.select()
				.from(characterProfiles)
				.where(eq(characterProfiles.id, input.characterId))
				.limit(1);
		}
		if (!character) {
			[character] = await db
				.select()
				.from(characterProfiles)
				.where(eq(characterProfiles.tone, input.characterId || 'friendly'))
				.limit(1);
		}
		if (!character) {
			[character] = await db
				.select()
				.from(characterProfiles)
				.where(eq(characterProfiles.isDefault, true))
				.limit(1);
		}
		if (!character) {
			[character] = await db
				.insert(characterProfiles)
				.values({
					name: 'Friendly MOONDAY',
					description: 'Warm, reflective, gently witty, practical, and emotionally aware.',
					tone: 'friendly',
					traits: { warmth: 9, humor: 6, honesty: 8, sarcasm: 2, moralDirectness: 5 },
					temperature: 0.7,
					systemPrompt: 'Be warm, reflective, practical, and emotionally aware.',
					isDefault: true
				})
				.returning();
		}

		const [conversation] = await db
			.insert(conversations)
			.values({
				userId: user.id,
				activeCharacterId: character.id,
				title: `Reflections with ${character.name}`
			})
			.returning();
		const [welcomeMessage] = await db
			.insert(messages)
			.values({
				conversationId: conversation.id,
				role: 'assistant',
				content: `Hello! I'm here as ${character.name}. How are you feeling today? Let's navigate your thoughts together.`
			})
			.returning();

		return json(
			{
				conversation: { ...conversation, characterTone: character.tone ?? undefined },
				messages: [welcomeMessage]
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Failed to create conversation:', error);
		if (error instanceof z.ZodError) {
			return json(
				{ error: { code: 'VALIDATION_ERROR', message: 'Invalid conversation request.' } },
				{ status: 400 }
			);
		}
		return json(
			{
				error: {
					code: 'CONVERSATION_CREATE_FAILED',
					message: 'Unable to create a new conversation.'
				}
			},
			{ status: 500 }
		);
	}
};
