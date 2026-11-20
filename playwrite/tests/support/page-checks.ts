import AxeBuilder from '@axe-core/playwright';
import { test, type Page, type TestInfo } from '@playwright/test';

/**
 * Evidence the dashboard shows per page (gallery, visual changes, accessibility, load time).
 * Only reported, never a reason for the test to fail. PW_PAGE_CHECKS=0 turns it off.
 */
export const pageChecksOn = process.env.PW_PAGE_CHECKS !== '0';

export async function recordPageLoad(testInfo: TestInfo, page: string, ms: number): Promise<void> {
  await testInfo.attach('metric', {
    body: JSON.stringify({ kind: 'page-load', name: page, ms: Math.round(ms) }),
    contentType: 'application/json',
  });
}

export async function checkPage(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (!pageChecksOn) return;
  await test.step(
    'Screenshot and accessibility scan',
    async () => {
      const shot = await page.screenshot({ animations: 'disabled', caret: 'hide' });
      await testInfo.attach('page-screenshot', { body: shot, contentType: 'image/png' });

      try {
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        await testInfo.attach('a11y', {
          body: JSON.stringify({
            page: name,
            passes: result.passes.length,
            incomplete: result.incomplete.length,
            violations: result.violations.map((v) => ({
              id: v.id,
              impact: v.impact ?? 'minor',
              help: v.help,
              description: v.description,
              helpUrl: v.helpUrl,
              tags: v.tags.filter((t) => t.startsWith('wcag')),
              nodes: v.nodes.length,
              examples: v.nodes.slice(0, 5).map((n) => ({
                target: n.target.join(' '),
                html: n.html.slice(0, 300),
                summary: n.failureSummary?.slice(0, 500) ?? '',
              })),
            })),
          }),
          contentType: 'application/json',
        });
      } catch (error) {
        // A scan problem is reported, not a test failure.
        await testInfo.attach('a11y', {
          body: JSON.stringify({ page: name, error: String(error) }),
          contentType: 'application/json',
        });
      }
    },
    { box: true },
  );
}
