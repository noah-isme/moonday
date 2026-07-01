export interface EmbeddingService {
	getEmbedding(text: string): Promise<number[]>;
}

/**
 * Placeholder embedding service that generates a deterministic 1536-dimension vector.
 * Useful for development, testing, and initial pgvector setup.
 *
 * TODO: Integrate a production-grade embedding model:
 * - OpenAI Embeddings API (text-embedding-3-small)
 * - HuggingFace Inference API or Xenova/transformers (local runtime)
 * - Cohere Embeddings API
 */
export class MockEmbeddingService implements EmbeddingService {
	async getEmbedding(text: string): Promise<number[]> {
		const dimensions = 1536;
		const vector: number[] = new Array(dimensions).fill(0);

		// Generate a deterministic hash from the input text
		let hash = 0;
		for (let i = 0; i < text.length; i++) {
			const char = text.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash |= 0; // Convert to 32-bit integer
		}

		// Seed-based deterministic values
		for (let i = 0; i < dimensions; i++) {
			// Use frequency-dependent trigonometric function to generate pseudo-random distribution
			const val = Math.sin((hash + 1) * (i + 1) * 0.017);
			vector[i] = val;
		}

		// Normalize the vector (unit length)
		const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
		if (magnitude > 0) {
			for (let i = 0; i < dimensions; i++) {
				vector[i] /= magnitude;
			}
		}

		return vector;
	}
}

export const embeddingService: EmbeddingService = new MockEmbeddingService();
