import { RouterProvider } from 'react-router';
import { router } from './utils/routes';
import { StoreProvider } from './context/StoreContext';

export default function App() {
  return (
    <StoreProvider>
      <RouterProvider router={router} />
    </StoreProvider>
  );
}
