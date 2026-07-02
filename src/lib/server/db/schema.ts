import { pgTable, uuid, text, integer, boolean, timestamp, real, jsonb } from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';

export const EMBEDDING_DIMENSION = 384;

export const users = pgTable('users', {
	id: uuid('id').defaultRandom().primaryKey(),
	displayName: text('display_name').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const characterProfiles = pgTable('character_profiles', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: text('name').notNull(),
	description: text('description'),
	tone: text('tone'),
	traits: jsonb('traits').$type<Record<string, number>>().notNull().default({}),
	exampleDialogues: jsonb('example_dialogues').$type<string[]>().default([]),
	temperature: real('temperature').default(0.7).notNull(),
	systemPrompt: text('system_prompt').notNull(),
	isDefault: boolean('is_default').default(false).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const conversations = pgTable('conversations', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: uuid('user_id')
		.references(() => users.id, { onDelete: 'cascade' })
		.notNull(),
	title: text('title'),
	activeCharacterId: uuid('active_character_id').references(() => characterProfiles.id, {
		onDelete: 'set null'
	}),
	summary: text('summary'),
	lastEmotionLabel: text('last_emotion_label'),
	lastMoodScore: integer('last_mood_score'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const messages = pgTable('messages', {
	id: uuid('id').defaultRandom().primaryKey(),
	conversationId: uuid('conversation_id')
		.references(() => conversations.id, { onDelete: 'cascade' })
		.notNull(),
	role: text('role').notNull(), // 'user' | 'assistant' | 'system'
	content: text('content').notNull(),
	provider: text('provider'), // e.g. 'deepseek' | 'claude'
	model: text('model'),
	emotionLabel: text('emotion_label'),
	moodScore: integer('mood_score'),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const moodLogs = pgTable('mood_logs', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: uuid('user_id')
		.references(() => users.id, { onDelete: 'cascade' })
		.notNull(),
	moodLabel: text('mood_label').notNull(),
	moodScore: integer('mood_score').notNull(), // -5 to 5
	energyLevel: integer('energy_level'),
	stressLevel: integer('stress_level'),
	note: text('note'),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const memories = pgTable('memories', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: uuid('user_id')
		.references(() => users.id, { onDelete: 'cascade' })
		.notNull(),
	type: text('type').notNull(), // e.g. 'core_memory', 'preference', 'emotional_pattern', 'project_memory', 'relationship_context', 'personal_goal', 'recurring_problem', 'reflection'
	title: text('title').notNull(),
	content: text('content').notNull(),
	importance: integer('importance').notNull(), // 1 to 10
	confidence: real('confidence').notNull(), // 0.0 to 1.0
	sourceConversationId: uuid('source_conversation_id').references(() => conversations.id, {
		onDelete: 'set null'
	}),
	sourceMessageId: uuid('source_message_id').references(() => messages.id, {
		onDelete: 'set null'
	}),
	lastReferencedAt: timestamp('last_referenced_at'),
	isSensitive: boolean('is_sensitive').default(false).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const memoryEmbeddings = pgTable('memory_embeddings', {
	id: uuid('id').defaultRandom().primaryKey(),
	memoryId: uuid('memory_id')
		.references(() => memories.id, { onDelete: 'cascade' })
		.notNull(),
	embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSION }).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const dailyReflections = pgTable('daily_reflections', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: uuid('user_id')
		.references(() => users.id, { onDelete: 'cascade' })
		.notNull(),
	date: text('date').notNull(), // 'YYYY-MM-DD'
	moodSummary: text('mood_summary'),
	emotionalSummary: text('emotional_summary'),
	importantEvents: text('important_events'),
	suggestedFocus: text('suggested_focus'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const aiProviderLogs = pgTable('ai_provider_logs', {
	id: uuid('id').defaultRandom().primaryKey(),
	provider: text('provider').notNull(),
	model: text('model').notNull(),
	inputTokens: integer('input_tokens'),
	outputTokens: integer('output_tokens'),
	latencyMs: integer('latency_ms'),
	costEstimate: real('cost_estimate'),
	requestType: text('request_type').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});
