import { resolveTarget } from '../../target.mjs';

/** Fails fast, with what to do, when the app under test isn't answering. */
export default async function globalSetup(): Promise<void> {
  const target = resolveTarget();
  try {
    await fetch(target.baseURL, { signal: AbortSignal.timeout(5000) });
  } catch {
    throw new Error(
      target.name === 'test'
        ? `The test environment isn't running (${target.baseURL}). Start it in another terminal: npm run env:test`
        : `Your dev frontend isn't answering at ${target.baseURL}. Start it, or use the test environment (PW_ENV=test).`,
    );
  }
}
