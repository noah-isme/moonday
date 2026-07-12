import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../lib/server/prompts';

describe('Prompt Hygiene & Tone Enforcement Check', () => {
	it('should include strict guardrails against fillers and sugarcoating in base system prompt', () => {
		const prompt = buildSystemPrompt();
		expect(prompt).toContain('🛑 PROMPT HYGIENE & TONE ENFORCEMENT:');
		expect(prompt).toContain('NO CONVERSATIONAL FILLERS');
		expect(prompt).toContain('TONE CONSISTENCY');
		expect(prompt).toContain('NO SUGARCOATING');
	});
});
