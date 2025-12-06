import { test, expect } from '../setup/e2e-setup';

test.describe('Milk Production Management', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Navigate to milk production page
    await authenticatedPage.goto('/app/milk-production');
    await authenticatedPage.waitForLoadState('networkidle');
  });

  test('should display milk production dashboard', async ({ authenticatedPage }) => {
    // Check page title
    await expect(authenticatedPage).toHaveTitle(/Milk Production/);
    
    // Check main elements are present
    await expect(authenticatedPage.locator('h1')).toContainText('Milk Production');
    await expect(authenticatedPage.locator('[data-testid="milk-records-table"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="add-record-button"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="quality-alerts"]')).toBeVisible();
  });

  test('should create a new milk record successfully', async ({ authenticatedPage }) => {
    // Click add record button
    await authenticatedPage.click('[data-testid="add-record-button"]');
    
    // Wait for dialog to open
    await expect(authenticatedPage.locator('[data-testid="milk-record-dialog"]')).toBeVisible();
    
    // Fill in the form
    await authenticatedPage.fill('[data-testid="date-input"]', '2024-12-04');
    await authenticatedPage.fill('[data-testid="volume-input"]', '500');
    await authenticatedPage.fill('[data-testid="fat-input"]', '4.2');
    await authenticatedPage.fill('[data-testid="protein-input"]', '3.3');
    await authenticatedPage.fill('[data-testid="scc-input"]', '150000');
    await authenticatedPage.fill('[data-testid="temperature-input"]', '4.5');
    
    // Submit the form
    await authenticatedPage.click('[data-testid="submit-button"]');
    
    // Wait for success message
    await expect(authenticatedPage.locator('[data-testid="success-toast"]')).toBeVisible();
    
    // Verify record appears in table
    await expect(authenticatedPage.locator('[data-testid="milk-records-table"]')).toContainText('500');
    await expect(authenticatedPage.locator('[data-testid="milk-records-table"]')).toContainText('4.2');
  });

  test('should validate form fields correctly', async ({ authenticatedPage }) => {
    // Click add record button
    await authenticatedPage.click('[data-testid="add-record-button"]');
    
    // Try to submit empty form
    await authenticatedPage.click('[data-testid="submit-button"]');
    
    // Should show validation errors
    await expect(authenticatedPage.locator('[data-testid="validation-error"]')).toBeVisible();
    
    // Fill with invalid data (negative volume)
    await authenticatedPage.fill('[data-testid="volume-input"]', '-100');
    await authenticatedPage.click('[data-testid="submit-button"]');
    
    // Should show specific validation error
    await expect(authenticatedPage.locator('[data-testid="volume-error"]')).toBeVisible();
  });

  test('should generate quality alerts for high SCC', async ({ authenticatedPage }) => {
    // Create record with high SCC
    await authenticatedPage.click('[data-testid="add-record-button"]');
    await authenticatedPage.fill('[data-testid="date-input"]', '2024-12-04');
    await authenticatedPage.fill('[data-testid="volume-input"]', '500');
    await authenticatedPage.fill('[data-testid="fat-input"]', '4.2');
    await authenticatedPage.fill('[data-testid="protein-input"]', '3.3');
    await authenticatedPage.fill('[data-testid="scc-input"]', '500000'); // High SCC
    await authenticatedPage.fill('[data-testid="temperature-input"]', '4.5');
    await authenticatedPage.click('[data-testid="submit-button"]');
    
    // Wait for alert to be generated
    await expect(authenticatedPage.locator('[data-testid="quality-alerts"]')).toContainText('High SCC');
    await expect(authenticatedPage.locator('[data-testid="alert-item"]')).toBeVisible();
  });

  test('should display production trends chart', async ({ authenticatedPage }) => {
    // Navigate to trends tab
    await authenticatedPage.click('[data-testid="trends-tab"]');
    
    // Wait for chart to load
    await expect(authenticatedPage.locator('[data-testid="trends-chart"]')).toBeVisible();
    
    // Check chart elements
    await expect(authenticatedPage.locator('[data-testid="chart-canvas"]')).toBeVisible();
    await expect(authenticatedPage.locator('[data-testid="chart-legend"]')).toBeVisible();
  });

  test('should filter records by date range', async ({ authenticatedPage }) => {
    // Set date filter
    await authenticatedPage.fill('[data-testid="start-date-filter"]', '2024-12-01');
    await authenticatedPage.fill('[data-testid="end-date-filter"]', '2024-12-04');
    await authenticatedPage.click('[data-testid="apply-filter-button"]');
    
    // Wait for filtered results
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Verify filter is applied (check URL or filter indicator)
    await expect(authenticatedPage.locator('[data-testid="active-filters"]')).toBeVisible();
  });

  test('should export milk records to CSV', async ({ authenticatedPage }) => {
    // Click export button
    await authenticatedPage.click('[data-testid="export-button"]');
    
    // Wait for download to start
    const downloadPromise = authenticatedPage.waitForEvent('download');
    await authenticatedPage.click('[data-testid="export-csv-button"]');
    
    const download = await downloadPromise;
    
    // Verify download filename
    expect(download.suggestedFilename()).toMatch(/milk-records.*\.csv$/);
  });

  test('should handle pagination correctly', async ({ authenticatedPage }) => {
    // Check if pagination is present (assuming multiple pages)
    const pagination = authenticatedPage.locator('[data-testid="pagination"]');
    
    if (await pagination.isVisible()) {
      // Click next page
      await authenticatedPage.click('[data-testid="next-page"]');
      
      // Wait for new data to load
      await authenticatedPage.waitForLoadState('networkidle');
      
      // Verify page changed
      await expect(authenticatedPage.locator('[data-testid="current-page"]')).toContainText('2');
    }
  });
});

