import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { GuestRoute } from '@/components/auth/GuestRoute';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Layout } from '@/components/common/Layout';
import { paths } from '@/config';
import { Activity } from '@/pages/account/Activity';
import { Profile } from '@/pages/account/Profile';
import { Security } from '@/pages/account/Security';
import { Sessions } from '@/pages/account/Sessions';
import { AccountRecovery } from '@/pages/auth/AccountRecovery';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { Login } from '@/pages/auth/Login';
import { Register } from '@/pages/auth/Register';
import { ResetPassword } from '@/pages/auth/ResetPassword';
import { VerifyEmail } from '@/pages/auth/VerifyEmail';
import { Dashboard } from '@/pages/dashboard/Dashboard';
import { NotFound } from '@/pages/NotFound';

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path={paths.root} element={<Navigate to={paths.dashboard} replace />} />

      {/* Guest / Public Auth Routes */}
      <Route
        path={paths.auth.login}
        element={
          <GuestRoute>
            <Login />
          </GuestRoute>
        }
      />
      <Route
        path={paths.auth.register}
        element={
          <GuestRoute>
            <Register />
          </GuestRoute>
        }
      />
      <Route path={paths.auth.verifyEmail} element={<VerifyEmail />} />
      <Route
        path={paths.auth.forgotPassword}
        element={
          <GuestRoute>
            <ForgotPassword />
          </GuestRoute>
        }
      />
      <Route path={paths.auth.resetPassword} element={<ResetPassword />} />
      <Route
        path={paths.auth.recovery}
        element={
          <GuestRoute>
            <AccountRecovery />
          </GuestRoute>
        }
      />

      {/* Protected App Routes */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path={paths.dashboard} element={<Dashboard />} />
        <Route path={paths.account.profile} element={<Profile />} />
        <Route path={paths.account.security} element={<Security />} />
        <Route path={paths.account.sessions} element={<Sessions />} />
        <Route path={paths.account.activity} element={<Activity />} />
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
