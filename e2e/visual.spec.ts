import { test, expect } from '@playwright/test';

const fixedMoodLogs = [
	{
		id: 'mood-1',
		moodLabel: 'calm',
		moodScore: 2,
		energyLevel: 3,
		stressLevel: 2,
		note: 'Had a quiet evening, finished some reading.',
		createdAt: '2026-07-24T10:00:00.000Z'
	},
	{
		id: 'mood-2',
		moodLabel: 'motivated',
		moodScore: 5,
		energyLevel: 5,
		stressLevel: 3,
		note: 'Started building the new project, feeling very productive.',
		createdAt: '2026-07-23T10:00:00.000Z'
	},
	{
		id: 'mood-3',
		moodLabel: 'tired',
		moodScore: -1,
		energyLevel: 1,
		stressLevel: 2,
		note: 'Woke up late, feeling a bit sluggish today.',
		createdAt: '2026-07-22T10:00:00.000Z'
	},
	{
		id: 'mood-4',
		moodLabel: 'anxious',
		moodScore: -3,
		energyLevel: 3,
		stressLevel: 4,
		note: 'A bit worried about the upcoming review. Slept poorly.',
		createdAt: '2026-07-21T10:00:00.000Z'
	}
];

const fixedConversations = [
	{
		id: 'conv-1',
		title: 'Reflections on building MOONDAY',
		activeCharacterId: 'friendly',
		characterTone: 'friendly',
		summary: 'Building a personal AI companion with animated UI and voice features.',
		memoryExtractionEnabled: true,
		lastEmotionLabel: 'motivated',
		lastMoodScore: 4,
		createdAt: '2026-07-23T08:00:00.000Z',
		updatedAt: '2026-07-23T09:30:00.000Z'
	}
];

const fixedMessages = {
	'conv-1': [
		{
			id: 'msg-1',
			conversationId: 'conv-1',
			role: 'user',
			content: 'I have too many open thoughts and want to find one small next step.',
			createdAt: '2026-07-23T09:29:00.000Z'
		},
		{
			id: 'msg-2',
			conversationId: 'conv-1',
			role: 'assistant',
			content:
				'That sounds closer to overload than laziness. Let us choose the smallest thought that deserves your attention first.',
			emotionLabel: 'overwhelmed',
			moodScore: -3,
			createdAt: '2026-07-23T09:30:00.000Z'
		}
	]
};

const fixedMemories = [
	{
		id: 'mem-1',
		type: 'project_memory',
		title: 'Building MOONDAY AI companion',
		content:
			'User is building MOONDAY, a private daily AI companion with animated UI, voice features, and local database memory.',
		importance: 9,
		confidence: 0.95,
		createdAt: '2026-07-21T10:00:00.000Z'
	},
	{
		id: 'mem-2',
		type: 'preference',
		title: 'Prefers practical coding advice',
		content:
			'The user prefers concise, practical coding guidance rather than excessive boilerplate or theoretical explanations.',
		importance: 7,
		confidence: 0.9,
		createdAt: '2026-07-22T10:00:00.000Z'
	}
];

const fixedReflections = [
	{
		id: 'refl-1',
		date: '2026-07-24',
		moodSummary: 'Reflective state.',
		emotionalSummary: "Processed today's updates.",
		importantEvents: 'Conversations and mood checking.',
		suggestedFocus: 'Continue regular check-ins.'
	}
];

const fixedJournalTrends = [
	{
		date: '2026-07-24',
		moodScore: 2,
		label: 'calm',
		createdAt: '2026-07-24T10:00:00.000Z'
	},
	{
		date: '2026-07-23',
		moodScore: 5,
		label: 'motivated',
		createdAt: '2026-07-23T10:00:00.000Z'
	},
	{
		date: '2026-07-22',
		moodScore: -1,
		label: 'tired',
		createdAt: '2026-07-22T10:00:00.000Z'
	},
	{
		date: '2026-07-21',
		moodScore: -3,
		label: 'anxious',
		createdAt: '2026-07-21T10:00:00.000Z'
	}
];

