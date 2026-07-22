import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	calculateHybridScore,
	calculateRecencyScore,
	rankAndFilterMemories
} from '../lib/server/memory/rank';

describe('Memory Ranking Logic', () => {
	beforeEach(() => {
		// Mock Date.now() to ensure stable date calculations
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-10T00:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('calculateRecencyScore', () => {
		it('should return 1.0 for a memory created right now', () => {
			const now = new Date();
			expect(calculateRecencyScore(now)).toBe(1.0);
		});

		it('should return 0.5 for a memory created exactly 1 day ago', () => {
			const oneDayAgo = new Date('2026-07-09T00:00:00Z');
			expect(calculateRecencyScore(oneDayAgo)).toBe(0.5);
		});

		it('should handle memories with future creation dates gracefully by treating them as 0 days ago (recency score 1.0)', () => {
			const futureDate = new Date('2026-07-11T00:00:00Z');
			expect(calculateRecencyScore(futureDate)).toBe(1.0);
		});

		it('should return ~0.0909 for a memory created 10 days ago', () => {
			const tenDaysAgo = new Date('2026-06-30T00:00:00Z');
			// daysSinceCreation = 10
			// recencyScore = 1 / (1 + 10) = 1/11 ≈ 0.09090909
			expect(calculateRecencyScore(tenDaysAgo)).toBeCloseTo(0.090909, 5);
		});
	});

	describe('calculateHybridScore', () => {
		it('should combine vector score (70%) and recency score (30%)', () => {
			const now = new Date(); // recency score = 1.0
			const vectorScore = 0.8;
			// Expected hybrid score: (0.8 * 0.7) + (1.0 * 0.3) = 0.56 + 0.3 = 0.86
			expect(calculateHybridScore(vectorScore, now)).toBeCloseTo(0.86, 5);
		});

		it('should combine vector score and old recency score correctly', () => {
			const oneDayAgo = new Date('2026-07-09T00:00:00Z'); // recency score = 0.5
			const vectorScore = 0.8;
			// Expected hybrid score: (0.8 * 0.7) + (0.5 * 0.3) = 0.56 + 0.15 = 0.71
			expect(calculateHybridScore(vectorScore, oneDayAgo)).toBeCloseTo(0.71, 5);
		});
	});

	describe('rankAndFilterMemories', () => {
		it('should rank memories in descending order of hybrid score and return top 5', () => {
			const memories = [
				{
					id: '1',
					type: 'preference',
					title: 'Pref 1',
					content: 'Content 1',
					similarity: 0.9,
					createdAt: new Date('2026-07-05T00:00:00Z') // 5 days ago -> recency = 1/6 = 0.1667 -> score = 0.9 * 0.7 + 0.1667 * 0.3 = 0.63 + 0.05 = 0.68
				},
				{
					id: '2',
					type: 'preference',
					title: 'Pref 2',
					content: 'Content 2',
					similarity: 0.8,
					createdAt: new Date('2026-07-09T00:00:00Z') // 1 day ago -> recency = 0.5 -> score = 0.8 * 0.7 + 0.5 * 0.3 = 0.56 + 0.15 = 0.71
				},
				{
					id: '3',
					type: 'preference',
					title: 'Pref 3',
					content: 'Content 3',
					similarity: 0.95,
					createdAt: new Date('2026-07-09T12:00:00Z') // 0.5 days ago -> recency = 1/1.5 = 0.667 -> score = 0.95 * 0.7 + 0.667 * 0.3 = 0.665 + 0.20 = 0.865
				},
				{
					id: '4',
					type: 'preference',
					title: 'Pref 4',
					content: 'Content 4',
					similarity: 0.5,
					createdAt: new Date('2026-07-10T00:00:00Z') // 0 days ago -> recency = 1.0 -> score = 0.5 * 0.7 + 1.0 * 0.3 = 0.35 + 0.30 = 0.65
				},
				{
					id: '5',
					type: 'preference',
					title: 'Pref 5',
					content: 'Content 5',
					similarity: 0.4,
					createdAt: new Date('2026-07-08T00:00:00Z') // 2 days ago -> recency = 1/3 = 0.333 -> score = 0.4 * 0.7 + 0.333 * 0.3 = 0.28 + 0.10 = 0.38
				},
				{
					id: '6',
					type: 'preference',
					title: 'Pref 6',
					content: 'Content 6',
					similarity: 0.3,
					createdAt: new Date('2026-07-09T18:00:00Z') // 0.25 days ago -> recency = 1/1.25 = 0.8 -> score = 0.3 * 0.7 + 0.8 * 0.3 = 0.21 + 0.24 = 0.45
				}
			];

			const ranked = rankAndFilterMemories(memories);

			expect(ranked.length).toBe(5);
			// Sorted order check
			expect(ranked[0].id).toBe('3'); // score ~0.865
			expect(ranked[1].id).toBe('2'); // score ~0.71
			expect(ranked[2].id).toBe('1'); // score ~0.68
			expect(ranked[3].id).toBe('4'); // score ~0.65
			expect(ranked[4].id).toBe('6'); // score ~0.45
			// '5' is lowest score (0.38) and should be sliced out

			// Check structure of returned objects
			expect(ranked[0]).toHaveProperty('id');
			expect(ranked[0]).toHaveProperty('type');
			expect(ranked[0]).toHaveProperty('title');
			expect(ranked[0]).toHaveProperty('content');
			expect(ranked[0]).toHaveProperty('similarity');
			expect(ranked[0]).toHaveProperty('recency');
			expect(ranked[0]).toHaveProperty('score');
		});

		it('should return all memories if input array has fewer than 5 elements', () => {
			const memories = [
				{
					id: '1',
					type: 'preference',
					title: 'Pref 1',
					content: 'Content 1',
					similarity: 0.9,
					createdAt: new Date()
				}
			];

			const ranked = rankAndFilterMemories(memories);
			expect(ranked.length).toBe(1);
			expect(ranked[0].id).toBe('1');
		});
	});
});
