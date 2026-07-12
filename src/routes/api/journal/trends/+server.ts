import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users, moodLogs } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';

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

export const GET: RequestHandler = async () => {
	try {
		const user = await getOrCreateDefaultUser();
		const logs = await db
			.select()
			.from(moodLogs)
			.where(eq(moodLogs.userId, user.id))
			.orderBy(asc(moodLogs.createdAt)) // Chronological order enforced!
			.limit(50);
		return json(logs);
	} catch (error: any) {
		console.error('Error in GET /api/journal/trends:', error);
		return json({ error: { code: 'DATABASE_ERROR', message: 'A database error occurred while fetching trends.' } }, { status: 500 });
	}
};
