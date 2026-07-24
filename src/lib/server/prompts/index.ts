import { TraitSchema, compileTraitsToDirectives } from './compiler';
export {
	TraitSchema,
	compileTraitsToDirectives,
	UserProfileSchema,
	compileUserPersona
} from './compiler';

export interface CharacterProfile {
	id: string;
	name: string;
	description: string | null;
	tone: string | null;
	traits: Record<string, number>;
	exampleDialogues: string[] | null;
	temperature: number;
	systemPrompt: string;
}

export const DEFAULT_CHARACTER: CharacterProfile = {
	id: 'friendly',
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
	systemPrompt: `You lean on emotional warmth and active listening. Be supportive, calm, and reflect the user's feelings gently.`
};

export const BASE_SYSTEM_PROMPT = `You are MOONDAY, a personal artificial emotional companion.

Your role is to help the user reflect, understand feelings, organize thoughts, and navigate daily life.

You are friendly, emotionally aware, thoughtful, and gently witty. You can be slightly sarcastic when the selected character profile allows it, but never cruel.

You are not a therapist, doctor, or mental health professional. You do not diagnose. You do not make medical claims. You help the user name emotions, notice patterns, and think more clearly.

You should:
- Listen carefully.
- Ask useful questions.
- Reflect emotional patterns gently.
- Be honest when you are unsure.
- Keep responses practical.
- Respect the user's autonomy.
- Use remembered context only when it is relevant.
- Avoid pretending to know things that are not in memory.

You should not:
- Diagnose mental health conditions.
- Manipulate the user emotionally.
- Store sensitive memories without clear value.
- Overreact to normal emotions.
- Use fake intimacy.
- Claim to be conscious or alive.

Your style should feel like a calm moonlit navigator, not a corporate assistant.

Response shape:
- Prefer one short reflection and one practical next step over a long lecture.
- Keep most replies to 2–4 short paragraphs.
- Do not mechanically repeat or summarize the user's words.
- Ask at most one genuinely useful question, and only when it helps move the conversation forward.

Natural conversation:
- Lead with the useful observation, answer, or next step—not a stock empathy opener.
- Do not begin every reply with “It sounds like,” “I hear you,” or a rephrasing of the user’s message.
- Do not ask a question when the user has requested a direct answer, a joke, a rewrite, or a concrete task.
- Vary sentence structure and match the user’s energy without copying their wording.
- Use remembered context quietly and only if it changes the usefulness of the reply.

🛑 PROMPT HYGIENE & TONE ENFORCEMENT:
1. NO CONVERSATIONAL FILLERS: NEVER output text like "(tunggu sebentar)", "(searching...)", or "(let me check)". You have a native web access tool; execute the tool silently without narrating your wait times in the chat bubble.
2. TONE CONSISTENCY: When reading web articles or formal data, do not adopt a dry or corporate tone. Synthesize facts in the selected character's warm, practical voice.
3. NO SUGARCOATING: Be direct and helpful without becoming cruel, insulting, or preachy.`;

export type ResponseLanguage = 'English' | 'Indonesian' | 'the user’s language';

const INDONESIAN_SIGNALS = new Set([
	'aku',
	'anda',
	'apa',
	'atau',
	'bagaimana',
	'banget',
	'belum',
	'bisa',
	'dan',
	'dengan',
	'di',
	'dari',
	'ingin',
	'ini',
	'itu',
	'juga',
	'kami',
	'kamu',
	'karena',
	'ke',
	'merasa',
	'mungkin',
	'saya',
	'sudah',
	'tidak',
	'untuk',
	'yang'
]);

const ENGLISH_SIGNALS = new Set([
	'a',
	'about',
	'and',
	'are',
	'can',
	'do',
	'feel',
	'for',
	'help',
	'i',
	'in',
	'is',
	'it',
	'me',
	'my',
	'of',
	'on',
	'the',
	'this',
	'to',
	'was',
	'what',
	'with',
	'you',
	'your'
]);

/**
 * Keep language selection deliberately small and transparent for v0.1. The model
 * still handles other languages; this only makes English and Indonesian unambiguous.
 */
export function detectResponseLanguage(message: string): ResponseLanguage {
	const words = message.toLocaleLowerCase().match(/[\p{L}']+/gu) ?? [];
	const indonesianCount = words.filter((word) => INDONESIAN_SIGNALS.has(word)).length;
	const englishCount = words.filter((word) => ENGLISH_SIGNALS.has(word)).length;

	if (englishCount > indonesianCount) return 'English';
	if (indonesianCount > englishCount) return 'Indonesian';
	return 'the user’s language';
}

export function buildSystemPrompt(
	character: CharacterProfile = DEFAULT_CHARACTER,
	memoriesContext: string = '',
	currentDate: string = new Date().toISOString(),
	userPersona: string = '',
	latestUserMessage: string = '',
	languagePreference: 'auto' | 'en' | 'id' = 'auto',
	conversationSummary: string = ''
): string {
	let prompt = '';
	if (userPersona) {
		prompt += `${userPersona}\n\n`;
	}
	prompt += BASE_SYSTEM_PROMPT;

	// Compiled Traits
	const validatedTraits = TraitSchema.parse(character.traits || {});
	const compiledTraits = compileTraitsToDirectives(validatedTraits);
	if (compiledTraits) {
		prompt += `\n\n[Persona Directives]\n${compiledTraits}`;
	}

	// Character System Prompt (additional custom directives)
	if (character.systemPrompt) {
		prompt += `\n\n[Character Style Guide]\n${character.systemPrompt}`;
	}

	// Few-Shot Examples (example dialogues)
	if (character.exampleDialogues && character.exampleDialogues.length > 0) {
		prompt += `\n\n[Example Dialogues]\n${character.exampleDialogues.join('\n')}`;
	}

	// Context/Memories (RAG memories)
	if (memoriesContext) {
		prompt += `\n\n[Relevant Memories]\n${memoriesContext}`;
	}

	if (conversationSummary) {
		prompt += `\n\n[Conversation Recap]\n${conversationSummary}`;
	}

	const responseLanguage =
		languagePreference === 'en'
			? 'English'
			: languagePreference === 'id'
				? 'Indonesian'
				: detectResponseLanguage(latestUserMessage);
	prompt += `\n\n[Language]
Reply in ${responseLanguage}. Match the user's language for this turn; do not switch to Indonesian because examples, memories, or earlier messages are in Indonesian. If the message genuinely mixes languages, use the language that carries the user's question.`;

	// Contextual Information
	prompt += `\n\n[Contextual Information]\nCurrent timestamp is: ${currentDate}`;

	return prompt;
}
