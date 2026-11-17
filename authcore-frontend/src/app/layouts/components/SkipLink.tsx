/** First focusable element: jumps keyboard users past the sidebar and navbar. */
export function SkipLink({ target = 'main-content' }: { target?: string }) {
  return (
    <a
      href={`#${target}`}
      className="sr-only cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      style={{ zIndex: 'var(--z-toast)' }}
      onClick={(event) => {
        const main = document.getElementById(target);
        if (!main) return;
        event.preventDefault();
        main.focus();
        main.scrollIntoView();
      }}
    >
      Skip to main content
    </a>
  );
}
