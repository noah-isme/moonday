import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users, memories, memoryEmbeddings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
	getMemoriesByUserId,
	updateMemory,
	deleteMemory,
	searchMemories
} from '$lib/server/db/queries/memories';
import { embeddingService } from '$lib/server/ai/embeddings';
import { z } from 'zod';
import { isSensitiveContent } from '$lib/server/memory/extract';

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

const MAX_BODY_SIZE = 512 * 1024; // 512 KB

const postMemorySchema = z.object({
	id: z.string().uuid().optional(),
	type: z.string().trim().min(1, 'Type cannot be empty').max(50, 'Type is too long'),
	title: z.string().trim().min(1, 'Title cannot be empty').max(255, 'Title is too long'),
	content: z.string().trim().min(1, 'Content cannot be empty').max(5000, 'Content is too long'),
	importance: z
		.number()
		.int()
		.min(1, 'Importance must be between 1 and 10')
		.max(10, 'Importance must be between 1 and 10'),
	confidence: z
		.number()
		.min(0, 'Confidence must be between 0 and 1')
		.max(1, 'Confidence must be between 0 and 1'),
	sourceConversationId: z.string().uuid().optional().nullable(),
	sourceMessageId: z.string().uuid().optional().nullable()
});

const putMemorySchema = z.object({
	id: z.string().uuid('Invalid memory ID'),
	type: z.string().trim().min(1, 'Type cannot be empty').max(50, 'Type is too long').optional(),
	title: z.string().trim().min(1, 'Title cannot be empty').max(255, 'Title is too long').optional(),
	content: z
		.string()
		.trim()
		.min(1, 'Content cannot be empty')
		.max(5000, 'Content is too long')
		.optional(),
	importance: z
		.number()
		.int()
		.min(1, 'Importance must be between 1 and 10')
		.max(10, 'Importance must be between 1 and 10')
		.optional(),
	confidence: z
		.number()
		.min(0, 'Confidence must be between 0 and 1')
		.max(1, 'Confidence must be between 0 and 1')
		.optional()
});

const deleteMemorySchema = z.object({
	id: z.string().uuid('Invalid memory ID').optional(),
	clearAll: z.boolean().optional(),
	clearMemories: z.boolean().optional()
});

export const GET: RequestHandler = async () => {
	try {
		const user = await getOrCreateDefaultUser();
		const list = await getMemoriesByUserId(user.id);
		return json(list);
	} catch (error: any) {
		console.error('Error in GET /api/memories:', error);
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
			message = 'A database error occurred while retrieving memories.';
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
		const validated = postMemorySchema.parse(body);

		// Enforce confidence score threshold >= 0.7 for saving memories
		if (validated.confidence < 0.7) {
			return json(
				{
					error: {
						code: 'INVALID_CONFIDENCE',
						message: 'Confidence score must be at least 0.7 to save memory.'
					}
				},
				{ status: 400 }
			);
		}

		// Filter out sensitive data
		if (isSensitiveContent(validated.content) || isSensitiveContent(validated.title)) {
			return json(
				{
					error: {
						code: 'SENSITIVE_CONTENT',
						message: 'Memory contains sensitive information and cannot be saved.'
					}
				},
				{ status: 400 }
			);
		}

		const user = await getOrCreateDefaultUser();

		// Prevent Duplicate Memories: Implement checks using exact text matching
		const existing = await getMemoriesByUserId(user.id);
		const normalizedContent = validated.content.toLowerCase().trim();
		const isExactDuplicate = existing.some(
			(m) => m.content.toLowerCase().trim() === normalizedContent
		);
		if (isExactDuplicate) {
			return json(
				{
					error: {
						code: 'DUPLICATE_MEMORY',
						message: 'A memory with the exact same content already exists.'
					}
				},
				{ status: 409 }
			);
		}

		// Generate embedding first (needed for similarity check and storing)
		let embedding: number[] = [];
		try {
			const embeddingText = `${validated.title}: ${validated.content}`;
			embedding = await embeddingService.getEmbedding(embeddingText);
		} catch (embErr) {
			console.error('Failed to generate embedding for similarity check:', embErr);
			return json(
				{
					error: {
						code: 'EMBEDDING_ERROR',
						message: 'Failed to generate embedding for vector search. Please try again.'
					}
				},
				{ status: 500 }
			);
		}

		// Prevent Duplicate Memories: Implement checks using cosine similarity (via pgvector semantic search)
		try {
			const similar = await searchMemories(user.id, embedding, 1);
			if (similar.length > 0 && similar[0].similarity >= 0.9) {
				return json(
					{
						error: {
							code: 'DUPLICATE_MEMORY',
							message: 'A semantically similar memory already exists.'
						}
					},
					{ status: 409 }
				);
			}
		} catch (simErr) {
			console.error('Failed to query similar memories for deduplication:', simErr);
		}

		// 3. Insert memory
		const insertValues: any = {
			userId: user.id,
			type: validated.type,
			title: validated.title,
			content: validated.content,
			importance: validated.importance,
			confidence: validated.confidence,
			sourceConversationId: validated.sourceConversationId || null,
			sourceMessageId: validated.sourceMessageId || null,
			isSensitive: false
		};

		if (validated.id) {
			insertValues.id = validated.id;
		}

		const [createdMemory] = await db.insert(memories).values(insertValues).returning();

		// 4. Store embedding
		try {
			await db.insert(memoryEmbeddings).values({
				memoryId: createdMemory.id,
				embedding
			});
		} catch (embErr) {
			console.error(`Failed to store embedding for memory ID ${createdMemory.id}:`, embErr);
			throw new Error('EMBEDDING_FAILURE: Failed to generate vector representation.');
		}

		return json(createdMemory, { status: 201 });
	} catch (error: any) {
		console.error('Error in POST /api/memories:', error);
		let status = 500;
		let code = 'INTERNAL_SERVER_ERROR';
		let message = 'An unexpected error occurred';

		if (error.name === 'ZodError') {
			status = 400;
			code = 'VALIDATION_ERROR';
			message = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
		} else if (
			error.message?.includes('EMBEDDING_FAILURE') ||
			error.message?.includes('embedding') ||
			error.message?.includes('Embedding')
		) {
			status = 500;
			code = 'EMBEDDING_ERROR';
			message = 'Failed to generate embedding for vector search. Please try again.';
		} else if (
			error.message?.includes('db') ||
			error.message?.includes('database') ||
			error.message?.includes('query') ||
			error.code?.startsWith('PG')
		) {
			status = 500;
			code = 'DATABASE_ERROR';
			message = 'A database error occurred while saving memory.';
		}
		return json({ error: { code, message } }, { status });
	}
};

