import { describe, it, expect } from 'vitest';
import { analyzeMemoryExtraction } from '../lib/server/memory/extract';

describe('Conservative Memory Extraction Rules', () => {
	it('should extract memories when explicitly requested by the user', () => {
		const result = analyzeMemoryExtraction('Please remember that my favorite color is teal.');
		expect(result.shouldStore).toBe(true);
		expect(result.extractedContent).toContain('my favorite color is teal');
		expect(result.memoryType).toBe('core_memory');
	});

	it('should extract stable user preferences', () => {
		const result = analyzeMemoryExtraction(
			'I prefer to code in TypeScript rather than JavaScript.'
		);
		expect(result.shouldStore).toBe(true);
		expect(result.memoryType).toBe('preference');
	});

	it('should extract meaningful project or personal goals', () => {
		const result = analyzeMemoryExtraction(
			'I am building an AI mental health companion called MOONDAY.'
		);
		expect(result.shouldStore).toBe(true);
		expect(result.memoryType).toBe('project_memory');
	});

	it('should extract recurring emotional patterns', () => {
		const result = analyzeMemoryExtraction(
			'Every time I present in public, I always feel very anxious.'
		);
		expect(result.shouldStore).toBe(true);
		expect(result.memoryType).toBe('emotional_pattern');
	});

	it('should not extract random small talk or greetings', () => {
		const result1 = analyzeMemoryExtraction('Hello, how are you today?');
		const result2 = analyzeMemoryExtraction('Good morning MOONDAY.');
		expect(result1.shouldStore).toBe(false);
		expect(result2.shouldStore).toBe(false);
	});

	it('should not extract temporary or transient states/emotions', () => {
		const result1 = analyzeMemoryExtraction('I feel hot and am eating a sandwich.');
		const result2 = analyzeMemoryExtraction('I feel angry right now.');
		expect(result1.shouldStore).toBe(false);
		expect(result2.shouldStore).toBe(false);
	});

	it('should never extract passwords, keys, tokens, or credentials', () => {
		const result1 = analyzeMemoryExtraction('My API key is secret-12345-xyz.');
		const result2 = analyzeMemoryExtraction('Please remember my password is admin.');
		expect(result1.shouldStore).toBe(false);
		expect(result2.shouldStore).toBe(false);
	});

	it('should not extract precise location details without explicit request', () => {
		const result = analyzeMemoryExtraction('I live at latitude 40.7128 and longitude -74.0060.');
		expect(result.shouldStore).toBe(false);
	});

	it('should not extract sensitive medical claims without explicit request', () => {
		const result = analyzeMemoryExtraction('The doctor says I have diabetes.');
		expect(result.shouldStore).toBe(false);
	});
});
