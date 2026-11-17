import { createBrowserRouter } from 'react-router-dom';

import { routes } from './routes';

/** Data router: lazy routes, route errors, navigation state (progress bar), scroll restoration. */
export const router = createBrowserRouter(routes);
