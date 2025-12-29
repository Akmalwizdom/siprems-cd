import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './utils/routes';
import { StoreProvider } from './context/StoreContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/toast';

// Configure QueryClient with optimal caching defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes
      gcTime: 30 * 60 * 1000,   // Cache garbage collected after 30 minutes
      refetchOnWindowFocus: true, // Refetch when user returns to tab
      retry: 1,                 // Retry failed requests once
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StoreProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </StoreProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

