import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import PublicLayout from './components/layout/PublicLayout';
import MobileBottomNav from './components/layout/MobileBottomNav';
import ScrollToTop from './components/common/ScrollToTop';
import PageLoader from './components/common/PageLoader';
import VideoBackground from './components/ui/VideoBackground';
import { batchLogger } from './utils/batchLogger';

// Code-split route components via React.lazy()
const Home = lazy(() => import('./pages/Home'));
const Predict = lazy(() => import('./pages/Predict'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Model = lazy(() => import('./pages/Model'));
const About = lazy(() => import('./pages/About'));
const Support = lazy(() => import('./pages/Support'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Auth Pages
const Register = lazy(() => import('./pages/auth/Register'));
const Login = lazy(() => import('./pages/auth/Login'));
const AdminLogin = lazy(() => import('./pages/auth/AdminLogin'));

// Protected Dashboards & Logs
const ProtectedRoute = lazy(() => import('./components/auth/ProtectedRoute'));
const AdminRoute = lazy(() => import('./components/auth/AdminRoute'));
const UserDashboard = lazy(() => import('./pages/dashboard/UserDashboard'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminLogs = lazy(() => import('./pages/admin/AdminLogs'));
const AdminSupport = lazy(() => import('./pages/admin/AdminSupport'));

// Batched client navigation logger
function NavigationTracker() {
  const location = useLocation();

  useEffect(() => {
    batchLogger.log({
      action_type: 'page_view',
      category: 'navigation',
      description: `Navigated to ${location.pathname}${location.hash || ''}`,
      metadata: {
        pathname: location.pathname,
        hash: location.hash,
      },
    });
  }, [location.pathname, location.hash]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <NavigationTracker />

        {/* Global Persistent Video Background mounted ONCE across entire application */}
        <VideoBackground />

        {/* Mobile-first bottom app navigation */}
        <MobileBottomNav />

        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Layout with continuous background video across public pages */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/market-analysis" element={<Analytics />} />
              <Route path="/analytics" element={<Navigate to="/market-analysis" replace />} />
              <Route path="/model-architecture" element={<Model />} />
              <Route path="/model" element={<Navigate to="/model-architecture" replace />} />
              <Route path="/about" element={<About />} />
              <Route path="/support" element={<Support />} />

              {/* Authentication Entrypoints */}
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin/login" element={<AdminLogin />} />

              {/* 404 Not Found */}
              <Route path="*" element={<NotFound />} />
            </Route>

            {/* Protected Routes (Transparent shell over global background video) */}
            <Route
              path="/predict"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-transparent text-gray-100 flex flex-col selection:bg-emerald-500 selection:text-white pb-20 md:pb-0">
                    <Navbar />
                    <main className="pt-16 flex-1 flex flex-col">
                      <Predict />
                    </main>
                    <Footer />
                  </div>
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-transparent text-gray-100 flex flex-col selection:bg-sky-500 selection:text-white pb-20 md:pb-0">
                    <Navbar />
                    <main className="pt-16 flex-1 flex flex-col">
                      <UserDashboard />
                    </main>
                    <Footer />
                  </div>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/dashboard"
              element={
                <AdminRoute>
                  <div className="min-h-screen bg-transparent text-gray-100 flex flex-col selection:bg-amber-500 selection:text-white pb-20 md:pb-0">
                    <Navbar />
                    <main className="pt-16 flex-1 flex flex-col">
                      <AdminDashboard />
                    </main>
                    <Footer />
                  </div>
                </AdminRoute>
              }
            />

            <Route
              path="/admin/logs"
              element={
                <AdminRoute>
                  <div className="min-h-screen bg-transparent text-gray-100 flex flex-col selection:bg-amber-500 selection:text-white pb-20 md:pb-0">
                    <Navbar />
                    <main className="pt-16 flex-1 flex flex-col">
                      <AdminLogs />
                    </main>
                    <Footer />
                  </div>
                </AdminRoute>
              }
            />

            <Route
              path="/admin/support"
              element={
                <AdminRoute>
                  <div className="min-h-screen bg-transparent text-gray-100 flex flex-col selection:bg-amber-500 selection:text-white pb-20 md:pb-0">
                    <Navbar />
                    <main className="pt-16 flex-1 flex flex-col">
                      <AdminSupport />
                    </main>
                    <Footer />
                  </div>
                </AdminRoute>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
