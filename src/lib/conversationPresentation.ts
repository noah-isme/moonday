import type { ChatMessage, Conversation } from '$lib/stores/chat.svelte';

export function conversationPreview(
	conversation: Conversation,
	messages: ChatMessage[] | undefined
) {
	const latest = [...(messages || [])]
		.reverse()
		.find((message) => message.role !== 'system' && message.content.trim());
	return (
		latest?.content.trim().replace(/\s+/g, ' ') || conversation.summary || 'A quiet space to begin.'
	);
}

export function formatConversationDate(value: string, now = new Date()) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	if (date.toDateString() === now.toDateString()) {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
	return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
