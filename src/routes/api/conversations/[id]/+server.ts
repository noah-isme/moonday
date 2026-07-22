import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { conversations, users } from '$lib/server/db/schema';

const conversationParamsSchema = z.object({ id: z.string().uuid() });
const updateConversationSchema = z.object({
	title: z.string().trim().min(1, 'Title cannot be empty').max(120, 'Title is too long')
});

async function getLocalUser() {
	const [user] = await db.select().from(users).limit(1);
	return user ?? null;
}

async function getOwnedConversation(id: string) {
	const user = await getLocalUser();
	if (!user) return null;
	const [conversation] = await db
		.select()
		.from(conversations)
		.where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
		.limit(1);
	return conversation ?? null;
}

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const { id } = conversationParamsSchema.parse(params);
		const input = updateConversationSchema.parse(await request.json());
		const existing = await getOwnedConversation(id);
		if (!existing) {
			return json(
				{ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } },
				{ status: 404 }
			);
		}

		const [conversation] = await db
			.update(conversations)
			.set({ title: input.title, updatedAt: new Date() })
			.where(eq(conversations.id, id))
			.returning();
		return json({ conversation });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return json(
				{
					error: {
						code: 'VALIDATION_ERROR',
						message: 'Provide a title between 1 and 120 characters.'
					}
				},
				{ status: 400 }
			);
		}
		console.error('Failed to rename conversation:', error);
		return json(
			{
				error: {
					code: 'CONVERSATION_UPDATE_FAILED',
					message: 'Unable to rename this conversation.'
				}
			},
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { id } = conversationParamsSchema.parse(params);
		const existing = await getOwnedConversation(id);
		if (!existing) {
			return json(
				{ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } },
				{ status: 404 }
			);
		}

		await db.delete(conversations).where(eq(conversations.id, id));
		return new Response(null, { status: 204 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return json(
				{ error: { code: 'VALIDATION_ERROR', message: 'Invalid conversation.' } },
				{ status: 400 }
			);
		}
		console.error('Failed to delete conversation:', error);
		return json(
			{
				error: {
					code: 'CONVERSATION_DELETE_FAILED',
					message: 'Unable to delete this conversation.'
				}
			},
			{ status: 500 }
		);
	}
};
