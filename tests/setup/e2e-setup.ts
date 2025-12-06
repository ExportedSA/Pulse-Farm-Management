import { test as base, expect, type Page, type Locator, type TestFixture } from '@playwright/test';

// Define custom fixture types
interface CustomTestFixtures {
  authenticatedPage: Page;
  mobilePage: Page;
}

// Extend base test with custom fixtures
export const test = base.extend<CustomTestFixtures>({
  // Authenticated page fixture
  authenticatedPage: async ({ page }, use) => {
    // Login before test
    await page.goto('/login');
    await page.fill('[data-testid="username"]', 'testuser');
    await page.fill('[data-testid="password"]', 'testpass');
    await page.click('[data-testid="login-button"]');
    
    // Wait for dashboard
    await page.waitForURL('/app/dashboard');
    await use(page);
  },
  
  // Mobile viewport fixture
  mobilePage: async ({ page }, use) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await use(page);
  },
});

export { expect };
export type PageType = Page;
export type LocatorType = Locator;
