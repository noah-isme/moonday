import { describe, expect, it } from 'vitest';
import { conversationPreview, formatConversationDate } from '$lib/conversationPresentation';
import type { ChatMessage, Conversation } from '$lib/stores/chat.svelte';

const conversation: Conversation = {
	id: 'conversation-1',
	title: 'A thoughtful title',
	activeCharacterId: 'friendly',
	createdAt: '2026-07-23T08:00:00.000Z',
	updatedAt: '2026-07-23T09:30:00.000Z'
};

describe('conversation presentation', () => {
	it('uses the latest non-system message and normalizes its whitespace', () => {
		const messages: ChatMessage[] = [
			{
				id: 'system',
				role: 'system',
				content: 'Internal status',
				createdAt: conversation.createdAt
			},
			{
				id: 'user',
				role: 'user',
				content: 'I have   several\nopen thoughts.',
				createdAt: conversation.updatedAt
			}
		];

		expect(conversationPreview(conversation, messages)).toBe('I have several open thoughts.');
	});

	it('falls back to the summary and then to a gentle empty state', () => {
		expect(conversationPreview({ ...conversation, summary: 'A concise summary.' }, [])).toBe(
			'A concise summary.'
		);
		expect(conversationPreview(conversation, [])).toBe('A quiet space to begin.');
	});

	it('formats same-day updates as time and older updates as a short date', () => {
		const now = new Date('2026-07-23T12:00:00.000Z');
		expect(formatConversationDate('2026-07-23T09:30:00.000Z', now)).toMatch(/\d/);
		expect(formatConversationDate('2026-07-20T09:30:00.000Z', now)).toMatch(/Jul|20/);
		expect(formatConversationDate('not-a-date', now)).toBe('');
	});
});
