import { apiClient } from '@/lib/api';

import type {
  CreateAttributeRequest,
  SchemaAttribute,
  SchemaOptions,
  UpdateAttributeRequest,
} from '../types/user-schema.types';

const BASE = '/user-schema';
const byId = (id: string) => `${BASE}/attributes/${encodeURIComponent(id)}`;

/** User schema variables (USER_SCHEMA_READ / USER_SCHEMA_MANAGE). */
export const userSchemaApi = {
  /** Every variable, flat (children carry parentId); search / filters run in the browser. */
  list: (signal?: AbortSignal) =>
    apiClient.get<SchemaAttribute[]>(`${BASE}/attributes`, { signal, query: { flat: true } }),

  options: (signal?: AbortSignal) => apiClient.get<SchemaOptions>(`${BASE}/options`, { signal }),

  create: (body: CreateAttributeRequest) =>
    apiClient.post<SchemaAttribute>(`${BASE}/attributes`, body),

  update: (id: string, body: UpdateAttributeRequest) =>
    apiClient.patch<SchemaAttribute>(byId(id), body),

  /** Custom variables only; groups must be empty. Removes the value from every user. */
  remove: (id: string) => apiClient.delete<null>(byId(id)),
};
