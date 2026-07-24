import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users, moodLogs } from '$lib/server/db/schema';
import { getMoodLogsByUserId, deleteMoodLog } from '$lib/server/db/queries/mood';
import { z } from 'zod';

interface ZodIssueLike {
	path: Array<string | number>;
	message: string;
}

interface RouteErrorLike {
	name?: string;
	message?: string;
	code?: string;
	issues?: ZodIssueLike[];
	errors?: ZodIssueLike[];
}

interface MoodInsertValues {
	userId: string;
	moodLabel: string;
	moodScore: number;
	energyLevel: number | null;
	stressLevel: number | null;
	note: string | null;
	createdAt: Date;
	id?: string;
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

const MAX_BODY_SIZE = 64 * 1024; // 64 KB

const moodLogSchema = z.object({
	id: z.string().uuid().optional(),
	moodLabel: z
		.string()
		.trim()
		.min(1, 'Mood label cannot be empty')
		.max(50, 'Mood label is too long'),
	moodScore: z
		.number()
		.int()
		.min(-5, 'Mood score must be at least -5')
		.max(5, 'Mood score must be at most 5'),
	energyLevel: z
		.number()
		.int()
		.min(1, 'Energy level must be at least 1')
		.max(5, 'Energy level must be at most 5')
		.optional()
		.nullable(),
	stressLevel: z
		.number()
		.int()
		.min(1, 'Stress level must be at least 1')
		.max(5, 'Stress level must be at most 5')
		.optional()
		.nullable(),
	note: z.string().trim().max(1000, 'Note is too long').optional().nullable(),
	createdAt: z.string().optional().nullable()
});

const deleteMoodSchema = z.object({
	id: z.string().uuid()
});

export const GET: RequestHandler = async () => {
	try {
		const user = await getOrCreateDefaultUser();
		const logs = await getMoodLogsByUserId(user.id);
		return json(logs);
	} catch (error: unknown) {
		console.error('Error in GET /api/mood:', error);
		let status = 500;
		let code = 'INTERNAL_SERVER_ERROR';
		let message = 'An unexpected error occurred';
		const routeError = error as RouteErrorLike;

		if (
			routeError.message?.includes('db') ||
			routeError.message?.includes('database') ||
			routeError.message?.includes('query') ||
			routeError.code?.startsWith('PG')
		) {
			status = 500;
			code = 'DATABASE_ERROR';
			message = 'A database error occurred while fetching mood logs.';
		}
		return json({ error: { code, message } }, { status });
	}
};

export const POST: RequestHandler = async ({ request }) => {
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
		} catch {
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
		} catch {
			return json(
				{ error: { code: 'MALFORMED_JSON', message: 'Malformed JSON payload' } },
				{ status: 400 }
			);
		}

		// 2. Validate
		const validated = moodLogSchema.parse(body);

		const user = await getOrCreateDefaultUser();

		// 3. Insert log
		const insertValues: MoodInsertValues = {
			userId: user.id,
			moodLabel: validated.moodLabel,
			moodScore: validated.moodScore,
			energyLevel: validated.energyLevel || null,
			stressLevel: validated.stressLevel || null,
			note: validated.note || null,
			createdAt: validated.createdAt ? new Date(validated.createdAt) : new Date()
		};

		if (validated.id) {
			insertValues.id = validated.id;
		}

		const [createdLog] = await db.insert(moodLogs).values(insertValues).returning();

		return json(createdLog, { status: 201 });
	} catch (error: unknown) {
		console.error('Error in POST /api/mood:', error);
		let status = 500;
		let code = 'INTERNAL_SERVER_ERROR';
		let message = 'An unexpected error occurred';
		const routeError = error as RouteErrorLike;

		if (error instanceof z.ZodError || routeError.name === 'ZodError') {
			status = 400;
			code = 'VALIDATION_ERROR';
			const issues =
				error instanceof z.ZodError ? error.issues : routeError.issues || routeError.errors || [];
			message = issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
		} else if (
			routeError.message?.includes('db') ||
			routeError.message?.includes('database') ||
			routeError.message?.includes('query') ||
			routeError.code?.startsWith('PG')
		) {
			status = 500;
			code = 'DATABASE_ERROR';
			message = 'A database error occurred while saving the mood check-in.';
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
		} catch {
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
		} catch {
			return json(
				{ error: { code: 'MALFORMED_JSON', message: 'Malformed JSON payload' } },
				{ status: 400 }
			);
		}

		// 2. Validate
		const validated = deleteMoodSchema.parse(body);

		// 3. Delete
		const deleted = await deleteMoodLog(validated.id);
		if (!deleted) {
			return json({ error: { code: 'NOT_FOUND', message: 'Mood log not found' } }, { status: 404 });
		}

		return json({ success: true, deleted });
	} catch (error: unknown) {
		console.error('Error in DELETE /api/mood:', error);
		let status = 500;
		let code = 'INTERNAL_SERVER_ERROR';
		let message = 'An unexpected error occurred';
		const routeError = error as RouteErrorLike;

		if (error instanceof z.ZodError || routeError.name === 'ZodError') {
			status = 400;
			code = 'VALIDATION_ERROR';
			const issues =
				error instanceof z.ZodError ? error.issues : routeError.issues || routeError.errors || [];
			message = issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
		} else if (
			routeError.message?.includes('db') ||
			routeError.message?.includes('database') ||
			routeError.message?.includes('query') ||
			routeError.code?.startsWith('PG')
		) {
			status = 500;
			code = 'DATABASE_ERROR';
			message = 'A database error occurred while deleting the mood log.';
		}
		return json({ error: { code, message } }, { status });
	}
};
