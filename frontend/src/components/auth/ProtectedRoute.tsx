import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Authenticating session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const isPredictRoute = location.pathname.startsWith('/predict');
    return (
      <Navigate
        to="/login"
        state={{
          from: location,
          message: isPredictRoute
            ? 'Please sign in to predict your vehicle price'
            : 'Please sign in to access this page',
        }}
        replace
      />
    );
  }

  return <>{children}</>;
}