test.describe('Milk Production - Mobile Responsive', () => {
  test('should work correctly on mobile devices', async ({ mobilePage, authenticatedPage }) => {
    // Use mobile page fixture
    await mobilePage.goto('/app/milk-production');
    await mobilePage.waitForLoadState('networkidle');
    
    // Check mobile layout
    await expect(mobilePage.locator('[data-testid="mobile-menu"]')).toBeVisible();
    
    // Mobile table should be scrollable
    const table = mobilePage.locator('[data-testid="milk-records-table"]');
    await expect(table).toBeVisible();
    
    // Mobile add button should be accessible
    await expect(mobilePage.locator('[data-testid="mobile-add-button"]')).toBeVisible();
    
    // Test mobile form
    await mobilePage.click('[data-testid="mobile-add-button"]');
    await expect(mobilePage.locator('[data-testid="milk-record-dialog"]')).toBeVisible();
    
    // Fill form on mobile
    await mobilePage.fill('[data-testid="volume-input"]', '500');
    await mobilePage.fill('[data-testid="fat-input"]', '4.2');
    await mobilePage.fill('[data-testid="protein-input"]', '3.3');
    await mobilePage.fill('[data-testid="scc-input"]', '150000');
    await mobilePage.fill('[data-testid="temperature-input"]', '4.5');
    
    // Submit on mobile
    await mobilePage.click('[data-testid="submit-button"]');
    
    // Verify success
    await expect(mobilePage.locator('[data-testid="success-toast"]')).toBeVisible();
  });
});

test.describe('Milk Production - Offline Support', () => {
  test('should work offline with cached data', async ({ authenticatedPage, page }) => {
    // Go online first to cache data
    await authenticatedPage.goto('/app/milk-production');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Go offline
    await page.context().setOffline(true);
    
    // Should still be able to view cached data
    await expect(authenticatedPage.locator('[data-testid="milk-records-table"]')).toBeVisible();
    
    // Should show offline indicator
    await expect(authenticatedPage.locator('[data-testid="offline-indicator"]')).toBeVisible();
    
    // Should be able to create new record (will be queued)
    await authenticatedPage.click('[data-testid="add-record-button"]');
    await authenticatedPage.fill('[data-testid="volume-input"]', '500');
    await authenticatedPage.fill('[data-testid="fat-input"]', '4.2');
    await authenticatedPage.fill('[data-testid="protein-input"]', '3.3');
    await authenticatedPage.fill('[data-testid="scc-input"]', '150000');
    await authenticatedPage.fill('[data-testid="temperature-input"]', '4.5');
    await authenticatedPage.click('[data-testid="submit-button"]');
    
    // Should show queued message
    await expect(authenticatedPage.locator('[data-testid="queued-message"]')).toBeVisible();
    
    // Go back online
    await page.context().setOffline(false);
    
    // Should sync automatically
    await expect(authenticatedPage.locator('[data-testid="sync-success"]')).toBeVisible();
  });
});

