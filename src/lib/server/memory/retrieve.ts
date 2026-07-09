import { embeddingService } from '../ai/embeddings';
import { searchMemories } from '../db/queries/memories';
import { rankAndFilterMemories } from './rank';

export async function retrieveMemories(
	userId: string,
	queryText: string,
	limit = 5,
	similarityThreshold = 0.5
): Promise<string> {
	try {
		const queryEmbedding = await embeddingService.getEmbedding(queryText);
		const rawMemories = await searchMemories(userId, queryEmbedding, 20);
		
		const ranked = rankAndFilterMemories(rawMemories);
		const filtered = ranked.filter((r) => r.similarity >= similarityThreshold);

		if (filtered.length === 0) {
			return '';
		}

		const formattedMemories = filtered
			.map((m) => `- [${m.type}] ${m.content}`)
			.join('\n');

		return `Relevant memories:\n${formattedMemories}`;
	} catch (error) {
		console.error('Failed to retrieve memories:', error);
		return '';
	}
}
