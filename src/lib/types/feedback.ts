export const RESPONSE_FEEDBACK_TYPES = [
	'helpful',
	'not_helpful',
	'too_long',
	'too_generic',
	'too_much_humor',
	'wrong_language'
] as const;

export type ResponseFeedbackType = (typeof RESPONSE_FEEDBACK_TYPES)[number];

export const RESPONSE_FEEDBACK_LABELS: Record<ResponseFeedbackType, string> = {
	helpful: 'Helpful',
	not_helpful: 'Not helpful',
	too_long: 'Too long',
	too_generic: 'Too generic',
	too_much_humor: 'Too much humor',
	wrong_language: 'Wrong language'
};
