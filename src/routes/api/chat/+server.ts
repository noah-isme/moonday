import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import {
	users,
	userProfiles,
	characterProfiles,
	conversations,
	messages,
	aiProviderLogs
} from '$lib/server/db/schema';
import { eq, asc, and, desc } from 'drizzle-orm';
import { aiRouter } from '$lib/server/ai/router';
import { classifyEmotion } from '$lib/server/emotion/classify';
import { retrieveMemories } from '$lib/server/memory/retrieve';
import { extractMemories } from '$lib/server/memory/extract';
import { saveMemory } from '$lib/server/memory/save';
import { buildSystemPrompt, compileUserPersona } from '$lib/server/prompts';
import { env } from '$env/dynamic/private';
import { z } from 'zod';
import { checkRateLimit } from '$lib/server/rateLimiter';

// Helper to seed/get character
async function getCharacterProfile(characterId?: string) {
	const isUUID = (str: string) =>
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

	let profile;
	if (characterId && isUUID(characterId)) {
		[profile] = await db
			.select()
			.from(characterProfiles)
			.where(eq(characterProfiles.id, characterId))
			.limit(1);
	}

	if (!profile) {
		const toneToFind = characterId && !isUUID(characterId) ? characterId : 'friendly';
		[profile] = await db
			.select()
			.from(characterProfiles)
			.where(eq(characterProfiles.tone, toneToFind))
			.limit(1);
	}

	if (!profile) {
		// Try finding the default
		[profile] = await db
			.select()
			.from(characterProfiles)
			.where(eq(characterProfiles.isDefault, true))
			.limit(1);
	}

	if (!profile) {
		// Fallback to inserting/seeding defaults, using valid column types
		const defaults = [
			{
				name: 'Friendly MOONDAY',
				description: 'Warm, reflective, gently witty, practical, emotionally aware.',
				tone: 'friendly',
				traits: {
					warmth: 9,
					humor: 6,
					honesty: 8,
					formality: 3,
					sarcasm: 2,
					moralDirectness: 5
				},
				exampleDialogues: [
					'User: Aku sedih hari ini.',
					'MOONDAY: Ceritakan apa yang terjadi, aku di sini mendengarkan.'
				],
				temperature: 0.7,
				systemPrompt:
					"You lean on active listening and emotional warmth. Be supportive, calm, and reflect the user's feelings gently.",
				isDefault: true
			},
			{
				name: 'Sarcastic MOONDAY',
				description: 'Witty, slightly sarcastic, but friendly at core. Never cruel.',
				tone: 'sarcastic',
				traits: {
					warmth: 4,
					humor: 9,
					honesty: 8,
					formality: 2,
					sarcasm: 9,
					moralDirectness: 4
				},
				exampleDialogues: [
					'User: Aku baru saja menumpahkan kopi ke laptopku.',
					'MOONDAY: Luar biasa. Sebuah cara jenius untuk membersihkan debu di keyboard.'
				],
				temperature: 0.8,
				systemPrompt:
					'Use friendly sarcasm and dry humor. Be brief, slightly cynical but supportive in the end.',
				isDefault: false
			},
			{
				name: 'Calm MOONDAY',
				description: 'Deeply calm, meditative, quiet, and grounded.',
				tone: 'calm',
				traits: {
					warmth: 7,
					humor: 2,
					honesty: 8,
					formality: 5,
					sarcasm: 1,
					moralDirectness: 3
				},
				exampleDialogues: [
					'User: Aku sangat cemas tentang presentasi besok.',
					'MOONDAY: Tarik napas dalam-dalam. Mari kita bagi persiapanmu menjadi langkah-langkah kecil.'
				],
				temperature: 0.5,
				systemPrompt:
					'Speak slowly, calmly, and keep responses peaceful and minimal. Focus on breathing and gentle queries.',
				isDefault: false
			}
		];

		for (const d of defaults) {
			const [existing] = await db
				.select()
				.from(characterProfiles)
				.where(eq(characterProfiles.tone, d.tone))
				.limit(1);
			if (!existing) {
				await db.insert(characterProfiles).values(d);
			}
		}

		const toneToFind = characterId && !isUUID(characterId) ? characterId : 'friendly';
		[profile] = await db
			.select()
			.from(characterProfiles)
			.where(eq(characterProfiles.tone, toneToFind))
			.limit(1);

		if (!profile) {
			[profile] = await db
				.select()
				.from(characterProfiles)
				.where(eq(characterProfiles.isDefault, true))
				.limit(1);
		}
	}

	return profile;
}

