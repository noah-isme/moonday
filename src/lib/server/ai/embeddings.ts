import { pipeline } from '@xenova/transformers';

export interface EmbeddingService {
	getEmbedding(text: string): Promise<number[]>;
}

export class XenovaEmbeddingService implements EmbeddingService {
	private extractorPromise: Promise<any> | null = null;
	private modelName = 'Xenova/all-MiniLM-L6-v2';

	private getExtractor(): Promise<any> {
		if (!this.extractorPromise) {
			this.extractorPromise = pipeline('feature-extraction', this.modelName);
		}
		return this.extractorPromise;
	}

	async getEmbedding(text: string): Promise<number[]> {
		const extractor = await this.getExtractor();
		const output = await extractor(text, { pooling: 'mean', normalize: true });
		return Array.from(output.data) as number[];
	}
}

export const embeddingService: EmbeddingService = new XenovaEmbeddingService();

