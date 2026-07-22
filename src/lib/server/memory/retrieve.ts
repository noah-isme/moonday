import { embeddingService } from '../ai/embeddings';
import { markMemoriesReferenced, searchMemories } from '../db/queries/memories';
import { rankAndFilterMemories } from './rank';

export type RetrievedMemory = {
	id: string;
	title: string;
	content: string;
	type: string;
};

export async function retrieveRelevantMemories(
	userId: string,
	queryText: string,
	limit = 3,
	similarityThreshold = 0.5
): Promise<RetrievedMemory[]> {
	try {
		const queryEmbedding = await embeddingService.getEmbedding(queryText);
		const rawMemories = await searchMemories(userId, queryEmbedding, 20);
		const ranked = rankAndFilterMemories(rawMemories, {
			limit,
			// Sensitive memories require an explicit memory-review flow; they are never
			// inserted into ordinary chat context automatically.
			includeSensitive: false
		}).filter((memory) => memory.similarity >= similarityThreshold);
		const selected = ranked
			.slice(0, limit)
			.map(({ id, title, content, type }) => ({ id, title, content, type }));
		await markMemoriesReferenced(selected.map((memory) => memory.id));
		return selected;
	} catch (error) {
		console.error('Failed to retrieve memories:', error);
		return [];
	}
}

export async function retrieveMemories(
	userId: string,
	queryText: string,
	limit = 5,
	similarityThreshold = 0.5
): Promise<string> {
	const memories = await retrieveRelevantMemories(userId, queryText, limit, similarityThreshold);
	if (memories.length === 0) return '';
	return `Relevant memories:\n${memories.map((memory) => `- [${memory.type}] ${memory.content}`).join('\n')}`;
}
