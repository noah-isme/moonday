import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { conversations, messages } from '$lib/server/db/schema';

const SUMMARY_AFTER_MESSAGE_COUNT = 4;
const SUMMARY_MAX_LENGTH = 700;

function compact(content: string, limit: number) {
	const normalized = content.replace(/\s+/g, ' ').trim();
	return normalized.length > limit ? `${normalized.slice(0, limit - 1).trimEnd()}…` : normalized;
}

/**
 * Stores a small, deterministic recap after a meaningful exchange. It intentionally
 * does not invoke another model or create an additional provider request.
 */
export async function refreshConversationSummary(conversationId: string) {
	const records = await db
		.select({ role: messages.role, content: messages.content })
		.from(messages)
		.where(eq(messages.conversationId, conversationId))
		.orderBy(asc(messages.createdAt));

	const conversationalRecords = records.filter(
		(record) => record.role === 'user' || record.role === 'assistant'
	);
	if (conversationalRecords.length < SUMMARY_AFTER_MESSAGE_COUNT) return null;

	const earlyUserMessages = conversationalRecords
		.filter((record) => record.role === 'user')
		.slice(0, 2)
		.map((record) => compact(record.content, 120));
	const recentExchange = conversationalRecords
		.slice(-4)
		.map(
			(record) => `${record.role === 'user' ? 'User' : 'MOONDAY'}: ${compact(record.content, 150)}`
		)
		.join(' · ');
	const earlyContext = [...new Set(earlyUserMessages)].join(' · ');
	const summary = compact(
		`${earlyContext ? `Earlier user context: ${earlyContext}. ` : ''}Latest exchange: ${recentExchange}`,
		SUMMARY_MAX_LENGTH
	);

	const [conversation] = await db
		.update(conversations)
		.set({ summary, updatedAt: new Date() })
		.where(eq(conversations.id, conversationId))
		.returning({ summary: conversations.summary, updatedAt: conversations.updatedAt });

	return conversation ?? null;
}
