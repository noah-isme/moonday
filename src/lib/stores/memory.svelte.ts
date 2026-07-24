import { browser } from '$app/environment';
import { SvelteDate } from 'svelte/reactivity';

export interface Memory {
	id: string;
	type:
		| 'core_memory'
		| 'preference'
		| 'emotional_pattern'
		| 'project_memory'
		| 'relationship_context'
		| 'personal_goal'
		| 'recurring_problem'
		| 'reflection';
	title: string;
	content: string;
	importance: number; // 1-10
	confidence: number; // 0-1
	createdAt: string;
}

export interface MemorySuggestion extends Omit<Memory, 'id' | 'createdAt'> {
	sourceConversationId?: string;
	sourceMessageId?: string;
}

const DEFAULT_MEMORIES: Memory[] = [
	{
		id: 'm1',
		type: 'project_memory',
		title: 'Building MOONDAY AI companion',
		content:
			'User is building MOONDAY, a private daily AI companion with animated UI, voice features, and local database memory.',
		importance: 9,
		confidence: 0.95,
		createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
	},
	{
		id: 'm2',
		type: 'preference',
		title: 'Prefers practical coding advice',
		content:
			'The user prefers concise, practical coding guidance rather than excessive boilerplate or theoretical explanations.',
		importance: 7,
		confidence: 0.9,
		createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
	},
	{
		id: 'm3',
		type: 'emotional_pattern',
		title: 'Sluggish mornings, active nights',
		content:
			'User notes a pattern of feeling sluggish or tired in the morning, but high motivation and focus in the evening.',
		importance: 8,
		confidence: 0.85,
		createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
	}
];

export class MemoryStore {
	list = $state<Memory[]>([]);

	constructor() {
		if (browser) {
			const saved = localStorage.getItem('moonday_memories');
			if (saved) {
				try {
					this.list = JSON.parse(saved);
				} catch (e) {
					console.error('Failed to parse memories:', e);
					this.list = DEFAULT_MEMORIES;
				}
			} else {
				this.list = DEFAULT_MEMORIES;
				localStorage.setItem('moonday_memories', JSON.stringify(this.list));
			}
		}
	}

	saveToLocalStorage() {
		if (browser) {
			localStorage.setItem('moonday_memories', JSON.stringify(this.list));
		}
	}

	async loadMemories() {
		try {
			const response = await fetch('/api/memories');
			if (response.ok) {
				const data = await response.json();
				if (Array.isArray(data)) {
					this.list = data;
					this.saveToLocalStorage();
				}
			}
		} catch {
			console.log('API offline, using local memories store.');
		}
	}

	addMemory(memory: Omit<Memory, 'id' | 'createdAt'>) {
		const newMemory: Memory = {
			...memory,
			id: crypto.randomUUID(),
			createdAt: new SvelteDate().toISOString()
		};
		this.list = [newMemory, ...this.list];
		this.saveToLocalStorage();
		this.syncWithBackend(newMemory, 'POST');
	}

	async saveSuggestion(suggestion: MemorySuggestion) {
		try {
			const response = await fetch('/api/memories', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(suggestion)
			});
			if (!response.ok) return false;
			const created = (await response.json()) as Memory;
			this.list = [created, ...this.list.filter((memory) => memory.id !== created.id)];
			this.saveToLocalStorage();
			return true;
		} catch {
			return false;
		}
	}

	updateMemory(id: string, updatedFields: Partial<Omit<Memory, 'id' | 'createdAt'>>) {
		this.list = this.list.map((m) => {
			if (m.id === id) {
				const updated = { ...m, ...updatedFields };
				this.syncWithBackend(updated, 'PUT');
				return updated;
			}
			return m;
		});
		this.saveToLocalStorage();
	}

	deleteMemory(id: string) {
		this.list = this.list.filter((m) => m.id !== id);
		this.saveToLocalStorage();
		this.syncWithBackend({ id }, 'DELETE');
	}

	async clearAllMemories() {
		try {
			const response = await fetch('/api/memories', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ clearMemories: true })
			});
			if (!response.ok) return false;
			this.list = [];
			this.saveToLocalStorage();
			return true;
		} catch {
			return false;
		}
	}

	private async syncWithBackend(data: unknown, method: 'POST' | 'PUT' | 'DELETE') {
		try {
			await fetch('/api/memories', {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
		} catch {
			// Fail silently, local storage is source of truth in offline mode
		}
	}
}

export const memoryStore = new MemoryStore();
