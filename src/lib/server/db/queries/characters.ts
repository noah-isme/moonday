import { db } from '../client';
import { characterProfiles } from '../schema';
import { eq, desc } from 'drizzle-orm';

export interface CreateCharacterInput {
	name: string;
	description?: string;
	tone?: string;
	humorLevel: number;
	sarcasmLevel: number;
	emotionalWarmth: number;
	moralDirectness: number;
	systemPrompt: string;
	isDefault?: boolean;
}

export interface UpdateCharacterInput {
	name?: string;
	description?: string;
	tone?: string;
	humorLevel?: number;
	sarcasmLevel?: number;
	emotionalWarmth?: number;
	moralDirectness?: number;
	systemPrompt?: string;
	isDefault?: boolean;
}

export async function createCharacterProfile(input: CreateCharacterInput) {
	const [result] = await db
		.insert(characterProfiles)
		.values({
			name: input.name,
			description: input.description,
			tone: input.tone,
			humorLevel: input.humorLevel,
			sarcasmLevel: input.sarcasmLevel,
			emotionalWarmth: input.emotionalWarmth,
			moralDirectness: input.moralDirectness,
			systemPrompt: input.systemPrompt,
			isDefault: input.isDefault ?? false
		})
		.returning();
	return result;
}

export async function getCharacterProfiles() {
	return db
		.select()
		.from(characterProfiles)
		.orderBy(desc(characterProfiles.isDefault), characterProfiles.name);
}

export async function getDefaultCharacterProfile() {
	const [result] = await db
		.select()
		.from(characterProfiles)
		.where(eq(characterProfiles.isDefault, true))
		.limit(1);
	return result || null;
}

export async function getCharacterProfileById(id: string) {
	const [result] = await db
		.select()
		.from(characterProfiles)
		.where(eq(characterProfiles.id, id))
		.limit(1);
	return result || null;
}

export async function updateCharacterProfile(id: string, input: UpdateCharacterInput) {
	const [result] = await db
		.update(characterProfiles)
		.set({
			...input,
			updatedAt: new Date()
		})
		.where(eq(characterProfiles.id, id))
		.returning();
	return result || null;
}

export async function deleteCharacterProfile(id: string) {
	const [result] = await db
		.delete(characterProfiles)
		.where(eq(characterProfiles.id, id))
		.returning();
	return result || null;
}
