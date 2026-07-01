import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { POST as chatPOST } from '../routes/api/chat/+server';
import { POST as moodPOST } from '../routes/api/mood/+server';
import { POST as reflectionPOST } from '../routes/api/reflections/+server';
import { db, client } from '../lib/server/db/client';
import { users } from '../lib/server/db/schema';
import { eq } from 'drizzle-orm';

describe('API Route Validation & Security', () => {
	beforeAll(async () => {
		// Clean up any test users
		await db.delete(users).where(eq(users.displayName, 'Local User'));
	});

	afterAll(async () => {
		await db.delete(users).where(eq(users.displayName, 'Local User'));
		await client.end();
	});

	it('should reject malformed JSON in chat route', async () => {
		const request = new Request('http://localhost/api/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{ malformed json '
		});

		const response = await chatPOST({ request } as any);
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error.code).toBe('MALFORMED_JSON');
	});

	it('should reject empty message in chat route', async () => {
		const request = new Request('http://localhost/api/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: '   ' })
		});

		const response = await chatPOST({ request } as any);
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error.code).toBe('VALIDATION_ERROR');
	});

	it('should reject excessively large payload in chat route', async () => {
		const largeMessage = 'a'.repeat(600 * 1024); // 600 KB (limit is 512 KB)
		const request = new Request('http://localhost/api/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: largeMessage })
		});

		const response = await chatPOST({ request } as any);
		expect(response.status).toBe(413);
		const data = await response.json();
		expect(data.error.code).toBe('PAYLOAD_TOO_LARGE');
	});

	it('should reject malformed JSON in mood route', async () => {
		const request = new Request('http://localhost/api/mood', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{ bad '
		});

		const response = await moodPOST({ request } as any);
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error.code).toBe('MALFORMED_JSON');
	});

	it('should reject invalid mood score in mood route', async () => {
		const request = new Request('http://localhost/api/mood', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				moodLabel: 'happy',
				moodScore: 10 // exceeds limit of 5
			})
		});

		const response = await moodPOST({ request } as any);
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error.code).toBe('VALIDATION_ERROR');
	});

	it('should reject malformed date in reflection route', async () => {
		const request = new Request('http://localhost/api/reflections', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				date: '01-07-2026' // should be YYYY-MM-DD
			})
		});

		const response = await reflectionPOST({ request } as any);
		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error.code).toBe('VALIDATION_ERROR');
	});
});
