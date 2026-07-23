import { defineConfig, devices } from '@playwright/test';

const playwrightPort = process.env.PLAYWRIGHT_PORT || '5180';
const playwrightBaseUrl = `http://127.0.0.1:${playwrightPort}`;

/**
 * Playwright configuration for MOONDAY E2E and Visual Regression Testing.
 */
export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: playwrightBaseUrl,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		actionTimeout: 10000
	},
	expect: {
		toHaveScreenshot: {
			maxDiffPixelRatio: 0.05,
			animations: 'disabled'
		}
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'mobile-chrome',
			use: { ...devices['Pixel 5'] }
		}
	],
	webServer: {
		command: `bun run dev -- --host 127.0.0.1 --port ${playwrightPort}`,
		url: playwrightBaseUrl,
		reuseExistingServer: !process.env.CI,
		timeout: 120000
	}
});
