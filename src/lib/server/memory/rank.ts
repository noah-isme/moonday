/**
 * Calculates the recency score for a memory based on how many days have passed since it was created.
 *
 * @param createdAt The date the memory was created
 * @returns A recency score between 0 and 1
 */
export function calculateRecencyScore(createdAt: Date): number {
	const daysSinceCreation = Math.max(0, (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
	return 1 / (1 + daysSinceCreation);
}

/**
 * Calculates the hybrid score of a memory based on its vector similarity score and recency.
 *
 * @param vectorScore The cosine similarity score of the memory (usually 0.0 to 1.0)
 * @param createdAt The date when the memory was created
 * @returns The hybrid score (weighted combination of similarity and recency)
 */
export function calculateHybridScore(vectorScore: number, createdAt: Date): number {
	const recencyScore = calculateRecencyScore(createdAt);
	return vectorScore * 0.7 + recencyScore * 0.3;
}

export interface MemoryToRank {
	id: string;
	type: string;
	title: string;
	content: string;
	similarity: number;
	createdAt: Date;
}

export interface RankedMemory {
	id: string;
	type: string;
	title: string;
	content: string;
	similarity: number;
	recency: number;
	score: number;
}

/**
 * Ranks memories by calculating their hybrid score (recency + similarity) and returns the top 5.
 *
 * @param memories Array of memories to rank
 * @returns Sorted array of the top 5 ranked memories
 */
export function rankAndFilterMemories(memories: Array<MemoryToRank>): Array<RankedMemory> {
	return memories
		.map((memory) => {
			const recency = calculateRecencyScore(memory.createdAt);
			const score = calculateHybridScore(memory.similarity, memory.createdAt);
			return {
				id: memory.id,
				type: memory.type,
				title: memory.title,
				content: memory.content,
				similarity: memory.similarity,
				recency,
				score
			};
		})
		.sort((a, b) => b.score - a.score)
		.slice(0, 5);
}
