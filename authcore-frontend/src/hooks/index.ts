/**
 * Generic React hooks (no business logic, no UI). Feature hooks live in features/<x>/hooks;
 * useTheme is in app/theme, useSidebar in app/layouts/sidebar, useAuth / usePermissions in
 * features/auth.
 */
export { useClickOutside } from './useClickOutside';
export { useControllableState } from './useControllableState';
export { useCopyToClipboard } from './useCopyToClipboard';
export { useDebounce, useDebouncedCallback, useDebouncedValue } from './useDebounce';
export { useDisclosure } from './useDisclosure';
export { formatDocumentTitle, useDocumentTitle } from './useDocumentTitle';
export { useEventListener } from './useEventListener';
export { getFocusable, useFocusTrap } from './useFocusTrap';
export { storageKey, useLocalStorage, type UseLocalStorageOptions } from './useLocalStorage';
export {
  BREAKPOINTS,
  useBreakpoint,
  useCurrentBreakpoint,
  useIsTouch,
  useMediaQuery,
  usePrefersReducedMotion,
} from './useMediaQuery';
export { useIsMounted, useMounted } from './useMounted';
export { useOnlineStatus } from './useOnlineStatus';
export {
  computePagination,
  usePagination,
  useUrlPagination,
  type Pagination,
  type UsePaginationOptions,
} from './usePagination';
export { usePrevious } from './usePrevious';
export { useQueryParams } from './useQueryParams';
export { useRequiredParam } from './useRequiredParam';
export { useScrollLock } from './useScrollLock';
