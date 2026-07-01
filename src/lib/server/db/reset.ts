import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { sql } from 'drizzle-orm';
import { seed } from './seed';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error('DATABASE_URL is not set');
}

async function reset() {
	console.log('Resetting database...');
	const client = postgres(connectionString!);
	const db = drizzle(client, { schema });

	try {
		await db.execute(
			sql`TRUNCATE TABLE "users", "character_profiles", "conversations", "daily_reflections", "memories", "memory_embeddings", "messages", "mood_logs", "ai_provider_logs" CASCADE;`
		);
		console.log('Database cleared.');
	} finally {
		await client.end();
	}

	console.log('Starting seed...');
	await seed();
	console.log('Reset and seed complete.');
}

reset().catch((err) => {
	console.error('Reset failed:', err);
	process.exit(1);
});
