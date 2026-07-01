import { aiRouter } from '../ai/router';
import type { ChatMessage } from '../ai/types';
import type { ExtractedMemory } from './types';

export function isSensitiveContent(text: string): boolean {
	const lowerText = text.toLowerCase();

	// 1. Passwords, Credentials, API Keys, Secrets, Access/Auth Tokens
	if (
		/api\s*[_-]?\s*key/i.test(lowerText) ||
		/password/i.test(lowerText) ||
		/passwd/i.test(lowerText) ||
		/credential/i.test(lowerText) ||
		/secret/i.test(lowerText) ||
		/token/i.test(lowerText) ||
		/jwt/i.test(lowerText) ||
		/bearer\s+[a-z0-9\-._~+/]+=*/i.test(lowerText)
	) {
		return true;
	}

	// 2. Medical Info (diseases, drugs, doctors, diagnoses, clinical status)
	if (
		/medical/i.test(lowerText) ||
		/medicine/i.test(lowerText) ||
		/diagnos/i.test(lowerText) ||
		/treatment/i.test(lowerText) ||
		/doctor/i.test(lowerText) ||
		/physician/i.test(lowerText) ||
		/patient/i.test(lowerText) ||
		/disease/i.test(lowerText) ||
		/illness/i.test(lowerText) ||
		/symptom/i.test(lowerText) ||
		/diabetes/i.test(lowerText) ||
		/cancer/i.test(lowerText) ||
		/therapy/i.test(lowerText) ||
		/therapist/i.test(lowerText) ||
		/prescription/i.test(lowerText)
	) {
		return true;
	}

	// 3. Coordinates & Locations (latitude, longitude, GPS coordinates)
	if (
		/latitude/i.test(lowerText) ||
		/longitude/i.test(lowerText) ||
		/gps\s+coords/i.test(lowerText) ||
		/gps\s+coordinates/i.test(lowerText) ||
		/\b\d{1,3}\.\d+\s*°\s*[ns]\b/i.test(lowerText) ||
		/\b\d{1,3}\.\d+\s*°\s*[ew]\b/i.test(lowerText) ||
		/coordinate/i.test(lowerText) ||
		/\bcoords?\b/i.test(lowerText)
	) {
		return true;
	}

	// 4. Private keys & Certificates (RSA key headers, SSH keys, PEM keys)
	if (
		/begin\s+.*private\s+key/i.test(lowerText) ||
		/end\s+.*private\s+key/i.test(lowerText) ||
		/ssh-rsa\s+[a-z0-9+/=]+/i.test(lowerText) ||
		/pem\s+private/i.test(lowerText) ||
		/private[_-]?key/i.test(lowerText)
	) {
		return true;
	}

	return false;
}

export function analyzeMemoryExtraction(text: string): {
	shouldStore: boolean;
	extractedContent?: string;
	memoryType?: string;
} {
	const lowerText = text.toLowerCase();

	// 1. Hard Security & Privacy Filters (never extract credentials, precise location, medical status)
	if (isSensitiveContent(text)) {
		return { shouldStore: false };
	}

	// 2. Small Talk / Greetings / Temporary States Filters
	if (
		lowerText.includes('hello') ||
		lowerText.includes('morning') ||
		lowerText.includes('how are you') ||
		lowerText.includes('sandwich') ||
		(lowerText.includes('feel') &&
			!lowerText.includes('every time') &&
			!lowerText.includes('always'))
	) {
		return { shouldStore: false };
	}

	// 3. Explicit remembers
	if (lowerText.includes('remember')) {
		let extractedContent = text;
		const match = text.match(/remember(?:\s+that)?\s+(.+)/i);
		if (match && match[1]) {
			extractedContent = match[1].trim();
		}
		return {
			shouldStore: true,
			extractedContent,
			memoryType: 'core_memory'
		};
	}

	// 4. Stable preferences
	if (
		lowerText.includes('prefer') ||
		lowerText.includes('favorite') ||
		lowerText.includes('likes to')
	) {
		return {
			shouldStore: true,
			memoryType: 'preference'
		};
	}

	// 5. Personal or project goals
	if (
		lowerText.includes('building') ||
		lowerText.includes('goal') ||
		lowerText.includes('project')
	) {
		return {
			shouldStore: true,
			memoryType: 'project_memory'
		};
	}

	// 6. Emotional patterns
	if (
		lowerText.includes('every time') ||
		lowerText.includes('always feel') ||
		lowerText.includes('recurring')
	) {
		return {
			shouldStore: true,
			memoryType: 'emotional_pattern'
		};
	}

	return { shouldStore: false };
}

