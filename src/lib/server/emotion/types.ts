export type EmotionAnalysis = {
	primaryEmotion: string;
	secondaryEmotion?: string;
	moodScore: number;
	energyLevel?: number;
	stressLevel?: number;
	confidence: number;
	shouldStoreMemory: boolean;
	suggestedMemoryType?: string;
};