test.describe('Milk Production - Performance', () => {
  test('should load within performance budget', async ({ authenticatedPage }) => {
    // Measure page load time
    const startTime = Date.now();
    await authenticatedPage.goto('/app/milk-production');
    await authenticatedPage.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should handle large datasets efficiently', async ({ authenticatedPage }) => {
    // Navigate to page with potentially large dataset
    await authenticatedPage.goto('/app/milk-production');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Measure time to render table
    const startTime = Date.now();
    await expect(authenticatedPage.locator('[data-testid="milk-records-table"]')).toBeVisible();
    const renderTime = Date.now() - startTime;
    
    // Should render within 2 seconds
    expect(renderTime).toBeLessThan(2000);
    
    // Test pagination performance
    const pagination = authenticatedPage.locator('[data-testid="pagination"]');
    if (await pagination.isVisible()) {
      const pageStartTime = Date.now();
      await authenticatedPage.click('[data-testid="next-page"]');
      await authenticatedPage.waitForLoadState('networkidle');
      const pageTime = Date.now() - pageStartTime;
      
      // Pagination should be fast
      expect(pageTime).toBeLessThan(1000);
    }
  });
});

test.describe('Milk Production - Error Handling', () => {
  test('should handle API errors gracefully', async ({ authenticatedPage, page }) => {
    // Mock API failure
    await page.route('/api/milk/records', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });
    
    // Navigate to page
    await authenticatedPage.goto('/app/milk-production');
    
    // Should show error message
    await expect(authenticatedPage.locator('[data-testid="error-message"]')).toBeVisible();
    
    // Should provide retry option
    await expect(authenticatedPage.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should handle network timeouts', async ({ authenticatedPage, page }) => {
    // Mock slow network
    await page.route('/api/milk/records', route => {
      // Don't respond to simulate timeout
    });
    
    // Navigate to page
    await authenticatedPage.goto('/app/milk-production');
    
    // Should show timeout message
    await expect(authenticatedPage.locator('[data-testid="timeout-message"]')).toBeVisible();
  });
});

test.describe('Milk Production - Accessibility', () => {
  test('should be keyboard navigable', async ({ authenticatedPage }) => {
    // Test keyboard navigation
    await authenticatedPage.keyboard.press('Tab');
    await expect(authenticatedPage.locator(':focus')).toBeVisible();
    
    // Navigate to add button
    let isAddButtonFocused = false;
    for (let i = 0; i < 10; i++) {
      await authenticatedPage.keyboard.press('Tab');
      const focusedElement = authenticatedPage.locator(':focus');
      if (await focusedElement.getAttribute('data-testid') === 'add-record-button') {
        isAddButtonFocused = true;
        break;
      }
    }
    
    expect(isAddButtonFocused).toBe(true);
    
    // Activate with keyboard
    await authenticatedPage.keyboard.press('Enter');
    await expect(authenticatedPage.locator('[data-testid="milk-record-dialog"]')).toBeVisible();
  });

  test('should have proper ARIA labels', async ({ authenticatedPage }) => {
    // Check for ARIA labels
    await expect(authenticatedPage.locator('[aria-label="Milk production records"]')).toBeVisible();
    await expect(authenticatedPage.locator('[aria-label="Add new milk record"]')).toBeVisible();
    
    // Check form accessibility
    await authenticatedPage.click('[data-testid="add-record-button"]');
    await expect(authenticatedPage.locator('[data-testid="volume-input"]')).toHaveAttribute('aria-label');
    await expect(authenticatedPage.locator('[data-testid="fat-input"]')).toHaveAttribute('aria-label');
  });
});