export const PUT: RequestHandler = async ({ request }) => {
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
		const validated = putMemorySchema.parse(body);

		// Get current memory to see if content or title changed
		const existingMemory = await db
			.select()
			.from(memories)
			.where(eq(memories.id, validated.id))
			.limit(1)
			.then((rows) => rows[0]);

		if (!existingMemory) {
			return json({ error: { code: 'NOT_FOUND', message: 'Memory not found' } }, { status: 404 });
		}

		const shouldUpdateEmbedding =
			(validated.title !== undefined && validated.title !== existingMemory.title) ||
			(validated.content !== undefined && validated.content !== existingMemory.content);

		// 3. Update memory
		const updateValues: any = { ...validated };
		delete updateValues.id;

		const updated = await updateMemory(validated.id, updateValues);

		if (!updated) {
			return json(
				{ error: { code: 'NOT_FOUND', message: 'Failed to update memory' } },
				{ status: 404 }
			);
		}

		// 4. Update embedding if needed
		if (shouldUpdateEmbedding) {
			try {
				const embeddingText = `${updated.title}: ${updated.content}`;
				const embedding = await embeddingService.getEmbedding(embeddingText);

				// Delete old embedding
				await db.delete(memoryEmbeddings).where(eq(memoryEmbeddings.memoryId, updated.id));

				// Insert new embedding
				await db.insert(memoryEmbeddings).values({
					memoryId: updated.id,
					embedding
				});
			} catch (embErr) {
				console.error(`Failed to update embedding for memory ID ${updated.id}:`, embErr);
				throw new Error('EMBEDDING_FAILURE: Failed to update vector representation.');
			}
		}

		return json(updated);
	} catch (error: any) {
		console.error('Error in PUT /api/memories:', error);
		let status = 500;
		let code = 'INTERNAL_SERVER_ERROR';
		let message = 'An unexpected error occurred';

		if (error.name === 'ZodError') {
			status = 400;
			code = 'VALIDATION_ERROR';
			message = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
		} else if (
			error.message?.includes('EMBEDDING_FAILURE') ||
			error.message?.includes('embedding') ||
			error.message?.includes('Embedding')
		) {
			status = 500;
			code = 'EMBEDDING_ERROR';
			message = 'Failed to generate embedding for vector search. Please try again.';
		} else if (
			error.message?.includes('db') ||
			error.message?.includes('database') ||
			error.message?.includes('query') ||
			error.code?.startsWith('PG')
		) {
			status = 500;
			code = 'DATABASE_ERROR';
			message = 'A database error occurred while updating memory.';
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
		const validated = deleteMemorySchema.parse(body);

		const user = await getOrCreateDefaultUser();

		if (validated.clearAll) {
			const { clearAllLocalData } = await import('$lib/server/memory/save');
			await clearAllLocalData(user.id);
			return json({ success: true, message: 'All local data cleared successfully.' });
		}

		if (validated.clearMemories) {
			await db.delete(memories).where(eq(memories.userId, user.id));
			return json({ success: true, message: 'All saved memories were cleared.' });
		}

		if (!validated.id) {
			return json(
				{ error: { code: 'BAD_REQUEST', message: 'Memory ID is required' } },
				{ status: 400 }
			);
		}

		// 3. Delete memory
		const deleted = await deleteMemory(validated.id);
		if (!deleted) {
			return json({ error: { code: 'NOT_FOUND', message: 'Memory not found' } }, { status: 404 });
		}

		return json({ success: true, deleted });
	} catch (error: any) {
		console.error('Error in DELETE /api/memories:', error);
		let status = 500;
		let code = 'INTERNAL_SERVER_ERROR';
		let message = 'An unexpected error occurred';

		if (error.name === 'ZodError') {
			status = 400;
			code = 'VALIDATION_ERROR';
			message = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
		} else if (
			error.message?.includes('db') ||
			error.message?.includes('database') ||
			error.message?.includes('query') ||
			error.code?.startsWith('PG')
		) {
			status = 500;
			code = 'DATABASE_ERROR';
			message = 'A database error occurred while deleting memory.';
		}
		return json({ error: { code, message } }, { status });
	}
};
