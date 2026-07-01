import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users, messages, conversations } from '$lib/server/db/schema';
import { eq, and, gte, lte, asc, inArray } from 'drizzle-orm';
import { getMoodLogsInDateRange } from '$lib/server/db/queries/mood';
import {
	createDailyReflection,
	getDailyReflectionByDate,
	getDailyReflectionsByUserId,
	updateDailyReflection,
	deleteDailyReflection
} from '$lib/server/db/queries/reflections';
import { aiRouter } from '$lib/server/ai/router';
import { checkRateLimit } from '$lib/server/rateLimiter';
import { z } from 'zod';

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

const MAX_BODY_SIZE = 64 * 1024; // 64 KB

const postReflectionSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
});

const deleteReflectionSchema = z.object({
	id: z.string().uuid('Invalid reflection ID')
});

export const GET: RequestHandler = async () => {
	try {
		const user = await getOrCreateDefaultUser();
		const list = await getDailyReflectionsByUserId(user.id);
		return json(list);
	} catch (error: any) {
		console.error('Error in GET /api/reflections:', error);
		let status = 500;
		let code = 'INTERNAL_SERVER_ERROR';
		let message = 'An unexpected error occurred';

		if (
			error.message?.includes('db') ||
			error.message?.includes('database') ||
			error.message?.includes('query') ||
			error.code?.startsWith('PG')
		) {
			status = 500;
			code = 'DATABASE_ERROR';
			message = 'A database error occurred while fetching reflections.';
		}
		return json({ error: { code, message } }, { status });
	}
};

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	try {
		// 1. Size limit check
		const contentLength = request.headers.get('content-length');
		if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
			return json(
				{ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload is too large' } },
				{ status: 413 }
			);
		}

		let bodyText = '';
		try {
			bodyText = await request.text();
		} catch (err) {
			return json(
				{ error: { code: 'BAD_REQUEST', message: 'Failed to read request body' } },
				{ status: 400 }
			);
		}

		if (bodyText.length > MAX_BODY_SIZE) {
			return json(
				{ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload is too large' } },
				{ status: 413 }
			);
		}

		if (!bodyText.trim()) {
			return json(
				{ error: { code: 'BAD_REQUEST', message: 'Request body is empty' } },
				{ status: 400 }
			);
		}

		let body;
		try {
			body = JSON.parse(bodyText);
		} catch (err) {
			return json(
				{ error: { code: 'MALFORMED_JSON', message: 'Malformed JSON payload' } },
				{ status: 400 }
			);
		}

		// 2. Validate
		const validated = postReflectionSchema.parse(body);
		const { date: dateStr } = validated;

		// 3. Rate Limit Check (uses LLM)
		let ip = 'unknown';
		try {
			ip = event.getClientAddress();
		} catch {
			// Fallback
		}
		const rateLimitResult = checkRateLimit(ip, { limit: 5, windowMs: 60 * 1000 });
		if (!rateLimitResult.success) {
			return json(
				{
					error: {
						code: 'TOO_MANY_REQUESTS',
						message: 'Rate limit exceeded. Please try again later.'
					}
				},
				{
					status: 429,
					headers: {
						'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString()
					}
				}
			);
		}

		const user = await getOrCreateDefaultUser();

		// 4. Query mood logs & messages for target day
		const start = new Date(`${dateStr}T00:00:00.000Z`);
		const end = new Date(`${dateStr}T23:59:59.999Z`);

		const logs = await getMoodLogsInDateRange(user.id, start, end);

		// Get all user conversations
		const userConvs = await db
			.select({ id: conversations.id })
			.from(conversations)
			.where(eq(conversations.userId, user.id));
		const convIds = userConvs.map((c) => c.id);

		const dailyMessages =
			convIds.length > 0
				? await db
						.select()
						.from(messages)
						.where(
							and(
								inArray(messages.conversationId, convIds),
								gte(messages.createdAt, start),
								lte(messages.createdAt, end)
							)
						)
						.orderBy(asc(messages.createdAt))
				: [];

		// 5. Check if we have enough data to generate reflection
		if (logs.length === 0 && dailyMessages.length === 0) {
			// Save a placeholder / default quiet reflection so we don't return 400
			const existing = await getDailyReflectionByDate(user.id, dateStr);
			const defaultVals = {
				moodSummary: 'A quiet, reflective day with no logs.',
				emotionalSummary:
					'No mood logs or chat history were recorded today. Take some time to check in when you are ready.',
				importantEvents: 'No recorded events or conversations.',
				suggestedFocus: 'Take a brief moment to log how you are feeling and chat with MOONDAY.'
			};

			let reflectionRecord;
			if (existing) {
				reflectionRecord = await updateDailyReflection(existing.id, defaultVals);
			} else {
				reflectionRecord = await createDailyReflection({
					userId: user.id,
					date: dateStr,
					...defaultVals
				});
			}

			return json(reflectionRecord);
		}

		// 6. Invoke LLM to generate reflection
		const systemPrompt = `You are MOONDAY's reflection engine.
Analyze the user's mood check-ins and conversation logs for the date: ${dateStr}.
Generate a daily reflection structured as a JSON object with the following fields:
- moodSummary: A brief summary (1 sentence) of the user's mood and energy levels.
- emotionalSummary: A detailed description (2-3 sentences) reflecting on their emotions, stressors, and patterns.
- importantEvents: A description (1-2 sentences) of the important events, topics, or accomplishments they worked on or discussed.
- suggestedFocus: Actionable, practical advice or focus areas (1-2 sentences) for the next day.

Format the output strictly as a JSON object:
{
  "moodSummary": "...",
  "emotionalSummary": "...",
  "importantEvents": "...",
  "suggestedFocus": "..."
}
Do not include any markdown wrappers, code blocks, or extra text. Return ONLY the raw JSON object.`;

		const userContent = `Here is the data for today:

Mood Logs:
${logs.map((l) => `- Mood: ${l.moodLabel} (Score: ${l.moodScore}), Energy: ${l.energyLevel}, Stress: ${l.stressLevel}. Note: ${l.note}`).join('\n')}

Conversations:
${dailyMessages.map((m) => `[${m.role}] ${m.content}`).join('\n')}`;

		const chatResult = await aiRouter.generateChat('reflection_deep', {
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userContent }
			]
		});

		let parsedReflection;
		try {
			const responseText = chatResult.content.trim();
			// Strip markdown formatting if any
			const jsonText = responseText
				.replace(/^```json\s*/i, '')
				.replace(/```$/, '')
				.trim();
			parsedReflection = JSON.parse(jsonText);
		} catch (parseErr) {
			console.error('Failed to parse AI reflection JSON:', chatResult.content, parseErr);
			throw new Error('AI_INVALID_RESPONSE: AI returned an invalid reflection format.');
		}

		// 7. Save or update reflection
		const existing = await getDailyReflectionByDate(user.id, dateStr);
		let reflectionRecord;
		const reflectionData = {
			moodSummary: parsedReflection.moodSummary || 'Reflective state.',
			emotionalSummary: parsedReflection.emotionalSummary || "Processed today's updates.",
			importantEvents: parsedReflection.importantEvents || 'Conversations and mood checking.',
			suggestedFocus: parsedReflection.suggestedFocus || 'Continue regular check-ins.'
		};

		if (existing) {
			reflectionRecord = await updateDailyReflection(existing.id, reflectionData);
		} else {
			reflectionRecord = await createDailyReflection({
				userId: user.id,
				date: dateStr,
				...reflectionData
			});
		}

		return json(reflectionRecord, { status: 201 });
	} catch (error: any) {
		console.error('Error in POST /api/reflections:', error);
		let status = 500;
		let code = 'INTERNAL_SERVER_ERROR';
		let message = 'An unexpected error occurred';

		if (error instanceof z.ZodError || error.name === 'ZodError') {
			status = 400;
			code = 'VALIDATION_ERROR';
			const issues = error.issues || error.errors || [];
			message = issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
		} else if (error.message?.includes('AI_INVALID_RESPONSE')) {
			status = 502;
			code = 'BAD_GATEWAY';
			message = 'The reflection engine returned an invalid response format. Please try again.';
		} else if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
			status = 504;
			code = 'AI_PROVIDER_TIMEOUT';
			message = 'The reflection engine is taking too long to respond. Please try again.';
		} else if (
			error.message?.includes('rate limit') ||
			error.message?.includes('Rate Limit') ||
			error.status === 429
		) {
			status = 429;
			code = 'AI_PROVIDER_RATE_LIMIT';
			message = 'AI provider rate limit reached. Please wait a moment before trying again.';
		} else if (
			error.message?.includes('db') ||
			error.message?.includes('database') ||
			error.message?.includes('query') ||
			error.code?.startsWith('PG')
		) {
			status = 500;
			code = 'DATABASE_ERROR';
			message = 'A database error occurred while creating/updating daily reflection.';
		}

		return json({ error: { code, message } }, { status });
	}
};

