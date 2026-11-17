import { env } from '@/config';

import { CLIENT_ERROR_CODES } from '../constants/error-codes';
import { HTTP_HEADERS } from '../constants/http';
import { ApiError } from './api-error';
import type { ApiErrorResponse, ApiResponse } from './types';

type RefreshCallback = (token: string | null) => void;

class ApiClient {
  private baseUrl: string = env.apiBaseUrl;
  private accessToken: string | null = null;
  private isRefreshing = false;
  private refreshSubscribers: RefreshCallback[] = [];
  private onUnauthorizedCallback: (() => void) | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setOnUnauthorized(callback: () => void) {
    this.onUnauthorizedCallback = callback;
  }

  private subscribeTokenRefresh(cb: RefreshCallback) {
    this.refreshSubscribers.push(cb);
  }

  private onRefreshed(token: string | null) {
    this.refreshSubscribers.forEach((cb) => cb(token));
    this.refreshSubscribers = [];
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false,
  ): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers = new Headers(options.headers);
    if (!headers.has(HTTP_HEADERS.CONTENT_TYPE) && !(options.body instanceof FormData)) {
      headers.set(HTTP_HEADERS.CONTENT_TYPE, 'application/json');
    }

    if (this.accessToken && !headers.has(HTTP_HEADERS.AUTHORIZATION)) {
      headers.set(HTTP_HEADERS.AUTHORIZATION, `Bearer ${this.accessToken}`);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // sends refresh cookie
      });

      // Handle 401 Unauthorized for token refresh
      if (
        response.status === 401 &&
        !isRetry &&
        !endpoint.includes('/auth/login') &&
        !endpoint.includes('/auth/refresh')
      ) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;

          try {
            const refreshRes = await this.post<{ accessToken: string }>('/auth/refresh');
            const newAccessToken = refreshRes.data.accessToken;
            this.setAccessToken(newAccessToken);
            this.isRefreshing = false;
            this.onRefreshed(newAccessToken);

            headers.set(HTTP_HEADERS.AUTHORIZATION, `Bearer ${newAccessToken}`);
            return this.request<T>(endpoint, { ...options, headers }, true);
          } catch (refreshErr) {
            this.isRefreshing = false;
            this.onRefreshed(null);
            this.setAccessToken(null);
            if (this.onUnauthorizedCallback) {
              this.onUnauthorizedCallback();
            }
            throw refreshErr;
          }
        } else {
          // Another request is currently refreshing the token; wait for it
          return new Promise<ApiResponse<T>>((resolve, reject) => {
            this.subscribeTokenRefresh(async (token) => {
              if (token) {
                headers.set(HTTP_HEADERS.AUTHORIZATION, `Bearer ${token}`);
                try {
                  const res = await this.request<T>(endpoint, { ...options, headers }, true);
                  resolve(res);
                } catch (err) {
                  reject(err);
                }
              } else {
                reject(
                  new ApiError({
                    success: false,
                    message: 'Session expired',
                    code: CLIENT_ERROR_CODES.AUTH_SESSION_EXPIRED,
                    statusCode: 401,
                    timestamp: new Date().toISOString(),
                    path: endpoint,
                  }),
                );
              }
            });
          });
        }
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorData: ApiErrorResponse = data || {
          success: false,
          message: response.statusText || 'Request failed',
          code: CLIENT_ERROR_CODES.HTTP_ERROR,
          statusCode: response.status,
          timestamp: new Date().toISOString(),
          path: endpoint,
        };
        throw new ApiError(errorData, response.headers.get(HTTP_HEADERS.REQUEST_ID) ?? undefined);
      }

      return data as ApiResponse<T>;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError({
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
        code: CLIENT_ERROR_CODES.NETWORK_ERROR,
        statusCode: 0,
        timestamp: new Date().toISOString(),
        path: endpoint,
      });
    }
  }

  get<T>(endpoint: string, options?: RequestInit) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: unknown, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: RequestInit) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
