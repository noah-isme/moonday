import { db } from '$lib/server/db';
import { users, userProfiles } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

async function getOrCreateDefaultUser() {
	let [user] = await db.select().from(users).limit(1);
	if (!user) {
		const [newUser] = await db.insert(users).values({ displayName: 'Noah' }).returning();
		user = newUser;
	}
	return user;
}

export const load: PageServerLoad = async () => {
	const user = await getOrCreateDefaultUser();
	let [profile] = await db.select().from(userProfiles).where(eq(userProfiles.id, user.id));

	if (!profile) {
		const [newProfile] = await db
			.insert(userProfiles)
			.values({
				id: user.id,
				name: 'Noah',
				bio: 'Senior Software Architect',
				occupation: 'Software Architect',
				communicationStyle: {
					formality: 'to-the-point',
					tone: 'straightforward',
					sarcasmLevel: 'none'
				}
			})
			.returning();
		profile = newProfile;
	}

	return {
		profile
	};
};

const profileSchema = z.object({
	name: z.string().trim().min(1, 'Name cannot be empty'),
	bio: z.string().trim().optional(),
	occupation: z.string().trim().optional(),
	communicationStyle: z.string().refine(
		(val) => {
			try {
				const parsed = JSON.parse(val);
				return typeof parsed === 'object' && parsed !== null;
			} catch {
				return false;
			}
		},
		{
			message: 'Communication Style must be a valid JSON object'
		}
	)
});

export const actions: Actions = {
	default: async ({ request }) => {
		const user = await getOrCreateDefaultUser();
		const formData = await request.formData();
		const name = formData.get('name')?.toString() || '';
		const bio = formData.get('bio')?.toString() || '';
		const occupation = formData.get('occupation')?.toString() || '';
		const communicationStyle = formData.get('communicationStyle')?.toString() || '';

		const result = profileSchema.safeParse({
			name,
			bio,
			occupation,
			communicationStyle
		});

		if (!result.success) {
			const error = result.error.flatten().fieldErrors;
			return fail(400, {
				error,
				values: {
					name,
					bio,
					occupation,
					communicationStyle
				}
			});
		}

		try {
			const parsedStyle = JSON.parse(result.data.communicationStyle);

			await db.transaction(async (tx) => {
				// Update displayName in users
				await tx
					.update(users)
					.set({
						displayName: result.data.name,
						updatedAt: new Date()
					})
					.where(eq(users.id, user.id));

				// Upsert user profile
				await tx
					.insert(userProfiles)
					.values({
						id: user.id,
						name: result.data.name,
						bio: result.data.bio,
						occupation: result.data.occupation,
						communicationStyle: parsedStyle
					})
					.onConflictDoUpdate({
						target: userProfiles.id,
						set: {
							name: result.data.name,
							bio: result.data.bio,
							occupation: result.data.occupation,
							communicationStyle: parsedStyle
						}
					});
			});

			return { success: true };
		} catch (err: any) {
			return fail(500, {
				error: { _form: 'Failed to update profile: ' + (err.message || 'unknown error') },
				values: {
					name,
					bio,
					occupation,
					communicationStyle
				}
			});
		}
	}
};
