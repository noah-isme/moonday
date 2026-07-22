import { browser } from '$app/environment';
import { characterStore } from './character.svelte';
import { settingsStore } from './settings.svelte';
import { uiStore } from '$lib/stores/ui.svelte';

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	/** True once this message has a durable database ID. */
	persisted?: boolean;
	emotionLabel?: string;
	moodScore?: number;
	status?: string;
	createdAt: string;
}

export interface Conversation {
	id: string;
	title: string;
	activeCharacterId: string;
	/** UI-facing tone; the persisted character ID is a database UUID. */
	characterTone?: string;
	summary?: string;
	lastEmotionLabel?: string;
	lastMoodScore?: number;
	createdAt: string;
	updatedAt: string;
}

export interface UsedMemoryContext {
	id: string;
	title: string;
	type: string;
}

export class ChatStore {
	conversations = $state<Conversation[]>([]);
	activeId = $state<string | null>(null);
	messages = $state<Record<string, ChatMessage[]>>({}); // Indexed by conversation ID
	isThinking = $state<boolean>(false);
	isStreaming = $state<boolean>(false);
	isRerolling = $state<boolean>(false);
	isWebSearchEnabled = $state<boolean>(false);
	error = $state<string | null>(null);
	usedMemories = $state<UsedMemoryContext[]>([]);
	lastSentMessage = $state<string | null>(null);
	isLoading = $state<boolean>(false);
	private isCreatingConversation = false;

	toggleWebSearch() {
		this.isWebSearchEnabled = !this.isWebSearchEnabled;
	}

	dismissUsedMemory(id: string) {
		this.usedMemories = this.usedMemories.filter((memory) => memory.id !== id);
	}

	async retryLastMessage() {
		if (this.lastSentMessage) await this.sendMessage(this.lastSentMessage);
	}

	activeConversation = $derived.by(() => {
		return this.conversations.find((c) => c.id === this.activeId) || null;
	});

	activeMessages = $derived.by(() => {
		if (!this.activeId) return [];
		return this.messages[this.activeId] || [];
	});

	constructor() {
		if (browser) {
			void this.hydrateFromServer();
		}
	}

	private async hydrateFromServer() {
		this.isLoading = true;
		try {
			const response = await fetch('/api/conversations');
			if (!response.ok) throw new Error('Unable to load conversations');

			const data = (await response.json()) as {
				conversations: Conversation[];
				messages: Record<string, ChatMessage[]>;
			};
			if (data.conversations.length > 0) {
				this.conversations = data.conversations;
				this.messages = Object.fromEntries(
					Object.entries(data.messages).map(([conversationId, messages]) => [
						conversationId,
						messages.map((message) => ({ ...message, persisted: true }))
					])
				);
				// Keep the selected server conversation when refreshing; otherwise open the most recent one.
				this.activeId =
					this.activeId &&
					data.conversations.some((conversation) => conversation.id === this.activeId)
						? this.activeId
						: data.conversations[0].id;
			} else {
				await this.createNewConversation();
			}
		} catch (error) {
			console.warn('Unable to load saved conversations.', error);
			this.error = 'Unable to load saved conversations. Please refresh and try again.';
		} finally {
			this.isLoading = false;
		}
	}

	private adoptServerIds(
		localConversationId: string,
		conversationId: string,
		userMessageId: string
	) {
		if (localConversationId !== conversationId) {
			const conversation = this.conversations.find((item) => item.id === localConversationId);
			if (conversation) conversation.id = conversationId;
			this.messages[conversationId] = this.messages[localConversationId] || [];
			delete this.messages[localConversationId];
			if (this.activeId === localConversationId) this.activeId = conversationId;
		}

		const currentMessages = this.messages[conversationId] || [];
		for (let index = currentMessages.length - 1; index >= 0; index--) {
			if (currentMessages[index].role === 'user') {
				currentMessages[index] = {
					...currentMessages[index],
					id: userMessageId,
					persisted: true
				};
				this.messages[conversationId] = [...currentMessages];
				break;
			}
		}
	}

