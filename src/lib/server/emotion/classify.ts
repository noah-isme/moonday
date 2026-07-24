import { aiRouter } from '../ai/router';
import type { EmotionAnalysis } from './types';

export const EMOTIONS = [
	'calm',
	'happy',
	'hopeful',
	'tired',
	'confused',
	'anxious',
	'sad',
	'angry',
	'overwhelmed',
	'lonely',
	'motivated',
	'neutral'
] as const;

export type EmotionLabel = (typeof EMOTIONS)[number];

export function parseEmotionResponse(content: string): EmotionAnalysis {
	try {
		const jsonMatch = content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error('No JSON object found in content');
		}
		const jsonStr = jsonMatch[0];
		const analysis = JSON.parse(jsonStr) as EmotionAnalysis;

		// Validate values
		if (!EMOTIONS.includes(analysis.primaryEmotion)) {
			analysis.primaryEmotion = 'neutral';
		}
		if (analysis.secondaryEmotion && !EMOTIONS.includes(analysis.secondaryEmotion)) {
			analysis.secondaryEmotion = undefined;
		}
		if (typeof analysis.moodScore !== 'number' || isNaN(analysis.moodScore)) {
			analysis.moodScore = 0;
		} else {
			// Clamp moodScore to [-5, 5]
			analysis.moodScore = Math.max(-5, Math.min(5, analysis.moodScore));
		}
		if (analysis.confidence === undefined || isNaN(analysis.confidence)) {
			analysis.confidence = 0.5;
		}

		return analysis;
	} catch (error) {
		console.error('Failed to parse emotion response:', error);
		return {
			primaryEmotion: 'neutral',
			moodScore: 0,
			confidence: 0.5,
			shouldStoreMemory: false
		};
	}
}

export function classifyEmotionHeuristic(text: string): EmotionAnalysis {
	const lowerText = text.toLowerCase();

	if (lowerText.includes('happy')) {
		return {
			primaryEmotion: 'happy',
			moodScore: 3,
			confidence: 0.8,
			shouldStoreMemory: false
		};
	}

	if (lowerText.includes('anxious') || lowerText.includes('worried')) {
		return {
			primaryEmotion: 'anxious',
			moodScore: -2,
			confidence: 0.8,
			shouldStoreMemory: false
		};
	}

	if (lowerText.includes('overwhelmed')) {
		return {
			primaryEmotion: 'overwhelmed',
			moodScore: -3,
			confidence: 0.9,
			shouldStoreMemory: true,
			suggestedMemoryType: 'recurring_problem'
		};
	}

	return {
		primaryEmotion: 'neutral',
		moodScore: 0,
		confidence: 0.5,
		shouldStoreMemory: false
	};
}

export async function classifyEmotion(message: string): Promise<EmotionAnalysis> {
	const systemPrompt = `You are the MOONDAY Emotion Engine.
Analyze the user's input message and return a JSON object with the following structure:
{
  "primaryEmotion": "calm" | "happy" | "hopeful" | "tired" | "confused" | "anxious" | "sad" | "angry" | "overwhelmed" | "lonely" | "motivated" | "neutral",
  "secondaryEmotion": "calm" | "happy" | "hopeful" | "tired" | "confused" | "anxious" | "sad" | "angry" | "overwhelmed" | "lonely" | "motivated" | "neutral" | null,
  "moodScore": number (between -5 and 5, where -5 is very negative, 0 is neutral, 5 is very positive),
  "energyLevel": number (between 1 and 5, optional/nullable),
  "stressLevel": number (between 1 and 5, optional/nullable),
  "confidence": number (between 0.0 and 1.0),
  "shouldStoreMemory": boolean (true if the message contains important facts, personal preferences, goals, patterns, or instructions that should be remembered for future conversations; false otherwise),
  "suggestedMemoryType": "core_memory" | "preference" | "emotional_pattern" | "project_memory" | "relationship_context" | "personal_goal" | "recurring_problem" | "reflection" | null
}

Guidelines:
- Choose from the 12 emotional labels provided: calm, happy, hopeful, tired, confused, anxious, sad, angry, overwhelmed, lonely, motivated, neutral.
- Choose shouldStoreMemory: true only if the user is sharing persistent or core facts (preferences, goals, plans, important memories), NOT for general small talk or temporary state.
- Output ONLY the JSON block. Do not write any conversational text or formatting outside the JSON block.`;

	try {
		const result = await aiRouter.generateChat('emotional_reason', {
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: message }
			],
			temperature: 0.1
		});

		return parseEmotionResponse(result.content);
	} catch (error) {
		console.error('Failed to classify emotion, falling back to heuristic:', error);
		return classifyEmotionHeuristic(message);
	}
}
