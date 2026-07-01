import { describe, it, expect } from 'vitest';
import { parseEmotionResponse, classifyEmotionHeuristic } from '../lib/server/emotion/classify';

describe('Emotion Parser & Classifier', () => {
	describe('parseEmotionResponse', () => {
		it('should parse clean JSON correctly', () => {
			const jsonStr = `{"primaryEmotion":"calm","moodScore":3,"confidence":0.9,"shouldStoreMemory":false}`;
			const result = parseEmotionResponse(jsonStr);
			expect(result.primaryEmotion).toBe('calm');
			expect(result.moodScore).toBe(3);
			expect(result.confidence).toBe(0.9);
			expect(result.shouldStoreMemory).toBe(false);
		});

		it('should parse markdown JSON code blocks correctly', () => {
			const mdStr = `
Some text before the block.
\`\`\`json
{
  "primaryEmotion": "anxious",
  "moodScore": -2,
  "confidence": 0.85,
  "shouldStoreMemory": true,
  "suggestedMemoryType": "recurring_problem"
}
\`\`\`
Some text after the block.
			`;
			const result = parseEmotionResponse(mdStr);
			expect(result.primaryEmotion).toBe('anxious');
			expect(result.moodScore).toBe(-2);
			expect(result.confidence).toBe(0.85);
			expect(result.shouldStoreMemory).toBe(true);
			expect(result.suggestedMemoryType).toBe('recurring_problem');
		});

		it('should normalize invalid emotion labels to neutral', () => {
			const jsonStr = `{"primaryEmotion":"extremely_ecstatic","moodScore":5,"confidence":0.9,"shouldStoreMemory":false}`;
			const result = parseEmotionResponse(jsonStr);
			expect(result.primaryEmotion).toBe('neutral');
		});

		it('should clamp mood scores to range [-5, 5]', () => {
			const jsonStr1 = `{"primaryEmotion":"happy","moodScore":10,"confidence":0.9,"shouldStoreMemory":false}`;
			const jsonStr2 = `{"primaryEmotion":"sad","moodScore":-12,"confidence":0.9,"shouldStoreMemory":false}`;

			const result1 = parseEmotionResponse(jsonStr1);
			const result2 = parseEmotionResponse(jsonStr2);

			expect(result1.moodScore).toBe(5);
			expect(result2.moodScore).toBe(-5);
		});

		it('should handle broken or invalid JSON gracefully with a fallback', () => {
			const brokenStr = `{broken json: "true"`;
			const result = parseEmotionResponse(brokenStr);
			expect(result.primaryEmotion).toBe('neutral');
			expect(result.moodScore).toBe(0);
		});
	});

	describe('classifyEmotionHeuristic', () => {
		it('should classify happy keyword', () => {
			const result = classifyEmotionHeuristic('I had an awesome day, I am so happy!');
			expect(result.primaryEmotion).toBe('happy');
			expect(result.moodScore).toBeGreaterThan(0);
		});

		it('should classify anxious keyword', () => {
			const result = classifyEmotionHeuristic(
				'I am extremely worried about the upcoming presentation.'
			);
			expect(result.primaryEmotion).toBe('anxious');
			expect(result.moodScore).toBeLessThan(0);
		});

		it('should classify overwhelmed keyword and flag for memory storage', () => {
			const result = classifyEmotionHeuristic('I have too much to do, I am so overwhelmed.');
			expect(result.primaryEmotion).toBe('overwhelmed');
			expect(result.shouldStoreMemory).toBe(true);
			expect(result.suggestedMemoryType).toBe('recurring_problem');
		});

		it('should default to neutral for normal statements', () => {
			const result = classifyEmotionHeuristic('I walked to the grocery store today.');
			expect(result.primaryEmotion).toBe('neutral');
			expect(result.moodScore).toBe(0);
		});
	});
});
