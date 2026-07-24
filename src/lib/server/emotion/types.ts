import type { EmotionLabel } from './classify';

export type EmotionAnalysis = {
	primaryEmotion: EmotionLabel;
	secondaryEmotion?: EmotionLabel;
	moodScore: number;
	energyLevel?: number;
	stressLevel?: number;
	confidence: number;
	shouldStoreMemory: boolean;
	suggestedMemoryType?: string;
};