	private async getResponseError(response: Response): Promise<string> {
		try {
			const payload = (await response.json()) as { error?: { message?: string } };
			if (payload.error?.message) return payload.error.message;
		} catch {
			// A non-JSON response still gets a clear status-based error below.
		}
		return `MOONDAY could not save or process this message (HTTP ${response.status}).`;
	}

	saveToLocalStorage() {
		// Conversations and messages are database-backed. Intentionally do not cache
		// them locally, which prevents stale browser-only chat sessions.
	}

	async createNewConversation() {
		if (this.isCreatingConversation) return null;
		this.isCreatingConversation = true;
		this.error = null;
		try {
			const response = await fetch('/api/conversations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ characterId: characterStore.activeId })
			});
			if (!response.ok) throw new Error(await this.getResponseError(response));
			const data = (await response.json()) as {
				conversation: Conversation;
				messages: ChatMessage[];
			};
			const persistedMessages = data.messages.map((message) => ({ ...message, persisted: true }));
			this.conversations = [data.conversation, ...this.conversations];
			this.messages[data.conversation.id] = persistedMessages;
			this.activeId = data.conversation.id;
			return data.conversation;
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Unable to create a new conversation.';
			return null;
		} finally {
			this.isCreatingConversation = false;
		}
	}

	selectConversation(id: string) {
		if (this.conversations.some((c) => c.id === id)) {
			this.activeId = id;
			// Sync character to match conversation context if possible
			const conv = this.conversations.find((c) => c.id === id);
			if (conv) {
				characterStore.selectCharacter(conv.characterTone || conv.activeCharacterId);
			}
		}
	}

	async deleteConversation(id: string) {
		if (this.isThinking || this.isStreaming) return false;
		this.error = null;
		try {
			const response = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
			if (!response.ok) throw new Error(await this.getResponseError(response));

			const remainingConversations = this.conversations.filter(
				(conversation) => conversation.id !== id
			);
			this.conversations = remainingConversations;
			delete this.messages[id];

			if (this.activeId === id) {
				this.activeId = remainingConversations[0]?.id ?? null;
				if (!this.activeId) await this.createNewConversation();
			}
			return true;
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Unable to delete this conversation.';
			return false;
		}
	}

	async updateConversationTitle(id: string, newTitle: string) {
		this.error = null;
		try {
			const response = await fetch(`/api/conversations/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: newTitle })
			});
			if (!response.ok) throw new Error(await this.getResponseError(response));
			const { conversation } = (await response.json()) as { conversation: Conversation };
			this.conversations = this.conversations.map((item) =>
				item.id === id ? { ...item, ...conversation } : item
			);
			return true;
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Unable to rename this conversation.';
			return false;
		}
	}

	async sendMessage(content: string) {
		if (!content.trim()) return;
		if (!this.activeId) await this.createNewConversation();
		if (!this.activeId) return;
		this.lastSentMessage = content.trim();
		this.usedMemories = [];

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
		const localConversationId = this.activeId;

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
					language: settingsStore.responseLanguage,
					stream: true,
					enableWebSearch: this.isWebSearchEnabled,
					enableMemoryExtraction: settingsStore.memoryExtractionEnabled
				})
			});

			if (!response.ok) {
				throw new Error(await this.getResponseError(response));
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error('Response body is not readable');
			}

			this.isStreaming = true;
			this.isThinking = false;

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
									this.usedMemories = Array.isArray(data.usedMemories) ? data.usedMemories : [];
									this.adoptServerIds(localConversationId, data.conversationId, data.userMessageId);
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
								} else if (data.type === 'status') {
									updateMessage({ status: data.message });
								} else if (data.type === 'token') {
									const currentMsgs = this.messages[this.activeId!] || [];
									const msg = currentMsgs.find((m) => m.id === assistantMsgId);
									const currentContent = msg ? msg.content : '';
									const updates: Partial<ChatMessage> = { content: currentContent + data.content };
									if (msg?.status) {
										updates.status = undefined;
									}
									updateMessage(updates);
									uiStore.setMoonState('speaking');
								} else if (data.type === 'done') {
									const currentMsgs = this.messages[this.activeId!] || [];
									const msg = currentMsgs.find((m) => m.id === assistantMsgId);
									const finalEmotionLabel = msg?.emotionLabel;
									const finalMoodScore = msg?.moodScore;
									if (data.assistantMessageId) {
										updateMessage({ id: data.assistantMessageId, persisted: true });
									}

									const conv = this.conversations.find((c) => c.id === this.activeId);
									if (conv) {
										conv.lastEmotionLabel = finalEmotionLabel;
										conv.lastMoodScore = finalMoodScore;
										conv.updatedAt = new Date().toISOString();
									}
									uiStore.setMoonState('idle');
								} else if (data.type === 'error') {
									this.error = data.error?.message || 'MOONDAY could not complete this reply.';
									uiStore.setMoonState('idle');
									return;
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
			console.error('Chat request failed:', err);
			this.error = err instanceof Error ? err.message : 'Unable to send message. Please try again.';
		} finally {
			this.isThinking = false;
			this.saveToLocalStorage();
		}
	}

	async editMessage(messageId: string, newContent: string) {
		if (!newContent.trim() || !this.activeId) return;

		const conversationId = this.activeId;
		const currentMsgs = this.messages[conversationId] || [];
		const index = currentMsgs.findIndex((m) => m.id === messageId);
		if (index === -1) return;

		// Slice the local messages array to discard all messages after that index
		const slicedMsgs = currentMsgs.slice(0, index + 1);
		// Update the edited message content
		slicedMsgs[index] = {
			...slicedMsgs[index],
			content: newContent
		};
		this.messages[conversationId] = slicedMsgs;

		this.isThinking = true;
		this.error = null;
		this.saveToLocalStorage();

		characterStore.activeCharacter.avatarState = 'thinking';
		uiStore.setMoonState('thinking');

		const assistantMsgId = crypto.randomUUID();

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					conversationId,
					message: newContent,
					characterId: characterStore.activeId,
					provider: settingsStore.provider,
					language: settingsStore.responseLanguage,
					stream: true,
					editId: messageId,
					enableWebSearch: this.isWebSearchEnabled,
					enableMemoryExtraction: settingsStore.memoryExtractionEnabled
				})
			});

			if (!response.ok) {
				throw new Error(await this.getResponseError(response));
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error('Response body is not readable');
			}

			this.isStreaming = true;
			this.isThinking = false;

			// Add assistant message shell
			const assistantMsg: ChatMessage = {
				id: assistantMsgId,
				role: 'assistant',
				content: '',
				createdAt: new Date().toISOString()
			};
			this.messages[conversationId] = [...(this.messages[conversationId] || []), assistantMsg];

			const updateMessage = (updates: Partial<ChatMessage>) => {
				const msgs = this.messages[conversationId] || [];
				const idx = msgs.findIndex((m) => m.id === assistantMsgId);
				if (idx !== -1) {
					msgs[idx] = {
						...msgs[idx],
						...updates
					};
					this.messages[conversationId] = [...msgs];
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
								} else if (data.type === 'status') {
									updateMessage({ status: data.message });
								} else if (data.type === 'token') {
									const msgs = this.messages[this.activeId!] || [];
									const msg = msgs.find((m) => m.id === assistantMsgId);
									const currentContent = msg ? msg.content : '';
									const updates: Partial<ChatMessage> = { content: currentContent + data.content };
									if (msg?.status) {
										updates.status = undefined;
									}
									updateMessage(updates);
									uiStore.setMoonState('speaking');
								} else if (data.type === 'done') {
									const msgs = this.messages[conversationId] || [];
									const msg = msgs.find((m) => m.id === assistantMsgId);
									const finalEmotionLabel = msg?.emotionLabel;
									const finalMoodScore = msg?.moodScore;
									if (data.assistantMessageId) {
										updateMessage({ id: data.assistantMessageId, persisted: true });
									}

									const conv = this.conversations.find((c) => c.id === conversationId);
									if (conv) {
										conv.lastEmotionLabel = finalEmotionLabel;
										conv.lastMoodScore = finalMoodScore;
										conv.updatedAt = new Date().toISOString();
									}
									uiStore.setMoonState('idle');
								} else if (data.type === 'error') {
									this.error = data.error?.message || 'MOONDAY could not complete this reply.';
									uiStore.setMoonState('idle');
									return;
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
							const msgs = this.messages[conversationId] || [];
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
			console.error('Error during edit message streaming:', err);
			const errorMessage = err instanceof Error ? err.message : 'Streaming interrupted.';
			if (errorMessage === 'Message to edit not found') {
				// This can occur for conversations retained in localStorage before server IDs
				// were introduced. Do not leave the user with a truncated local transcript.
				this.messages[conversationId] = currentMsgs;
				await this.hydrateFromServer();
				this.error =
					'This older local message is no longer available to edit. Your saved conversation was refreshed.';
			} else {
				this.error = errorMessage;
			}
			this.isStreaming = false;
			this.isThinking = false;
		} finally {
			this.isThinking = false;
			this.saveToLocalStorage();
		}
	}

	async rerollLastMessage() {
		if (this.isStreaming || this.isThinking || this.isRerolling) return;
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
		const conversationId = this.activeId;

		// Find the user message before that assistant message.
		let userMsg: ChatMessage | null = null;
		for (let i = assistantMsgIdx - 1; i >= 0; i--) {
			if (currentMsgs[i].role === 'user') {
				userMsg = currentMsgs[i];
				break;
			}
		}

		if (!userMsg) return;

		this.isRerolling = true;
		this.isThinking = true;
		this.error = null;

		// Change avatar to listening, then thinking
		characterStore.activeCharacter.avatarState = 'thinking';
		uiStore.setMoonState('thinking');

		try {
			// Call api route /api/chat
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					conversationId,
					message: userMsg.content,
					characterId: characterStore.activeId,
					provider: settingsStore.provider,
					language: settingsStore.responseLanguage,
					stream: true,
					reroll: true,
					enableWebSearch: this.isWebSearchEnabled,
					enableMemoryExtraction: settingsStore.memoryExtractionEnabled
				})
			});

			if (!response.ok) {
				throw new Error(await this.getResponseError(response));
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error('Response body is not readable');
			}

			this.isStreaming = true;
			this.isThinking = false;

			// Reset the content of the assistant message
			const assistantMsgId = assistantMsg.id;

			const updateMessage = (updates: Partial<ChatMessage>) => {
				const msgs = this.messages[conversationId] || [];
				const idx = msgs.findIndex((m) => m.id === assistantMsgId);
				if (idx !== -1) {
					msgs[idx] = {
						...msgs[idx],
						...updates
					};
					this.messages[conversationId] = [...msgs];
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
								} else if (data.type === 'status') {
									updateMessage({ status: data.message });
								} else if (data.type === 'token') {
									const msgs = this.messages[this.activeId!] || [];
									const msg = msgs.find((m) => m.id === assistantMsgId);
									const currentContent = msg ? msg.content : '';
									const updates: Partial<ChatMessage> = { content: currentContent + data.content };
									if (msg?.status) {
										updates.status = undefined;
									}
									updateMessage(updates);
									uiStore.setMoonState('speaking');
								} else if (data.type === 'done') {
									const msgs = this.messages[conversationId] || [];
									const msg = msgs.find((m) => m.id === assistantMsgId);
									const finalEmotionLabel = msg?.emotionLabel;
									const finalMoodScore = msg?.moodScore;
									if (data.assistantMessageId) {
										updateMessage({ id: data.assistantMessageId, persisted: true });
									}

									const conv = this.conversations.find((c) => c.id === conversationId);
									if (conv) {
										conv.lastEmotionLabel = finalEmotionLabel;
										conv.lastMoodScore = finalMoodScore;
										conv.updatedAt = new Date().toISOString();
									}
									uiStore.setMoonState('idle');
								} else if (data.type === 'error') {
									this.error = data.error?.message || 'MOONDAY could not complete this reply.';
									uiStore.setMoonState('idle');
									return;
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
							const msgs = this.messages[conversationId] || [];
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
			this.isRerolling = false;
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
}

export const chatStore = new ChatStore();
