import { RouterProvider } from 'react-router';
import { router } from './utils/routes';
import { StoreProvider } from './context/StoreContext';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <RouterProvider router={router} />
      </StoreProvider>
    </AuthProvider>
  );
}
