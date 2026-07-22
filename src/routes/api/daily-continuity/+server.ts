import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { conversations, memories, messages, moodLogs, users } from '$lib/server/db/schema';
import { buildDailyContinuity } from '$lib/server/continuity/daily';

export const GET: RequestHandler = async () => {
	try {
		const [user] = await db.select().from(users).limit(1);
		if (!user) return json({ continuity: null });

		const startOfToday = new Date();
		startOfToday.setHours(0, 0, 0, 0);
		const recentMoodCutoff = new Date(startOfToday);
		recentMoodCutoff.setDate(recentMoodCutoff.getDate() - 7);
		const [messageToday] = await db
			.select({ id: messages.id })
			.from(messages)
			.innerJoin(conversations, eq(messages.conversationId, conversations.id))
			.where(and(eq(conversations.userId, user.id), gte(messages.createdAt, startOfToday)))
			.limit(1);
		if (messageToday) return json({ continuity: null });

		const [latestMood] = await db
			.select({
				moodLabel: moodLogs.moodLabel,
				moodScore: moodLogs.moodScore,
				energyLevel: moodLogs.energyLevel,
				stressLevel: moodLogs.stressLevel
			})
			.from(moodLogs)
			.where(and(eq(moodLogs.userId, user.id), gte(moodLogs.createdAt, recentMoodCutoff)))
			.orderBy(desc(moodLogs.createdAt))
			.limit(1);
		const [goal] = await db
			.select({ title: memories.title, content: memories.content, type: memories.type })
			.from(memories)
			.where(
				and(
					eq(memories.userId, user.id),
					eq(memories.isSensitive, false),
					inArray(memories.type, ['personal_goal', 'project_memory'])
				)
			)
			.orderBy(desc(memories.importance), desc(memories.updatedAt))
			.limit(1);
		const [latestConversation] = await db
			.select({ summary: conversations.summary })
			.from(conversations)
			.where(eq(conversations.userId, user.id))
			.orderBy(desc(conversations.updatedAt))
			.limit(1);

		return json({
			continuity: buildDailyContinuity({
				latestMood,
				goal,
				conversationSummary: latestConversation?.summary
			})
		});
	} catch (error) {
		console.error('Failed to build daily continuity:', error);
		return json(
			{
				error: { code: 'DAILY_CONTINUITY_UNAVAILABLE', message: 'Unable to load today’s prompt.' }
			},
			{ status: 500 }
		);
	}
};