export const DELETE: RequestHandler = async ({ request }) => {
	try {
		// 1. Size limit check
		const contentLength = request.headers.get('content-length');
		if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
			return json(
				{ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload is too large' } },
				{ status: 413 }
			);
		}

		let bodyText = '';
		try {
			bodyText = await request.text();
		} catch (err) {
			return json(
				{ error: { code: 'BAD_REQUEST', message: 'Failed to read request body' } },
				{ status: 400 }
			);
		}

		if (bodyText.length > MAX_BODY_SIZE) {
			return json(
				{ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload is too large' } },
				{ status: 413 }
			);
		}

		let body;
		try {
			body = JSON.parse(bodyText);
		} catch (err) {
			return json(
				{ error: { code: 'MALFORMED_JSON', message: 'Malformed JSON payload' } },
				{ status: 400 }
			);
		}

		// 2. Validate
		const validated = deleteReflectionSchema.parse(body);

		// 3. Delete
		const deleted = await deleteDailyReflection(validated.id);
		if (!deleted) {
			return json(
				{ error: { code: 'NOT_FOUND', message: 'Daily reflection not found' } },
				{ status: 404 }
			);
		}

		return json({ success: true, deleted });
	} catch (error: any) {
		console.error('Error in DELETE /api/reflections:', error);
		let status = 500;
		let code = 'INTERNAL_SERVER_ERROR';
		let message = 'An unexpected error occurred';

		if (error instanceof z.ZodError || error.name === 'ZodError') {
			status = 400;
			code = 'VALIDATION_ERROR';
			const issues = error.issues || error.errors || [];
			message = issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
		} else if (
			error.message?.includes('db') ||
			error.message?.includes('database') ||
			error.message?.includes('query') ||
			error.code?.startsWith('PG')
		) {
			status = 500;
			code = 'DATABASE_ERROR';
			message = 'A database error occurred while deleting the reflection.';
		}
		return json({ error: { code, message } }, { status });
	}
};
