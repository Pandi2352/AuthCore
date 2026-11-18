import type { RouteObject } from 'react-router-dom';

import { featuresConfig, paths } from '@/config';

import { lazyPage, type RouteHandle } from './route-handle';

const handle = (title: string): RouteHandle => ({ title });

/** Sign-in flows for signed-out users (signed-in users are sent home). */
export const guestAuthRoutes: RouteObject[] = [
  {
    path: paths.auth.login,
    handle: handle('Sign in'),
    lazy: lazyPage(() => import('@/features/auth/pages/LoginPage'), 'LoginPage'),
  },
  ...(featuresConfig.auth.allowRegistration
    ? [
        {
          path: paths.auth.register,
          handle: handle('Create account'),
          lazy: lazyPage(() => import('@/features/auth/pages/RegisterPage'), 'RegisterPage'),
        },
      ]
    : []),
  {
    path: paths.auth.forgotPassword,
    handle: handle('Forgot password'),
    lazy: lazyPage(() => import('@/features/auth/pages/ForgotPasswordPage'), 'ForgotPasswordPage'),
  },
  ...(featuresConfig.auth.enableSelfRecovery
    ? [
        {
          path: paths.auth.recovery,
          handle: handle('Reopen account'),
          lazy: lazyPage(
            () => import('@/features/auth/pages/AccountRecoveryPage'),
            'AccountRecoveryPage',
          ),
        },
      ]
    : []),
];

/** Links from emails: work signed in or out. */
export const openAuthRoutes: RouteObject[] = [
  {
    path: paths.auth.verifyEmail,
    handle: handle('Verify email'),
    lazy: lazyPage(() => import('@/features/auth/pages/VerifyEmailPage'), 'VerifyEmailPage'),
  },
  {
    path: paths.auth.resetPassword,
    handle: handle('Reset password'),
    lazy: lazyPage(() => import('@/features/auth/pages/ResetPasswordPage'), 'ResetPasswordPage'),
  },
  ...(featuresConfig.auth.enableInvites
    ? [
        {
          // Works signed in or out: the invite is for whoever has the link.
          path: paths.auth.acceptInvite,
          handle: handle('Accept invite'),
          lazy: lazyPage(
            () => import('@/features/auth/pages/AcceptInvitePage'),
            'AcceptInvitePage',
          ),
        },
      ]
    : []),
];
