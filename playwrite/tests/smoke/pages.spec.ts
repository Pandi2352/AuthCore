import { expect, test } from '../support/fixtures';
import { ROUTES } from '../support/constants';
import { checkPage, recordPageLoad } from '../support/page-checks';

/** Every signed-in page with the heading it must show. */
const PAGES: Array<{ path: string; heading: string | RegExp }> = [
  { path: ROUTES.dashboard, heading: /^welcome back, /i },
  { path: ROUTES.users, heading: 'Search users' },
  { path: ROUTES.userCreate, heading: 'Create user' },
  { path: ROUTES.usersBulk, heading: 'Bulk user operations' },
  { path: ROUTES.invites, heading: 'Invite users' },
  { path: ROUTES.roles, heading: 'Roles' },
  { path: ROUTES.groups, heading: 'Groups' },
  { path: ROUTES.auditLog, heading: 'Audit log' },
  { path: ROUTES.activity, heading: 'Activity & sign-ins' },
  { path: ROUTES.schemas, heading: /schemas/i },
  { path: ROUTES.passwordPolicy, heading: 'Password policy' },
  { path: ROUTES.appearance, heading: 'Appearance' },
  { path: ROUTES.business, heading: 'Business settings' },
  { path: ROUTES.storage, heading: 'File storage' },
];

test.describe('Signed-in pages load @smoke @mobile', () => {
  for (const { path, heading } of PAGES) {
    test(`${path} shows "${String(heading)}"`, async ({ app }, testInfo) => {
      // Any uncaught error in the page fails the test.
      const errors: string[] = [];
      const onError = (error: Error) => errors.push(error.message);
      app.page.on('pageerror', onError);
      try {
        const alreadyOpen = new URL(app.page.url()).pathname === path;
        const started = Date.now();
        await app.open(path);
        await expect(app.page).toHaveURL((url) => url.pathname === path);
        await expect(app.page.getByRole('heading', { name: heading }).first()).toBeVisible();
        // Load time only when the test really opened the page (not when it was already open).
        if (!alreadyOpen) await recordPageLoad(testInfo, path, Date.now() - started);
        expect(errors, `page errors on ${path}`).toEqual([]);
        await checkPage(app.page, testInfo, path);
      } finally {
        app.page.off('pageerror', onError);
      }
    });
  }

  test('My profile shows the completion bar', async ({ app }, testInfo) => {
    await app.open(ROUTES.profile);
    await expect(app.page.getByText('Profile completion')).toBeVisible();
    await expect(
      app.page.getByRole('progressbar', { name: 'Profile completion' }),
    ).toBeVisible();
    await checkPage(app.page, testInfo, ROUTES.profile);
  });
});
