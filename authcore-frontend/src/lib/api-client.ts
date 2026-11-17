import { projectConfig } from '@/config/project';
import type { ApiErrorResponse, ApiResponse } from '@/types/api';

export class ApiError extends Error {
  statusCode: number;
  code: string;
  errors?: Array<{ field?: string; message: string }>;
  raw: ApiErrorResponse;

  constructor(response: ApiErrorResponse) {
    super(response.message || 'An unexpected error occurred');
    this.name = 'ApiError';
    this.statusCode = response.statusCode;
    this.code = response.code;
    this.errors = response.errors;
    this.raw = response;
  }
}

type RefreshCallback = (token: string | null) => void;

class ApiClient {
  private baseUrl: string = projectConfig.apiBaseUrl;
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
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    if (this.accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
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

            headers.set('Authorization', `Bearer ${newAccessToken}`);
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
                headers.set('Authorization', `Bearer ${token}`);
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
                    code: 'AUTH_SESSION_EXPIRED',
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
          code: 'HTTP_ERROR',
          statusCode: response.status,
          timestamp: new Date().toISOString(),
          path: endpoint,
        };
        throw new ApiError(errorData);
      }

      return data as ApiResponse<T>;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError({
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
        code: 'NETWORK_ERROR',
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
