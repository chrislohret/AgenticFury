import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ThemeProvider } from './providers/theme-provider';
// Required: imports the Tailwind v4 stylesheet so the CSS pipeline emits a
// non-empty chunk. Without this line the app renders but every element is
// unstyled. See issue #48 and .github/instructions/01-scaffold.instructions.md.
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FluentProvider theme={webLightTheme}>
        <ThemeProvider defaultTheme="mount-sinai" storageKey="app-theme">
          <RouterProvider router={router} />
        </ThemeProvider>
      </FluentProvider>
    </QueryClientProvider>
  </StrictMode>,
);