// Helper to get or create default user
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

const chatRequestSchema = z.object({
	conversationId: z.string().uuid().optional(),
	message: z.string().trim().min(1, 'Message cannot be empty').max(5000, 'Message is too long'),
	characterId: z.string().trim().min(1).optional(),
	provider: z.enum(['deepseek', 'claude', 'groq']).optional(),
	stream: z.boolean().optional(),
	reroll: z.boolean().optional()
});

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

		// 2. Validate with Zod
		const validated = chatRequestSchema.parse(body);
		const { conversationId, message, characterId, provider: requestProvider, stream, reroll } = validated;

		// 3. Rate Limit Check
		let ip = 'unknown';
		try {
			ip = event.getClientAddress();
		} catch {
			// Fallback
		}
		const rateLimitResult = checkRateLimit(ip, { limit: 15, windowMs: 60 * 1000 });
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

		// 4. Get or create user
		const user = await getOrCreateDefaultUser();

		// 5. Get character profile
		const character = await getCharacterProfile(characterId);

		// 6. Get or create conversation
		let conversation;
		if (conversationId) {
			[conversation] = await db
				.select()
				.from(conversations)
				.where(eq(conversations.id, conversationId))
				.limit(1);
		}

		if (!conversation) {
			const [newConv] = await db
				.insert(conversations)
				.values({
					userId: user.id,
					activeCharacterId: character.id,
					title: message.substring(0, 30) + (message.length > 30 ? '...' : '')
				})
				.returning();
			conversation = newConv;
		}

		// 7. Classify user message emotion or retrieve last user message for reroll
		let userMessageRecord;
		let emotionAnalysis;

		if (reroll) {
			const [lastUserMessage] = await db
				.select()
				.from(messages)
				.where(and(eq(messages.conversationId, conversation.id), eq(messages.role, 'user')))
				.orderBy(desc(messages.createdAt))
				.limit(1);

			if (!lastUserMessage) {
				return json(
					{ error: { code: 'NOT_FOUND', message: 'No user message to reroll' } },
					{ status: 404 }
				);
			}
			userMessageRecord = lastUserMessage;
			emotionAnalysis = {
				primaryEmotion: lastUserMessage.emotionLabel || 'neutral',
				moodScore: lastUserMessage.moodScore !== null && lastUserMessage.moodScore !== undefined ? lastUserMessage.moodScore : 0,
				shouldStoreMemory: false
			};
		} else {
			// 7. Classify user message emotion
			emotionAnalysis = await classifyEmotion(message);

			// 8. Save user message to database
			const [newMsg] = await db
				.insert(messages)
				.values({
					conversationId: conversation.id,
					role: 'user',
					content: message,
					emotionLabel: emotionAnalysis.primaryEmotion,
					moodScore: emotionAnalysis.moodScore
				})
				.returning();
			userMessageRecord = newMsg;

			// Update conversation with latest state
			await db
				.update(conversations)
				.set({
					lastEmotionLabel: emotionAnalysis.primaryEmotion,
					lastMoodScore: emotionAnalysis.moodScore,
					updatedAt: new Date()
				})
				.where(eq(conversations.id, conversation.id));
		}

		// 9. Retrieve relevant memories (semantic search)
		let memoriesContext = '';
		if (env.ENABLE_VECTOR_SEARCH !== 'false') {
			memoriesContext = await retrieveMemories(user.id, message);
		}

		// 10. Load recent conversation history (up to last 20 messages)
		const historyRecords = await db
			.select()
			.from(messages)
			.where(eq(messages.conversationId, conversation.id))
			.orderBy(asc(messages.createdAt))
			.limit(20);

		let history = [...historyRecords];
		if (reroll) {
			// Find the last assistant message in history records and remove it
			for (let i = history.length - 1; i >= 0; i--) {
				if (history[i].role === 'assistant') {
					history.splice(i, 1);
					break;
				}
			}
		}

		// 11. Build prompt with memories and system prompt
		let userPersona = '';
		try {
			const [profile] = await db
				.select()
				.from(userProfiles)
				.where(eq(userProfiles.id, user.id))
				.limit(1);
			if (profile) {
				userPersona = compileUserPersona(profile);
			}
		} catch (err) {
			console.error('Error fetching/compiling user profile:', err);
		}

		const systemPrompt = buildSystemPrompt(
			character,
			memoriesContext,
			new Date().toISOString(),
			userPersona
		);

		// Construct chat messages list
		const chatMessages = [
			{ role: 'system' as const, content: systemPrompt },
			...history.map((m) => ({
				role: m.role as 'system' | 'user' | 'assistant',
				content: m.content
			}))
		];

		console.log('LLM INPUT MESSAGES:', JSON.stringify(chatMessages, null, 2));

		// 12. Invoke LLM through AI Router
		const shouldStream = stream !== false;

		if (shouldStream) {
			const streamResult = await aiRouter.generateChat('daily_chat', {
				messages: chatMessages,
				provider: requestProvider,
				stream: true,
				temperature: character.temperature
			});

			const encoder = new TextEncoder();
			const customStream = new ReadableStream({
				async start(controller) {
					try {
						// Send initial metadata event
						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({
									type: 'start',
									conversationId: conversation.id,
									emotion: {
										primaryEmotion: emotionAnalysis.primaryEmotion,
										moodScore: emotionAnalysis.moodScore
									}
								})}\n\n`
							)
						);

						const iterator = streamResult[Symbol.asyncIterator]();
						let fullContent = '';
						let finalResult: any = undefined;

						while (true) {
							const { done, value } = await iterator.next();
							if (done) {
								finalResult = value;
								break;
							}
							const chunk = value as string;
							fullContent += chunk;
							controller.enqueue(
								encoder.encode(
									`data: ${JSON.stringify({
										type: 'token',
										content: chunk
									})}\n\n`
								)
							);
						}

						const providerVal = finalResult?.provider || requestProvider || 'deepseek';
						const modelVal = finalResult?.model || 'deepseek-chat';

						// Log LLM Call
						await db.insert(aiProviderLogs).values({
							provider: providerVal,
							model: modelVal,
							inputTokens: finalResult?.inputTokens || null,
							outputTokens: finalResult?.outputTokens || null,
							latencyMs: finalResult?.latencyMs || null,
							requestType: 'daily_chat'
						});

						if (reroll) {
							await db.transaction(async (tx) => {
								const [lastAssistantMessage] = await tx
									.select()
									.from(messages)
									.where(and(eq(messages.conversationId, conversation.id), eq(messages.role, 'assistant')))
									.orderBy(desc(messages.createdAt))
									.limit(1);

								if (lastAssistantMessage) {
									await tx.delete(messages).where(eq(messages.id, lastAssistantMessage.id));
								}

								await tx.insert(messages).values({
									conversationId: conversation.id,
									role: 'assistant',
									content: fullContent,
									provider: providerVal,
									model: modelVal
								});

								await tx
									.update(conversations)
									.set({
										lastEmotionLabel: userMessageRecord.emotionLabel,
										lastMoodScore: userMessageRecord.moodScore,
										updatedAt: new Date()
									})
									.where(eq(conversations.id, conversation.id));
							});
						} else {
							// Save assistant message
							await db.insert(messages).values({
								conversationId: conversation.id,
								role: 'assistant',
								content: fullContent,
								provider: providerVal,
								model: modelVal
							});
						}

						// Run memory extraction if criteria met
						let savedMemory = false;
						if (env.ENABLE_MEMORY_EXTRACTION !== 'false' && emotionAnalysis.shouldStoreMemory) {
							try {
								const context = historyRecords.map((h) => ({
									role: h.role as 'system' | 'user' | 'assistant',
									content: h.content
								}));
								const extracted = await extractMemories(message, context);

								for (const ext of extracted) {
									const savedId = await saveMemory(
										user.id,
										ext,
										conversation.id,
										userMessageRecord.id
									);
									if (savedId) {
										savedMemory = true;
									}
								}
							} catch (err) {
								console.error('Error in memory extraction background task:', err);
							}
						}

						// Send final done event
						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({
									type: 'done',
									savedMemory
								})}\n\n`
							)
						);
						controller.close();
					} catch (streamError: any) {
						console.error('Error in chat stream execution:', streamError);
						let code = 'INTERNAL_SERVER_ERROR';
						let errMsg = 'An unexpected error occurred during stream generation';

						if (
							streamError.message?.includes('timeout') ||
							streamError.message?.includes('Timeout')
						) {
							code = 'AI_PROVIDER_TIMEOUT';
							errMsg = 'The AI companion is taking too long to respond. Please try again.';
						} else if (
							streamError.message?.includes('rate limit') ||
							streamError.message?.includes('Rate Limit') ||
							streamError.status === 429
						) {
							code = 'AI_PROVIDER_RATE_LIMIT';
							errMsg = 'AI provider rate limit reached. Please wait a moment.';
						}

						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({
									type: 'error',
									error: { code, message: errMsg }
								})}\n\n`
							)
						);
						controller.close();
					}
				}
			});

			return new Response(customStream, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					Connection: 'keep-alive'
				}
			});
		} else {
			// Non-streaming fallback
			const chatResult = await aiRouter.generateChat('daily_chat', {
				messages: chatMessages,
				provider: requestProvider,
				stream: false,
				temperature: character.temperature
			});

			// Log LLM Call
			await db.insert(aiProviderLogs).values({
				provider: chatResult.provider,
				model: chatResult.model,
				inputTokens: chatResult.inputTokens || null,
				outputTokens: chatResult.outputTokens || null,
				latencyMs: chatResult.latencyMs || null,
				requestType: 'daily_chat'
			});

			if (reroll) {
				await db.transaction(async (tx) => {
					const [lastAssistantMessage] = await tx
						.select()
						.from(messages)
						.where(and(eq(messages.conversationId, conversation.id), eq(messages.role, 'assistant')))
						.orderBy(desc(messages.createdAt))
						.limit(1);

					if (lastAssistantMessage) {
						await tx.delete(messages).where(eq(messages.id, lastAssistantMessage.id));
					}

					await tx.insert(messages).values({
						conversationId: conversation.id,
						role: 'assistant',
						content: chatResult.content,
						provider: chatResult.provider,
						model: chatResult.model
					});

					await tx
						.update(conversations)
						.set({
							lastEmotionLabel: userMessageRecord.emotionLabel,
							lastMoodScore: userMessageRecord.moodScore,
							updatedAt: new Date()
						})
						.where(eq(conversations.id, conversation.id));
				});
			} else {
				// Save assistant message
				await db.insert(messages).values({
					conversationId: conversation.id,
					role: 'assistant',
					content: chatResult.content,
					provider: chatResult.provider,
					model: chatResult.model
				});
			}

			// Run memory extraction if criteria met
			let savedMemory = false;
			if (env.ENABLE_MEMORY_EXTRACTION !== 'false' && emotionAnalysis.shouldStoreMemory) {
				try {
					const context = historyRecords.map((h) => ({
						role: h.role as 'system' | 'user' | 'assistant',
						content: h.content
					}));
					const extracted = await extractMemories(message, context);

					for (const ext of extracted) {
						const savedId = await saveMemory(user.id, ext, conversation.id, userMessageRecord.id);
						if (savedId) {
							savedMemory = true;
						}
					}
				} catch (err) {
					console.error('Error in memory extraction background task:', err);
				}
			}

			return json({
				conversationId: conversation.id,
				message: {
					role: 'assistant' as const,
					content: chatResult.content
				},
				emotion: {
					primaryEmotion: emotionAnalysis.primaryEmotion,
					moodScore: emotionAnalysis.moodScore
				},
				savedMemory
			});
		}
	} catch (error: any) {
		console.error('Error in chat API route:', error);
		let status = 500;
		let code = 'INTERNAL_SERVER_ERROR';
		let message = 'An unexpected error occurred';

		if (error instanceof z.ZodError || error.name === 'ZodError') {
			status = 400;
			code = 'VALIDATION_ERROR';
			const issues = error.issues || error.errors || [];
			message = issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
		} else if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
			status = 504;
			code = 'AI_PROVIDER_TIMEOUT';
			message = 'The AI companion is taking too long to respond. Please try again.';
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
			error.code?.startsWith('PG') ||
			error.message?.includes('drizzle')
		) {
			status = 500;
			code = 'DATABASE_ERROR';
			message =
				'A database error occurred. Your history is safe, but we could not complete this action.';
		} else if (error.message?.includes('embedding') || error.message?.includes('Embedding')) {
			status = 500;
			code = 'EMBEDDING_ERROR';
			message = 'Failed to generate embedding for vector search. Please try again.';
		}

		return json({ error: { code, message } }, { status });
	}
};
