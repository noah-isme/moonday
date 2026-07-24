import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { GET as trendsGET } from '../routes/api/journal/trends/+server';
import { db, client } from '../lib/server/db/client';
import { users, moodLogs } from '../lib/server/db/schema';
import { eq } from 'drizzle-orm';

function createMockTrendsEvent(): RequestEvent<Record<string, string>, '/api/journal/trends'> {
	return {
		request: new Request('http://localhost/api/journal/trends'),
		params: {},
		route: { id: '/api/journal/trends' },
		url: new URL('http://localhost/api/journal/trends'),
		platform: undefined,
		locals: {},
		cookies: {
			get: () => undefined,
			set: () => {},
			delete: () => {}
		},
		fetch: () => Promise.resolve(new Response()),
		getClientAddress: () => '127.0.0.1',
		routePattern: '/api/journal/trends'
	} as unknown as RequestEvent<Record<string, string>, '/api/journal/trends'>;
}

async function getOrCreateDefaultUser() {
	let [user] = await db.select().from(users).limit(1);
	if (!user) {
		const [newUser] = await db
			.insert(users)
			.values({
				displayName: 'Local User'
			})
			.returning();
		user = newUser;
	}
	return user;
}

describe('Journal Trends API Route Chronological Check', () => {
	beforeAll(async () => {
		// Clean up any test users
		await db.delete(users).where(eq(users.displayName, 'Local User'));
	});

	afterAll(async () => {
		await db.delete(users).where(eq(users.displayName, 'Local User'));
		await client.end();
	});

	it('should return mood logs sorted chronologically in ascending order', async () => {
		const user = await getOrCreateDefaultUser();

		// Insert logs out of order
		const now = Date.now();
		const dateOld = new Date(now - 10 * 60 * 1000); // 10 mins ago
		const dateMedium = new Date(now - 5 * 60 * 1000); // 5 mins ago
		const dateNew = new Date(now); // now

		// Insert medium first, then new, then old
		await db.insert(moodLogs).values([
			{
				userId: user.id,
				moodLabel: 'neutral',
				moodScore: 0,
				createdAt: dateMedium
			},
			{
				userId: user.id,
				moodLabel: 'happy',
				moodScore: 4,
				createdAt: dateNew
			},
			{
				userId: user.id,
				moodLabel: 'tired',
				moodScore: -1,
				createdAt: dateOld
			}
		]);

		const response = await trendsGET(createMockTrendsEvent());
		expect(response.status).toBe(200);

		const data = await response.json();
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBeGreaterThanOrEqual(3);

		// Filter to only the ones we just created for clean validation
		const userLogs = data.filter(
			(log: { userId: string; createdAt: string }) => log.userId === user.id
		);

		// Assert chronological order (ascending)
		for (let i = 1; i < userLogs.length; i++) {
			const prevTime = new Date(userLogs[i - 1].createdAt).getTime();
			const currTime = new Date(userLogs[i].createdAt).getTime();
			expect(prevTime).toBeLessThanOrEqual(currTime);
		}
	});
});