const fixedWeekly = {
	reflection: {
		id: 'weekly-1',
		weekStart: '2026-07-20',
		summary: 'Your logged mood averaged 3.5 out of 5 across 4 check-ins this week.',
		whatHelped: 'You kept building MOONDAY in view.',
		whatFeltHeavy:
			'Your logged stress averaged 2.5 out of 5. Treat this as a signal to check in, not a diagnosis.',
		suggestedFocus: 'Choose one small, realistic thing that would make the next few days easier.',
		status: 'active',
		correction: null
	},
	draft: {
		summary: 'Your logged mood averaged 3.5 out of 5 across 4 check-ins this week.',
		insights: ['You kept building MOONDAY in view.'],
		suggestions: ['Choose one small, realistic thing that would make the next few days easier.']
	},
	weekStart: '2026-07-20'
};

const fixedContinuity = {};

const fixedSettings = {
	profile: { name: 'User', bio: '', occupation: '', communicationStyle: {} },
	characterProfiles: [
		{
			id: 'friendly',
			name: 'Friendly MOONDAY',
			description: 'Warm, reflective, gently witty, practical, emotionally aware.',
			tone: 'friendly',
			humorLevel: 3,
			sarcasmLevel: 1,
			emotionalWarmth: 5,
			moralDirectness: 3
		},
		{
			id: 'calm',
			name: 'Calm MOONDAY',
			description: 'Gentle, steady, minimal words, deep listening.',
			tone: 'calm',
			humorLevel: 1,
			sarcasmLevel: 0,
			emotionalWarmth: 4,
			moralDirectness: 2
		}
	],
	activeCharacterId: 'friendly',
	provider: 'deepseek',
	model: 'deepseek-chat',
	responseLanguage: 'en',
	memoryExtractionEnabled: true,
	voiceEnabled: true,
	speechLanguage: 'id-ID'
};

test.describe('MOONDAY Visual Regression Tests', () => {
	let pageErrors: Error[] = [];

	test.beforeEach(async ({ page }) => {
		pageErrors = [];
		page.on('pageerror', (error) => pageErrors.push(error));

		// Fix time for consistent screenshots
		await page.clock.setFixedTime(new Date('2026-07-24T10:00:00Z'));

		// Mock all API routes with fixed fixtures
		await page.route('**/api/mood**', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(fixedMoodLogs)
			})
		);

		await page.route('**/api/conversations**', async (route) => {
			if (route.request().method() !== 'GET') return route.continue();
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					conversations: fixedConversations,
					messages: fixedMessages
				})
			});
		});

		await page.route('**/api/memories**', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(fixedMemories)
			})
		);

		await page.route('**/api/reflections**', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(fixedReflections)
			})
		);

		await page.route('**/api/journal/trends', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(fixedJournalTrends)
			})
		);

		await page.route('**/api/journal/weekly', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(fixedWeekly)
			})
		);

		await page.route('**/api/daily-continuity', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(fixedContinuity)
			})
		);

		await page.route('**/api/settings**', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(fixedSettings)
			})
		);

		// Wait for web page network and fonts to settle
		await page.goto('/');
		await page.evaluate(() => document.fonts.ready);
	});

	test.afterEach(() => {
		expect(pageErrors).toEqual([]);
	});

	test('Home page matches visual snapshot', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveScreenshot('home-page.png', { fullPage: true });
	});

	test('Chat page matches visual snapshot', async ({ page }) => {
		await page.goto('/chat');
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveScreenshot('chat-page.png', { fullPage: true });
	});

	test('Journal page matches visual snapshot', async ({ page }) => {
		await page.goto('/journal');
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveScreenshot('journal-page.png', { fullPage: true });
	});

	test('Memories page matches visual snapshot', async ({ page }) => {
		await page.goto('/memories');
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveScreenshot('memories-page.png', { fullPage: true });
	});

	test('Settings page matches visual snapshot', async ({ page }) => {
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveScreenshot('settings-page.png', { fullPage: true });
	});
});
