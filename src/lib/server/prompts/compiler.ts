import { z } from 'zod';

export const TraitSchema = z.object({
	warmth: z.number().min(1).max(10).default(5),
	honesty: z.number().min(1).max(10).default(5),
	formality: z.number().min(1).max(10).default(5),
	sarcasm: z.number().min(1).max(10).default(5),
	humor: z.number().min(1).max(10).default(5),
	moralDirectness: z.number().min(1).max(10).default(5)
});

export function compileTraitsToDirectives(traits: z.infer<typeof TraitSchema>): string {
	const directives: string[] = [];

	if (traits.warmth > 8) {
		directives.push('You express deep empathy and support.');
	} else if (traits.warmth < 4) {
		directives.push('You are emotionally detached and neutral.');
	}

	if (traits.honesty > 8) {
		directives.push('You are brutally honest and candid.');
	} else if (traits.honesty < 4) {
		directives.push('You prioritize tact and gentleness over harsh honesty.');
	}

	if (traits.formality > 7) {
		directives.push('You speak formally and professionally.');
	} else if (traits.formality < 4) {
		directives.push('You speak casually and informally.');
	}

	if (traits.sarcasm > 7) {
		directives.push('You use dry humor and friendly sarcasm.');
	} else if (traits.sarcasm < 3) {
		directives.push('You are straightforward and never sarcastic.');
	}

	if (traits.humor > 7) {
		directives.push('You display high humor, keeping the conversation lighthearted and witty.');
	} else if (traits.humor < 3) {
		directives.push('You maintain a serious and focused tone, using humor very sparingly.');
	}

	if (traits.moralDirectness > 7) {
		directives.push('You offer direct moral and growth guidance.');
	}

	return directives.join(' ');
}

export const UserProfileSchema = z.object({
	id: z.string().uuid().optional(),
	name: z.string(),
	bio: z.string().nullable().optional(),
	occupation: z.string().nullable().optional(),
	communicationStyle: z.record(z.string(), z.any()).default({})
});

export function compileUserPersona(profile: unknown): string {
	const parsed = UserProfileSchema.parse(profile);
	let description = `The user is ${parsed.name}`;

	if (parsed.occupation && parsed.bio) {
		description += `, a ${parsed.occupation} (${parsed.bio})`;
	} else if (parsed.occupation) {
		description += `, a ${parsed.occupation}`;
	} else if (parsed.bio) {
		description += `, ${parsed.bio}`;
	}

	const style = parsed.communicationStyle;
	description += '.';

	const preferences: string[] = [];
	if (typeof style.tone === 'string') preferences.push(`Use a ${style.tone} tone.`);
	if (typeof style.formality === 'string')
		preferences.push(`Keep the register ${style.formality}.`);
	if (typeof style.sarcasmLevel === 'string') {
		preferences.push(`Use ${style.sarcasmLevel} sarcasm; never make it insulting.`);
	}

	const numericPreference = (key: string) => {
		const value = Number(style[key]);
		return Number.isFinite(value) ? value : undefined;
	};
	const warmth = numericPreference('warmth');
	const directness = numericPreference('directness');
	const humor = numericPreference('humor');
	const responseLength = numericPreference('responseLength');
	const questionFrequency = numericPreference('questionFrequency');

	if (warmth !== undefined) preferences.push(`Emotional warmth: ${warmth}/5.`);
	if (directness !== undefined) preferences.push(`Directness: ${directness}/5.`);
	if (humor !== undefined) preferences.push(`Humor: ${humor}/5.`);
	if (responseLength !== undefined)
		preferences.push(`Preferred response length: ${responseLength}/5.`);
	if (questionFrequency !== undefined)
		preferences.push(
			`Question frequency: ${questionFrequency}/5; do not ask a question by default.`
		);

	return preferences.length > 0
		? `${description}\n\n[User Response Preferences]\n${preferences.join(' ')}`
		: description;
}
