import { expect, test } from '@playwright/test';

const conversation = {
	id: '11111111-1111-4111-8111-111111111111',
	title: 'A conversation with a title that can wrap naturally',
	activeCharacterId: 'friendly',
	characterTone: 'friendly',
	summary: 'We reflected on making room for one manageable next step.',
	memoryExtractionEnabled: true,
	createdAt: '2026-07-23T08:00:00.000Z',
	updatedAt: '2026-07-23T09:30:00.000Z'
};

const messages = [
	{
		id: '22222222-2222-4222-8222-222222222222',
		conversationId: conversation.id,
		role: 'user',
		content: 'I have too many open thoughts and want to find one small next step.',
		createdAt: '2026-07-23T09:29:00.000Z'
	},
	{
		id: '33333333-3333-4333-8333-333333333333',
		conversationId: conversation.id,
		role: 'assistant',
		content:
			'That sounds closer to overload than laziness. Let us choose the smallest thought that deserves your attention first.',
		emotionLabel: 'overwhelmed',
		moodScore: -3,
		createdAt: '2026-07-23T09:30:00.000Z'
	}
];

test.beforeEach(async ({ page }) => {
	await page.route('**/api/conversations**', async (route) => {
		if (route.request().method() !== 'GET') return route.continue();
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				conversations: [conversation],
				messages: { [conversation.id]: messages }
			})
		});
	});
	await page.route('**/api/daily-continuity', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
	);
});

test('wide chat prioritizes the active conversation and keeps controls accessible', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/chat');

	const desktopHistory = page.locator('aside[aria-label="Conversation history"]').first();
	await expect(desktopHistory.getByText('Recent conversations')).toBeVisible();
	const historyBox = await desktopHistory.boundingBox();
	const composerBox = await page.getByRole('textbox', { name: 'Share a thought…' }).boundingBox();
	expect(historyBox?.width).toBeGreaterThanOrEqual(270);
	expect(composerBox?.width).toBeGreaterThan(historyBox?.width || 0);

	await expect(page.getByRole('button', { name: 'Start voice dictation' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Do not remember this message' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Enable web research' })).toBeVisible();
});

test('narrow desktop opens conversation history as a drawer', async ({ page }) => {
	await page.setViewportSize({ width: 1024, height: 800 });
	await page.goto('/chat');

	const drawer = page.locator('aside[aria-label="Conversation history"]').last();
	await expect(drawer.getByText('Recent conversations')).toBeHidden();
	await page.getByRole('button', { name: 'Open conversation history', exact: true }).click();
	await expect(page.locator('#conversation-history-toggle')).toBeChecked();
	await expect(drawer.getByText('Recent conversations')).toBeVisible();
	await page.getByRole('button', { name: 'Close conversation history' }).last().click();
	await expect(drawer.getByText('Recent conversations')).toBeHidden();
});
