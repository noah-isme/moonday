import { describe, expect, it } from 'vitest';
import { RESPONSE_FEEDBACK_LABELS, RESPONSE_FEEDBACK_TYPES } from '$lib/types/feedback';

describe('response feedback categories', () => {
	it('includes the complete private quality-feedback set', () => {
		expect(RESPONSE_FEEDBACK_TYPES).toEqual([
			'helpful',
			'not_helpful',
			'too_long',
			'too_generic',
			'too_much_humor',
			'wrong_language'
		]);
		expect(RESPONSE_FEEDBACK_LABELS.wrong_language).toBe('Wrong language');
	});
});
