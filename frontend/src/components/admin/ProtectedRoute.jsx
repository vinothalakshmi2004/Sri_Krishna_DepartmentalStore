import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PageLoader from '../ui/Loader';

/** Only lets logged-in admins through; everyone else goes to the login page. */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <PageLoader fullScreen label="Checking your session..." />;
  if (!isAuthenticated) return <Navigate to="/admin/login" replace state={{ from: location }} />;
  return children;
}
