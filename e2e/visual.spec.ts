import { test, expect } from '@playwright/test';

test.describe('MOONDAY Visual Regression Tests', () => {
	test.beforeEach(async ({ page }) => {
		// Wait for web page network and fonts to settle
		await page.goto('/');
		await page.evaluate(() => document.fonts.ready);
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