export async function extractMemories(
	userMessage: string,
	conversationContext: ChatMessage[] = []
): Promise<ExtractedMemory[]> {
	// First use the quick heuristic filter as a pre-check to conserve tokens/calls
	const preCheck = analyzeMemoryExtraction(userMessage);
	if (!preCheck.shouldStore) {
		return [];
	}

	const contextStr = conversationContext
		.map((m) => `${m.role.toUpperCase()}: ${m.content}`)
		.join('\n');

	const systemPrompt = `You are the MOONDAY Memory Engine. Your job is to extract long-term memories from the user's message.
Memory extraction must be highly conservative.

Save memory only when one of these is true:
1. The user explicitly says something should be remembered.
2. The information is likely useful in future conversations.
3. The information is a stable preference (e.g., likes coding guidance, prefers simple explanations).
4. The information is a recurring emotional pattern.
5. The information is a meaningful project or personal goal (e.g., building MOONDAY companion).

Do NOT save:
- Random small talk (e.g., "I'm having pasta today")
- Temporary emotions with no long-term value (e.g., "I'm a bit annoyed right now", unless it's a recurring pattern)
- Highly sensitive details (e.g., passwords, keys, secrets, medical diagnoses, precise private locations)
- Private details about other people unless necessary and harmless

If nothing should be remembered, return an empty array: []

Otherwise, return a JSON array of objects with the following structure:
[
  {
    "type": "core_memory" | "preference" | "emotional_pattern" | "project_memory" | "relationship_context" | "personal_goal" | "recurring_problem" | "reflection",
    "title": "A short descriptive title for the memory",
    "content": "The specific factual information to remember (concise, clear, third-person/first-person, e.g., 'The user is building MOONDAY')",
    "importance": number (1 to 5, where 1 is low importance and 5 is extremely important),
    "confidence": number (0.0 to 1.0)
  }
]

Output ONLY valid JSON. No markdown code blocks, no conversational prefix or suffix.`;

	const userPrompt = `Recent context:
${contextStr}

New user message:
${userMessage}`;

	try {
		const result = await aiRouter.generateChat('memory_extract', {
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt }
			],
			temperature: 0.1
		});

		const cleanedContent = result.content
			.trim()
			.replace(/^```json\s*/i, '')
			.replace(/```$/, '')
			.trim();
		if (!cleanedContent || cleanedContent === '[]') {
			return [];
		}

		const extracted = JSON.parse(cleanedContent) as ExtractedMemory[];
		if (!Array.isArray(extracted)) {
			return [];
		}

		const validTypes = [
			'core_memory',
			'preference',
			'emotional_pattern',
			'project_memory',
			'relationship_context',
			'personal_goal',
			'recurring_problem',
			'reflection'
		];

		return extracted.filter((item) => {
			const isValid =
				item &&
				validTypes.includes(item.type) &&
				typeof item.title === 'string' &&
				typeof item.content === 'string' &&
				item.title.trim().length > 0 &&
				item.content.trim().length > 0;
			if (!isValid) return false;

			// Enforce confidence score threshold >= 0.7 for saving memories
			if (item.confidence < 0.7) {
				console.log(
					`Filtering memory "${item.title}" due to confidence threshold: ${item.confidence}`
				);
				return false;
			}

			// Filter out sensitive data
			if (isSensitiveContent(item.content) || isSensitiveContent(item.title)) {
				console.log(`Filtering memory "${item.title}" due to sensitive content.`);
				return false;
			}

			return true;
		});
	} catch (error) {
		console.error('Failed to extract memories:', error);
		return [];
	}
}
