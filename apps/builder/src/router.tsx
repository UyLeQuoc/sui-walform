import { createBrowserRouter } from 'react-router-dom';
import { HomeRoute } from './routes/HomeRoute';
import { FormsRoute } from './routes/FormsRoute';
import { FormEditRoute } from './routes/FormEditRoute';
import { FormPreviewRoute } from './routes/FormPreviewRoute';
import { FormResultsRoute } from './routes/FormResultsRoute';
import { PublicSubmitRoute } from './routes/PublicSubmitRoute';
import { AdminRoute } from './routes/AdminRoute';
import { NotFoundRoute } from './routes/NotFoundRoute';

// Flat routes — ids ride on the ?formId= query string (not path params), so
// existing shared/published links keep working. The catch-all renders the
// shared NotFound.
export const router = createBrowserRouter([
  { path: '/', element: <HomeRoute /> },
  { path: '/forms', element: <FormsRoute /> },
  { path: '/forms/edit', element: <FormEditRoute /> },
  { path: '/forms/preview', element: <FormPreviewRoute /> },
  { path: '/forms/results', element: <FormResultsRoute /> },
  { path: '/f', element: <PublicSubmitRoute /> },
  { path: '/admin', element: <AdminRoute /> },
  { path: '*', element: <NotFoundRoute /> },
]);
