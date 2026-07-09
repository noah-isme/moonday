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
	const values: string[] = [];
	if (style.formality) {
		values.push(`${style.formality}`);
	}
	if (style.tone) {
		values.push(`${style.tone}`);
	}
	if (style.sarcasmLevel && style.sarcasmLevel !== 'none') {
		values.push(`${style.sarcasmLevel} sarcasm`);
	}

	if (values.length > 0) {
		const valuesText = values.length === 1 
			? `${values[0]}` 
			: values.slice(0, -1).join(', ') + ' and ' + values[values.length - 1];
		description += ` who values ${valuesText} communication`;
	}

	description += '.';
	return description;
}
