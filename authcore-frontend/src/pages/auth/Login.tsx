import { Eye, EyeOff, LogIn } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Alert } from '@/components/common/Alert';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { projectConfig } from '@/config/project';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api-client';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const isEmail = identifier.includes('@');
      const payload = isEmail
        ? { email: identifier.trim().toLowerCase(), password, rememberMe }
        : { username: identifier.trim().toLowerCase(), password, rememberMe };

      const res = await login(payload);

      if (res.isPasswordChangeRequired || res.user.mustChangePassword) {
        navigate('/security', {
          state: { message: 'You must change your password before continuing.' },
        });
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'AUTH_EMAIL_NOT_VERIFIED') {
          navigate('/verify-email', {
            state: { email: identifier.trim().toLowerCase() },
          });
          return;
        }
        setError(err.message);
      } else {
        setError('Unable to sign in. Please check your credentials and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 py-12 sm:px-6 lg:px-8">
      <div className="text-center sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-black text-white shadow-md">
          {projectConfig.name.charAt(0)}
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Sign in to {projectConfig.name}
        </h2>
        <p className="mt-2 text-sm text-slate-500">Reusable authentication & access management</p>
      </div>

      <div className="mt-8 px-4 sm:mx-auto sm:w-full sm:max-w-md sm:px-0">
        <Card className="border-slate-200 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

            <Input
              label="Email or Username"
              type="text"
              required
              autoComplete="username"
              placeholder="e.g. jane.doe@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />

            <div className="space-y-1">
              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-[34px] right-3 text-slate-400 transition-colors hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex cursor-pointer items-center text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2">Remember me (30 days)</span>
                </label>

                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <Button type="submit" variant="primary" className="w-full py-2.5" isLoading={isLoading}>
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Button>
          </form>

          {projectConfig.features.allowRegistration && (
            <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-indigo-600 hover:text-indigo-500 hover:underline"
              >
                Sign up
              </Link>
            </div>
          )}

          {projectConfig.features.enableSelfRecovery && (
            <div className="mt-2 text-center text-xs text-slate-500">
              Closed or deactivated account?{' '}
              <Link to="/recovery" className="font-medium text-slate-700 hover:underline">
                Recover account
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
