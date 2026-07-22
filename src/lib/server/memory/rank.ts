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
	importance?: number;
	confidence?: number;
	lastReferencedAt?: Date | null;
	updatedAt?: Date;
	isSensitive?: boolean;
}

export interface RankedMemory {
	id: string;
	type: string;
	title: string;
	content: string;
	similarity: number;
	recency: number;
	importance: number;
	confidence: number;
	isSensitive: boolean;
	score: number;
}

export interface MemoryRankingOptions {
	limit?: number;
	includeSensitive?: boolean;
}

/**
 * Ranks memories by calculating their hybrid score (recency + similarity) and returns the top 5.
 *
 * @param memories Array of memories to rank
 * @returns Sorted array of the top 5 ranked memories
 */
export function rankAndFilterMemories(
	memories: Array<MemoryToRank>,
	options: MemoryRankingOptions = {}
): Array<RankedMemory> {
	const limit = options.limit ?? 5;
	return memories
		.filter((memory) => options.includeSensitive || !memory.isSensitive)
		.map((memory) => {
			const mostRecentSignal = memory.lastReferencedAt || memory.updatedAt || memory.createdAt;
			const recency = calculateRecencyScore(mostRecentSignal);
			const importance = Math.min(10, Math.max(1, memory.importance ?? 5));
			const confidence = Math.min(1, Math.max(0, memory.confidence ?? 0.5));
			// Preserve the original hybrid score for legacy callers/tests, then enrich it
			// with durable signals when they are available from the database.
			const hasContextualSignals =
				memory.importance !== undefined ||
				memory.confidence !== undefined ||
				memory.lastReferencedAt !== undefined ||
				memory.updatedAt !== undefined;
			const score = hasContextualSignals
				? memory.similarity * 0.55 + (importance / 10) * 0.2 + confidence * 0.15 + recency * 0.1
				: calculateHybridScore(memory.similarity, memory.createdAt);
			return {
				id: memory.id,
				type: memory.type,
				title: memory.title,
				content: memory.content,
				similarity: memory.similarity,
				recency,
				importance,
				confidence,
				isSensitive: memory.isSensitive ?? false,
				score
			};
		})
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
}
