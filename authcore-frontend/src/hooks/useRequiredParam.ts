import { useParams } from 'react-router-dom';

/**
 * Typed access to a dynamic route segment, e.g. for `/admin/users/:id`:
 *   const id = useRequiredParam('id');
 * Throws (→ route error page) when the param is missing, so callers get a `string`.
 */
export function useRequiredParam<K extends string>(name: K): string {
  const params: Record<string, string | undefined> = useParams();
  const value = params[name];
  if (!value) throw new Error(`Route parameter ":${name}" is missing`);
  return value;
}
