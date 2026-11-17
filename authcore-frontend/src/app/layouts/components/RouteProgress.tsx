import { useNavigation } from 'react-router-dom';

/**
 * Thin bar at the top while a navigation is pending (lazy page chunks, loaders).
 * It fades in only after 150 ms (CSS delay), so fast navigations don't flicker.
 * Visual only: focus moves to the new page's heading when it arrives.
 */
export function RouteProgress() {
  const navigation = useNavigation();
  if (navigation.state === 'idle') return null;
  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 h-0.5 animate-[appear_1ms_150ms_both] overflow-hidden opacity-0"
      style={{ zIndex: 'var(--z-toast)' }}
    >
      <div className="h-full w-full animate-[route-progress_1.2s_ease-out_forwards] bg-primary" />
    </div>
  );
}
