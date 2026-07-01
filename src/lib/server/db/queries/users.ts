import { db } from '../client';
import { users } from '../schema';
import { eq } from 'drizzle-orm';

export interface CreateUserInput {
	displayName: string;
}

export interface UpdateUserInput {
	displayName: string;
}

export async function createUser(input: CreateUserInput) {
	const [result] = await db
		.insert(users)
		.values({
			displayName: input.displayName
		})
		.returning();
	return result;
}

export async function getUserById(id: string) {
	const [result] = await db.select().from(users).where(eq(users.id, id)).limit(1);
	return result || null;
}

export async function updateUser(id: string, input: UpdateUserInput) {
	const [result] = await db
		.update(users)
		.set({
			displayName: input.displayName,
			updatedAt: new Date()
		})
		.where(eq(users.id, id))
		.returning();
	return result || null;
}

export async function deleteUser(id: string) {
	const [result] = await db.delete(users).where(eq(users.id, id)).returning();
	return result || null;
}
