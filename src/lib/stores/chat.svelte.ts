import { browser } from '$app/environment';
import { characterStore } from './character.svelte';
import { settingsStore } from './settings.svelte';
import { uiStore } from '$lib/stores/ui.svelte';

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	emotionLabel?: string;
	moodScore?: number;
	createdAt: string;
}

export interface Conversation {
	id: string;
	title: string;
	activeCharacterId: string;
	summary?: string;
	lastEmotionLabel?: string;
	lastMoodScore?: number;
	createdAt: string;
	updatedAt: string;
}

const MOCK_REPLIES = [
	"I hear you. It sounds like you're carrying a lot on your shoulders today. What's the smallest step you could take to feel a bit more in control?",
	"That's really interesting. It seems like there's a pattern of feeling motivated early on, but then getting overwhelmed. Let's look at why that happens.",
	"I'm here to listen. Sometimes, naming the feeling is the hardest part. Would you say it's more like tiredness, or is there some frustration mixed in?",
	"The moon reflects your light, and I reflect your thoughts. Let's break down that project so it doesn't feel like a mountain.",
	'It is okay to not have it all figured out. Today is just one page of a larger book. Tell me more about what went well, even if it was tiny.'
];

export class ChatStore {
	conversations = $state<Conversation[]>([]);
	activeId = $state<string | null>(null);
	messages = $state<Record<string, ChatMessage[]>>({}); // Indexed by conversation ID
	isThinking = $state<boolean>(false);
	isStreaming = $state<boolean>(false);
	error = $state<string | null>(null);

	activeConversation = $derived.by(() => {
		return this.conversations.find((c) => c.id === this.activeId) || null;
	});

	activeMessages = $derived.by(() => {
		if (!this.activeId) return [];
		return this.messages[this.activeId] || [];
	});

	constructor() {
		if (browser) {
			const savedConvs = localStorage.getItem('moonday_conversations');
			const savedMsgs = localStorage.getItem('moonday_messages');

			if (savedConvs) {
				try {
					this.conversations = JSON.parse(savedConvs);
				} catch (e) {
					console.error('Failed to parse conversations:', e);
				}
			}

			if (savedMsgs) {
				try {
					this.messages = JSON.parse(savedMsgs);
				} catch (e) {
					console.error('Failed to parse messages:', e);
				}
			}

			// If there are no conversations, create a default one
			if (this.conversations.length === 0) {
				this.createNewConversation();
			} else {
				this.activeId = this.conversations[0].id;
			}
		}
	}

	saveToLocalStorage() {
		if (browser) {
			localStorage.setItem('moonday_conversations', JSON.stringify(this.conversations));
			localStorage.setItem('moonday_messages', JSON.stringify(this.messages));
		}
	}

