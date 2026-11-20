import { expect, test } from '@playwright/test';

import { ROUTES } from '../support/constants';

test.describe('Login page @smoke', () => {
  test('shows the sign-in form', async ({ page }) => {
    await page.goto(ROUTES.login);
    await expect(page.getByRole('textbox', { name: /^email/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^password/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  test('asks for the fields before sending', async ({ page }) => {
    await page.goto(ROUTES.login);
    await page.getByRole('button', { name: 'Sign in' }).click();
    // Client-side checks: still on the login page, with a message for the email field.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/enter your (email|email or username)/i).first()).toBeVisible();
  });

  test('signed-out visitors are sent to the login page', async ({ page }) => {
    await page.goto(ROUTES.roles);
    await expect(page).toHaveURL(/\/login/);
  });
});
