import { describe, it, expect } from 'vitest';
import { TraitSchema, compileTraitsToDirectives } from '../lib/server/prompts';
import { ZodError } from 'zod';

describe('Prompt Traits Compiler', () => {
	describe('TraitSchema Validation', () => {
		it('should validate correct traits and populate defaults', () => {
			const validTraits = {
				warmth: 8,
				honesty: 7,
				formality: 6,
				sarcasm: 5,
				humor: 5,
				moralDirectness: 5
			};

			const parsed = TraitSchema.parse(validTraits);
			expect(parsed).toEqual(validTraits);
		});

		it('should fill defaults for missing values', () => {
			const partialTraits = {};
			const parsed = TraitSchema.parse(partialTraits);
			expect(parsed).toEqual({
				warmth: 5,
				honesty: 5,
				formality: 5,
				sarcasm: 5,
				humor: 5,
				moralDirectness: 5
			});
		});

		it('should reject values out of range (too low)', () => {
			expect(() => {
				TraitSchema.parse({ warmth: 0 });
			}).toThrow(ZodError);
		});

		it('should reject values out of range (too high)', () => {
			expect(() => {
				TraitSchema.parse({ honesty: 11 });
			}).toThrow(ZodError);
		});
	});

	describe('compileTraitsToDirectives', () => {
		it('should produce directives for high warmth and honesty', () => {
			const traits = {
				warmth: 9,
				honesty: 9,
				formality: 5,
				sarcasm: 5,
				humor: 5,
				moralDirectness: 5
			};

			const directives = compileTraitsToDirectives(traits);
			expect(directives).toContain('You express deep empathy and support.');
			expect(directives).toContain('You are brutally honest and candid.');
			// Others shouldn't trigger high/low directives
			expect(directives).not.toContain('You speak formally and professionally.');
			expect(directives).not.toContain('You speak casually and informally.');
		});

		it('should produce directives for low warmth and honesty', () => {
			const traits = {
				warmth: 3,
				honesty: 3,
				formality: 5,
				sarcasm: 5,
				humor: 5,
				moralDirectness: 5
			};

			const directives = compileTraitsToDirectives(traits);
			expect(directives).toContain('You are emotionally detached and neutral.');
			expect(directives).toContain('You prioritize tact and gentleness over harsh honesty.');
		});

		it('should produce directives for high/low formality, sarcasm, and moralDirectness', () => {
			const traitsHigh = {
				warmth: 5,
				honesty: 5,
				formality: 8,
				sarcasm: 8,
				humor: 8,
				moralDirectness: 8
			};

			const directivesHigh = compileTraitsToDirectives(traitsHigh);
			expect(directivesHigh).toContain('You speak formally and professionally.');
			expect(directivesHigh).toContain('You use dry humor and friendly sarcasm.');
			expect(directivesHigh).toContain(
				'You display high humor, keeping the conversation lighthearted and witty.'
			);
			expect(directivesHigh).toContain('You offer direct moral and growth guidance.');

			const traitsLow = {
				warmth: 5,
				honesty: 5,
				formality: 3,
				sarcasm: 2,
				humor: 2,
				moralDirectness: 3
			};

			const directivesLow = compileTraitsToDirectives(traitsLow);
			expect(directivesLow).toContain('You speak casually and informally.');
			expect(directivesLow).toContain('You are straightforward and never sarcastic.');
			expect(directivesLow).toContain(
				'You maintain a serious and focused tone, using humor very sparingly.'
			);
			// moralDirectness < 4 has no specific low directive in the prompt instructions, but let's confirm it doesn't contain the high one
			expect(directivesLow).not.toContain('You offer direct moral and growth guidance.');
		});

		it('should produce empty/default directives when all traits are exactly neutral (5)', () => {
			const traits = {
				warmth: 5,
				honesty: 5,
				formality: 5,
				sarcasm: 5,
				humor: 5,
				moralDirectness: 5
			};

			const directives = compileTraitsToDirectives(traits);
			expect(directives).toBe('');
		});
	});
});
