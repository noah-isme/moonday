import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { conversations, messages, users } from '$lib/server/db/schema';
import { refreshConversationSummary } from '$lib/server/conversations/summary';

const paramsSchema = z.object({ id: z.string().uuid() });

export const POST: RequestHandler = async ({ params }) => {
	try {
		const { id } = paramsSchema.parse(params);
		const [user] = await db.select().from(users).limit(1);
		const [conversation] = user
			? await db
					.select()
					.from(conversations)
					.where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
					.limit(1)
			: [];
		if (!conversation)
			return json(
				{ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } },
				{ status: 404 }
			);

		const refreshed = await refreshConversationSummary(id);
		const records = await db
			.select({ role: messages.role, content: messages.content })
			.from(messages)
			.where(eq(messages.conversationId, id))
			.orderBy(asc(messages.createdAt));
		const actionItems = records
			.filter((message) => message.role === 'user')
			.flatMap((message) => message.content.split(/(?<=[.!?])\s+/))
			.filter((sentence) =>
				/\b(i(?:'ll| will)|todo|need to|plan to|must|next step)\b/i.test(sentence)
			)
			.map((sentence) => sentence.trim())
			.filter((sentence, index, all) => sentence.length > 4 && all.indexOf(sentence) === index)
			.slice(-5);
		return json({
			summary: refreshed?.summary || conversation.summary || 'No recap is available yet.',
			actionItems
		});
	} catch (error) {
		if (error instanceof z.ZodError)
			return json(
				{ error: { code: 'VALIDATION_ERROR', message: 'Invalid conversation.' } },
				{ status: 400 }
			);
		console.error('Failed to create conversation artifacts:', error);
		return json(
			{
				error: {
					code: 'ARTIFACTS_UNAVAILABLE',
					message: 'Unable to create conversation artifacts.'
				}
			},
			{ status: 500 }
		);
	}
};