	createNewConversation() {
		const newId = crypto.randomUUID();
		const newConv: Conversation = {
			id: newId,
			title: `Reflections with ${characterStore.activeCharacter.name}`,
			activeCharacterId: characterStore.activeId,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		this.conversations = [newConv, ...this.conversations];
		this.messages[newId] = [
			{
				id: crypto.randomUUID(),
				role: 'system',
				content: `You are chatting with ${characterStore.activeCharacter.name}.`,
				createdAt: new Date().toISOString()
			},
			{
				id: crypto.randomUUID(),
				role: 'assistant',
				content: `Hello! I'm here as ${characterStore.activeCharacter.name}. How are you feeling today? Let's navigate your thoughts together.`,
				createdAt: new Date().toISOString()
			}
		];
		this.activeId = newId;
		this.saveToLocalStorage();
		return newConv;
	}

	selectConversation(id: string) {
		if (this.conversations.some((c) => c.id === id)) {
			this.activeId = id;
			// Sync character to match conversation context if possible
			const conv = this.conversations.find((c) => c.id === id);
			if (conv) {
				characterStore.selectCharacter(conv.activeCharacterId);
			}
		}
	}

	deleteConversation(id: string) {
		this.conversations = this.conversations.filter((c) => c.id !== id);
		delete this.messages[id];
		this.saveToLocalStorage();

		if (this.activeId === id) {
			if (this.conversations.length > 0) {
				this.activeId = this.conversations[0].id;
			} else {
				this.createNewConversation();
			}
		}
	}

	updateConversationTitle(id: string, newTitle: string) {
		const conv = this.conversations.find((c) => c.id === id);
		if (conv) {
			conv.title = newTitle;
			conv.updatedAt = new Date().toISOString();
			this.saveToLocalStorage();
		}
	}

	async sendMessage(content: string) {
		if (!content.trim() || !this.activeId) return;

		// 1. Add User Message
		const userMsg: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'user',
			content,
			createdAt: new Date().toISOString()
		};

		this.messages[this.activeId] = [...(this.messages[this.activeId] || []), userMsg];
		this.isThinking = true;
		this.error = null;
		this.saveToLocalStorage();

		// Change avatar to listening, then thinking
		characterStore.activeCharacter.avatarState = 'thinking';
		uiStore.setMoonState('thinking');

		const assistantMsgId = crypto.randomUUID();
		let startedStreaming = false;

		try {
			// Call api route /api/chat
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					conversationId: this.activeId,
					message: content,
					characterId: characterStore.activeId,
					provider: settingsStore.provider,
					stream: true
				})
			});

			if (!response.ok) {
				throw new Error('API server returned error');
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error('Response body is not readable');
			}

			this.isStreaming = true;
			this.isThinking = false;
			startedStreaming = true;

			// Add assistant message shell
			const assistantMsg: ChatMessage = {
				id: assistantMsgId,
				role: 'assistant',
				content: '',
				createdAt: new Date().toISOString()
			};
			this.messages[this.activeId] = [...(this.messages[this.activeId] || []), assistantMsg];

			const updateMessage = (updates: Partial<ChatMessage>) => {
				const currentMsgs = this.messages[this.activeId!] || [];
				const idx = currentMsgs.findIndex((m) => m.id === assistantMsgId);
				if (idx !== -1) {
					currentMsgs[idx] = {
						...currentMsgs[idx],
						...updates
					};
					this.messages[this.activeId!] = [...currentMsgs];
				}
			};

			const decoder = new TextDecoder();
			let buffer = '';

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						uiStore.setMoonState('idle');
						break;
					}

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() || '';

					for (const line of lines) {
						const trimmed = line.trim();
						if (!trimmed) continue;

						if (trimmed.startsWith('data: ')) {
							const jsonStr = trimmed.slice(6);
							try {
								const data = JSON.parse(jsonStr);
								if (data.type === 'start') {
									let emotionLabel = 'neutral';
									let moodScore = 0;
									if (data.emotion) {
										emotionLabel = data.emotion.primaryEmotion || 'neutral';
										moodScore = data.emotion.moodScore ?? 0;
										this.updateAvatarFromEmotion(data.emotion.primaryEmotion);
									}
									updateMessage({ emotionLabel, moodScore });
									characterStore.activeCharacter.avatarState = 'speaking';
									uiStore.setMoonState('speaking');
								} else if (data.type === 'token') {
									const currentMsgs = this.messages[this.activeId!] || [];
									const msg = currentMsgs.find((m) => m.id === assistantMsgId);
									const currentContent = msg ? msg.content : '';
									updateMessage({ content: currentContent + data.content });
									uiStore.setMoonState('speaking');
								} else if (data.type === 'done') {
									const currentMsgs = this.messages[this.activeId!] || [];
									const msg = currentMsgs.find((m) => m.id === assistantMsgId);
									const finalEmotionLabel = msg?.emotionLabel;
									const finalMoodScore = msg?.moodScore;

									const conv = this.conversations.find((c) => c.id === this.activeId);
									if (conv) {
										conv.lastEmotionLabel = finalEmotionLabel;
										conv.lastMoodScore = finalMoodScore;
										conv.updatedAt = new Date().toISOString();
									}
									uiStore.setMoonState('idle');
								} else if (data.type === 'error') {
									throw new Error(data.error?.message || 'Error in stream');
								}
							} catch (e) {
								console.error('Error parsing SSE line:', e);
							}
						}
					}
				}

				if (buffer && buffer.startsWith('data: ')) {
					const jsonStr = buffer.slice(6);
					try {
						const data = JSON.parse(jsonStr);
						if (data.type === 'token') {
							const currentMsgs = this.messages[this.activeId!] || [];
							const msg = currentMsgs.find((m) => m.id === assistantMsgId);
							const currentContent = msg ? msg.content : '';
							updateMessage({ content: currentContent + data.content });
						}
					} catch (e) {
						// Ignore
					}
				}
			} finally {
				reader.releaseLock();
				this.isStreaming = false;
			}
		} catch (err) {
			uiStore.setMoonState('idle');
			console.warn('API error, falling back to local simulation:', err);

			if (startedStreaming) {
				this.error = err instanceof Error ? err.message : 'Streaming interrupted.';
				return;
			}

			// Fallback: Simulation of response
			await new Promise((resolve) => setTimeout(resolve, 1500));

			characterStore.activeCharacter.avatarState = 'speaking';
			uiStore.setMoonState('speaking');

			const randomReply = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
			const mockEmotion = this.analyzeMockEmotion(content);

			const assistantMsg: ChatMessage = {
				id: assistantMsgId,
				role: 'assistant',
				content: randomReply,
				emotionLabel: mockEmotion.label,
				moodScore: mockEmotion.score,
				createdAt: new Date().toISOString()
			};

			this.messages[this.activeId] = [...(this.messages[this.activeId] || []), assistantMsg];

			const conv = this.conversations.find((c) => c.id === this.activeId);
			if (conv) {
				conv.lastEmotionLabel = mockEmotion.label;
				conv.lastMoodScore = mockEmotion.score;
				conv.updatedAt = new Date().toISOString();
			}

			this.updateAvatarFromEmotion(mockEmotion.label);
			uiStore.setMoonState('idle');
		} finally {
			this.isThinking = false;
			this.saveToLocalStorage();
		}
	}

	async rerollLastMessage() {
		if (!this.activeId) return;

		const currentMsgs = this.messages[this.activeId] || [];
		if (currentMsgs.length === 0) return;

		// Find the last assistant message in the current conversation.
		let assistantMsgIdx = -1;
		for (let i = currentMsgs.length - 1; i >= 0; i--) {
			if (currentMsgs[i].role === 'assistant') {
				assistantMsgIdx = i;
				break;
			}
		}

		if (assistantMsgIdx === -1) return;
		const assistantMsg = currentMsgs[assistantMsgIdx];

		// Find the user message before that assistant message.
		let userMsg: ChatMessage | null = null;
		for (let i = assistantMsgIdx - 1; i >= 0; i--) {
			if (currentMsgs[i].role === 'user') {
				userMsg = currentMsgs[i];
				break;
			}
		}

		if (!userMsg) return;

		this.isThinking = true;
		this.error = null;

		// Change avatar to listening, then thinking
		characterStore.activeCharacter.avatarState = 'thinking';
		uiStore.setMoonState('thinking');

		let startedStreaming = false;

		try {
			// Call api route /api/chat
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					conversationId: this.activeId,
					message: userMsg.content,
					characterId: characterStore.activeId,
					provider: settingsStore.provider,
					stream: true,
					reroll: true
				})
			});

			if (!response.ok) {
				throw new Error('API server returned error');
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error('Response body is not readable');
			}

			this.isStreaming = true;
			this.isThinking = false;
			startedStreaming = true;

			// Reset the content of the assistant message
			const assistantMsgId = assistantMsg.id;

			const updateMessage = (updates: Partial<ChatMessage>) => {
				const msgs = this.messages[this.activeId!] || [];
				const idx = msgs.findIndex((m) => m.id === assistantMsgId);
				if (idx !== -1) {
					msgs[idx] = {
						...msgs[idx],
						...updates
					};
					this.messages[this.activeId!] = [...msgs];
				}
			};

			updateMessage({ content: '', emotionLabel: undefined, moodScore: undefined });

			const decoder = new TextDecoder();
			let buffer = '';

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						uiStore.setMoonState('idle');
						break;
					}

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() || '';

					for (const line of lines) {
						const trimmed = line.trim();
						if (!trimmed) continue;

						if (trimmed.startsWith('data: ')) {
							const jsonStr = trimmed.slice(6);
							try {
								const data = JSON.parse(jsonStr);
								if (data.type === 'start') {
									let emotionLabel = 'neutral';
									let moodScore = 0;
									if (data.emotion) {
										emotionLabel = data.emotion.primaryEmotion || 'neutral';
										moodScore = data.emotion.moodScore ?? 0;
										this.updateAvatarFromEmotion(data.emotion.primaryEmotion);
									}
									updateMessage({ emotionLabel, moodScore });
									characterStore.activeCharacter.avatarState = 'speaking';
									uiStore.setMoonState('speaking');
								} else if (data.type === 'token') {
									const msgs = this.messages[this.activeId!] || [];
									const msg = msgs.find((m) => m.id === assistantMsgId);
									const currentContent = msg ? msg.content : '';
									updateMessage({ content: currentContent + data.content });
									uiStore.setMoonState('speaking');
								} else if (data.type === 'done') {
									const msgs = this.messages[this.activeId!] || [];
									const msg = msgs.find((m) => m.id === assistantMsgId);
									const finalEmotionLabel = msg?.emotionLabel;
									const finalMoodScore = msg?.moodScore;

									const conv = this.conversations.find((c) => c.id === this.activeId);
									if (conv) {
										conv.lastEmotionLabel = finalEmotionLabel;
										conv.lastMoodScore = finalMoodScore;
										conv.updatedAt = new Date().toISOString();
									}
									uiStore.setMoonState('idle');
								} else if (data.type === 'error') {
									throw new Error(data.error?.message || 'Error in stream');
								}
							} catch (e) {
								console.error('Error parsing SSE line:', e);
							}
						}
					}
				}

				if (buffer && buffer.startsWith('data: ')) {
					const jsonStr = buffer.slice(6);
					try {
						const data = JSON.parse(jsonStr);
						if (data.type === 'token') {
							const msgs = this.messages[this.activeId!] || [];
							const msg = msgs.find((m) => m.id === assistantMsgId);
							const currentContent = msg ? msg.content : '';
							updateMessage({ content: currentContent + data.content });
						}
					} catch (e) {
						// Ignore
					}
				}
			} finally {
				reader.releaseLock();
				this.isStreaming = false;
			}
		} catch (err) {
			uiStore.setMoonState('idle');
			console.error('Reroll API error:', err);
			this.error = err instanceof Error ? err.message : 'Streaming interrupted.';
		} finally {
			this.isThinking = false;
			this.saveToLocalStorage();
		}
	}


	updateAvatarFromEmotion(emotion: string | undefined) {
		if (!emotion) {
			characterStore.activeCharacter.avatarState = 'idle';
			return;
		}

		const map: Record<string, 'happy' | 'concerned' | 'sleepy' | 'idle'> = {
			happy: 'happy',
			motivated: 'happy',
			hopeful: 'happy',
			calm: 'idle',
			neutral: 'idle',
			tired: 'sleepy',
			confused: 'concerned',
			anxious: 'concerned',
			sad: 'concerned',
			angry: 'concerned',
			overwhelmed: 'concerned',
			lonely: 'concerned'
		};

		characterStore.activeCharacter.avatarState = map[emotion] || 'idle';

		// Reset to idle after some time if speaking
		setTimeout(() => {
			if (characterStore.activeCharacter.avatarState === 'speaking') {
				characterStore.activeCharacter.avatarState = 'idle';
			}
		}, 3000);
	}

	analyzeMockEmotion(text: string): { label: string; score: number } {
		const lower = text.toLowerCase();
		if (lower.includes('sad') || lower.includes('cry') || lower.includes('hurt')) {
			return { label: 'sad', score: -4 };
		}
		if (lower.includes('stress') || lower.includes('overwhelm') || lower.includes('busy')) {
			return { label: 'overwhelmed', score: -5 };
		}
		if (lower.includes('tired') || lower.includes('sleepy') || lower.includes('exhausted')) {
			return { label: 'tired', score: -1 };
		}
		if (lower.includes('happy') || lower.includes('great') || lower.includes('glad')) {
			return { label: 'happy', score: 4 };
		}
		if (lower.includes('anxious') || lower.includes('worry') || lower.includes('nervous')) {
			return { label: 'anxious', score: -3 };
		}
		if (lower.includes('angry') || lower.includes('mad') || lower.includes('hate')) {
			return { label: 'angry', score: -4 };
		}
		return { label: 'neutral', score: 0 };
	}
}

export const chatStore = new ChatStore();
