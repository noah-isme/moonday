export type MemoryType =
	| 'core_memory'
	| 'preference'
	| 'emotional_pattern'
	| 'project_memory'
	| 'relationship_context'
	| 'personal_goal'
	| 'recurring_problem'
	| 'reflection';

export interface ExtractedMemory {
	type: MemoryType;
	title: string;
	content: string;
	importance: number; // 1-5
	confidence: number; // 0.0-1.0
	isSensitive?: boolean;
}
