import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/index.css';

import { App } from '@/app/App';
import { env, getConfigProblems } from '@/config';
import { installGlobalErrorHandlers } from '@/lib/errors';
import { ConfigErrorPage } from '@/pages/ConfigErrorPage';

installGlobalErrorHandlers();

const configProblems = getConfigProblems();
if (configProblems.length > 0) {
  console.error(
    `Configuration problems (src/config/):\n${configProblems.map((p) => `  - ${p}`).join('\n')}`,
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('index.html has no #root element');
}

createRoot(rootElement).render(
  <StrictMode>
    {configProblems.length > 0 && env.isDevelopment ? (
      <ConfigErrorPage problems={configProblems} />
    ) : (
      <App />
    )}
  </StrictMode>,
);
