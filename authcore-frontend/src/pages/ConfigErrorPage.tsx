interface ConfigErrorPageProps {
  problems: readonly string[];
}

/**
 * Development only: shown instead of the app when src/config/ has mistakes,
 * so they are fixed before anything else (production logs them instead).
 */
export function ConfigErrorPage({ problems }: ConfigErrorPageProps) {
  return (
    <main className="mx-auto max-w-3xl p-8 font-sans">
      <h1 className="text-2xl font-bold">Configuration problems</h1>
      <p className="mt-2">
        Fix these in <code className="font-mono">src/config/</code>; the page reloads automatically.
      </p>
      <ol className="mt-6 list-decimal space-y-2 pl-6">
        {problems.map((problem) => (
          <li key={problem} className="font-mono text-sm">
            {problem}
          </li>
        ))}
      </ol>
    </main>
  );
}
