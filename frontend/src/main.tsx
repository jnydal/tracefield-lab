/* eslint-disable react-refresh/only-export-components */
import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { Spinner } from 'flowbite-react';
import { store } from './app/store';
import { router } from './routes';
import { bootstrapAuth } from './features/auth/redux/auth-thunks';
import { AppErrorBoundary } from './routes/app-error-boundary';
import './styles/global.css';      // your tailwind globals

/** Sync OS/localStorage theme to document.documentElement class for Tailwind and Flowbite. */
function initTheme(): void {
  const apply = (isDark: boolean) => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };
  const stored = localStorage.getItem('color-theme');
  if (stored === 'dark') apply(true);
  else if (stored === 'light') apply(false);
  else apply(window.matchMedia('(prefers-color-scheme: dark)').matches);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('color-theme')) apply(e.matches);
  });
}
initTheme();

// Bootstrap auth state on app start
store.dispatch(bootstrapAuth());

// Loading fallback for lazy-loaded routes
function RouterLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="xl" />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <AppErrorBoundary>
        <Suspense fallback={<RouterLoadingFallback />}>
          <RouterProvider router={router} />
        </Suspense>
      </AppErrorBoundary>
    </Provider>
  </StrictMode>,
);
