import type { ReactNode } from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-amber-500/20 border-t-amber-400 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Verifying administrative credentials...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-gray-900/80 border border-rose-500/30 backdrop-blur-xl shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">403 — Access Denied</h2>
            <p className="text-sm text-gray-400 mt-2">
              Account <span className="text-gray-200 font-semibold">{user?.email}</span> does not have administrative privileges. Only system administrators can access this portal.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Link
              to="/dashboard"
              className="flex-1 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-colors"
            >
              Go to User Dashboard
            </Link>
            <Link
              to="/"
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-500/20"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
