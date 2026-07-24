import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { DELETE, PATCH } from '../routes/api/conversations/[id]/+server';
import { refreshConversationSummary } from '../lib/server/conversations/summary';
import { client, db } from '../lib/server/db/client';
import { conversations, messages, users } from '../lib/server/db/schema';
import { eq } from 'drizzle-orm';

function createMockConversationEvent(
	request: Request,
	conversationId: string
): RequestEvent<{ id: string }, '/api/conversations/[id]'> {
	return {
		request,
		params: { id: conversationId },
		route: { id: '/api/conversations/[id]' },
		url: new URL(request.url),
		platform: undefined,
		locals: {},
		cookies: {
			get: () => undefined,
			set: () => {},
			delete: () => {}
		},
		fetch: () => Promise.resolve(new Response()),
		getClientAddress: () => '127.0.0.1',
		routePattern: '/api/conversations/[id]'
	} as unknown as RequestEvent<{ id: string }, '/api/conversations/[id]'>;
}

describe('conversation lifecycle routes', () => {
	let userId: string;
	let conversationId: string;

	beforeAll(async () => {
		let [user] = await db.select().from(users).limit(1);
		if (!user) {
			[user] = await db
				.insert(users)
				.values({ displayName: 'Conversation route test user' })
				.returning();
		}
		userId = user.id;

		const [conversation] = await db
			.insert(conversations)
			.values({ userId, title: 'Reflections with Friendly MOONDAY' })
			.returning();
		conversationId = conversation.id;

		await db.insert(messages).values([
			{ conversationId, role: 'assistant', content: 'Welcome.' },
			{ conversationId, role: 'user', content: 'I want to plan my afternoon.' },
			{ conversationId, role: 'assistant', content: 'Let us choose one small next step.' },
			{ conversationId, role: 'user', content: 'I will begin with the project outline.' }
		]);
	});

	afterAll(async () => {
		if (conversationId) await db.delete(conversations).where(eq(conversations.id, conversationId));
		await client.end();
	});

	it('renames an owned conversation and stores a recap after a meaningful exchange', async () => {
		const summary = await refreshConversationSummary(conversationId);
		expect(summary?.summary).toContain('project outline');

		const response = await PATCH(
			createMockConversationEvent(
				new Request(`http://localhost/api/conversations/${conversationId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: 'Afternoon planning' })
				}),
				conversationId
			)
		);

		expect(response.status).toBe(200);
		expect((await response.json()).conversation.title).toBe('Afternoon planning');
	});

	it('deletes an owned conversation from the server', async () => {
		const response = await DELETE(
			createMockConversationEvent(
				new Request(`http://localhost/api/conversations/${conversationId}`, {
					method: 'DELETE'
				}),
				conversationId
			)
		);
		expect(response.status).toBe(204);

		const [deleted] = await db
			.select()
			.from(conversations)
			.where(eq(conversations.id, conversationId));
		expect(deleted).toBeUndefined();
		conversationId = '';
	});
});
