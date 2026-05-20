import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// HashRouter (NOT BrowserRouter) is required for Code Apps. The Power Apps host
// owns the URL path (apps.powerapps.com/play/e/<env>/app/<app>/...) so only the
// fragment is reliably owned by the iframe. BrowserRouter 404s on first load
// and on every deep link. Do not change this — see issue #47 and
// .github/instructions/01-scaffold.instructions.md.
import { HashRouter } from 'react-router-dom';
import { App } from './App';
// Required: imports the Tailwind v4 stylesheet so the CSS pipeline emits a
// non-empty chunk. Without this line the app renders but every element is
// unstyled. See issue #48 and .github/instructions/01-scaffold.instructions.md.
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FluentProvider theme={webLightTheme}>
        <HashRouter>
          <App />
        </HashRouter>
      </FluentProvider>
    </QueryClientProvider>
  </StrictMode>,
);
