import { describe, expect, it } from 'vitest';
import { buildCoViewerInstructions } from '$lib/server/prompts/co-viewer';

describe('co-viewer prompt boundaries', () => {
	it('keeps shared content private and out of automatic memory', () => {
		const prompt = buildCoViewerInstructions('read_the_room');
		expect(prompt).toContain('current-conversation response');
		expect(prompt).toContain('do not suggest saving it as memory');
	});

	it('makes playful commentary non-cruel', () => {
		const prompt = buildCoViewerInstructions('playful_commentary');
		expect(prompt).toContain('not a private person');
		expect(prompt).toContain('protected traits');
	});
});
