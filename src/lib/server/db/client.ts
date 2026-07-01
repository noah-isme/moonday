import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const connectionString = env.DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('DATABASE_URL environment variable is not set');
}

export const client = postgres(connectionString);
export const db = drizzle(client, { schema });

// Run migrations on startup (server-side only)
if (typeof window === 'undefined') {
	console.log('Checking and running database migrations...');
	migrate(db, { migrationsFolder: 'src/lib/server/db/migrations' })
		.then(() => {
			console.log('Database migrations verified/completed successfully.');
		})
		.catch((err) => {
			console.error('Failed to run database migrations:', err);
		});
}
