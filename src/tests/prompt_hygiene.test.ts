import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, detectResponseLanguage } from '../lib/server/prompts';

describe('Prompt Hygiene & Tone Enforcement Check', () => {
	it('should include strict guardrails against fillers and sugarcoating in base system prompt', () => {
		const prompt = buildSystemPrompt();
		expect(prompt).toContain('🛑 PROMPT HYGIENE & TONE ENFORCEMENT:');
		expect(prompt).toContain('NO CONVERSATIONAL FILLERS');
		expect(prompt).toContain('TONE CONSISTENCY');
		expect(prompt).toContain('NO SUGARCOATING');
	});

	it('uses the latest user message to keep English and Indonesian replies aligned', () => {
		expect(detectResponseLanguage('I feel overwhelmed by my project today.')).toBe('English');
		expect(detectResponseLanguage('Aku merasa kewalahan dengan proyekku hari ini.')).toBe(
			'Indonesian'
		);
		expect(buildSystemPrompt(undefined, '', undefined, '', 'Can we talk in English?')).toContain(
			'Reply in English.'
		);
	});
});
