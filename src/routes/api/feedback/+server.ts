import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, count, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { conversations, messages, responseFeedback, users } from '$lib/server/db/schema';
import { RESPONSE_FEEDBACK_TYPES } from '$lib/types/feedback';

async function getUser() {
	let [user] = await db.select().from(users).limit(1);
	if (!user) [user] = await db.insert(users).values({ displayName: 'Local User' }).returning();
	return user;
}

const feedbackSchema = z.object({ messageId: z.string().uuid(), feedbackType: z.enum(RESPONSE_FEEDBACK_TYPES) });

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { messageId, feedbackType } = feedbackSchema.parse(await request.json());
		const user = await getUser();
		const [message] = await db
			.select({ id: messages.id, provider: messages.provider, model: messages.model })
			.from(messages)
			.innerJoin(conversations, eq(messages.conversationId, conversations.id))
			.where(and(eq(messages.id, messageId), eq(messages.role, 'assistant'), eq(conversations.userId, user.id)))
			.limit(1);
		if (!message) return json({ error: { code: 'NOT_FOUND', message: 'Response not found.' } }, { status: 404 });
		const [feedback] = await db
			.insert(responseFeedback)
			.values({ userId: user.id, messageId, feedbackType, provider: message.provider, model: message.model })
			.onConflictDoUpdate({
				target: [responseFeedback.userId, responseFeedback.messageId],
				set: { feedbackType, provider: message.provider, model: message.model, updatedAt: new Date() }
			})
			.returning();
		return json({ feedback });
	} catch (error) {
		if (error instanceof z.ZodError) return json({ error: { code: 'VALIDATION_ERROR', message: 'Choose a valid feedback option.' } }, { status: 400 });
		return json({ error: { code: 'DATABASE_ERROR', message: 'Unable to save feedback.' } }, { status: 500 });
	}
};

export const GET: RequestHandler = async () => {
	try {
		const user = await getUser();
		const totals = await db
			.select({ feedbackType: responseFeedback.feedbackType, count: count(responseFeedback.id) })
			.from(responseFeedback)
			.where(eq(responseFeedback.userId, user.id))
			.groupBy(responseFeedback.feedbackType)
			.orderBy(desc(count(responseFeedback.id)));
		return json({ totals, privacy: 'Only category, provider, model, and response reference are stored. Response text is never copied into feedback.' });
	} catch {
		return json({ error: { code: 'DATABASE_ERROR', message: 'Unable to load feedback totals.' } }, { status: 500 });
	}
};
