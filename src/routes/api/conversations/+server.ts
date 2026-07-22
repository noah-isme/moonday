import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { conversations, messages, users } from '$lib/server/db/schema';

// v0.1 is local-only and has one user. Keep this endpoint read-only so opening
// the chat never creates data before the first message is sent.
export const GET: RequestHandler = async () => {
	try {
		const [user] = await db.select().from(users).limit(1);
		if (!user) return json({ conversations: [], messages: {} });

		const savedConversations = await db
			.select()
			.from(conversations)
			.where(eq(conversations.userId, user.id))
			.orderBy(desc(conversations.updatedAt));

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
