import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function MobileBottomNav() {
  const location = useLocation();
  const { isAuthenticated, isAdmin } = useAuth();

  const currentPath = location.pathname;

  const dashboardTarget = isAuthenticated
    ? (isAdmin ? '/admin/dashboard' : '/dashboard')
    : '/login';

  const isPredictActive = currentPath === '/predict';
  const isHomeActive = currentPath === '/';
  const isMarketActive = currentPath === '/market-analysis' || currentPath === '/analytics';
  const isDashboardActive = currentPath.startsWith('/dashboard') || currentPath.startsWith('/admin');
  const isSupportActive = currentPath === '/support' || currentPath === '/about';

  return (
    <nav
      aria-label="Mobile app navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-950/90 backdrop-blur-2xl border-t border-white/10 select-none pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_30px_rgba(0,0,0,0.7)]"
    >
      <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto px-1">
        {/* Tab 1: Home */}
        <Link
          to="/"
          className={`flex flex-col items-center justify-center h-full min-h-[44px] gap-1 transition-all active:scale-95 ${
            isHomeActive ? 'text-emerald-400 font-semibold' : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-current={isHomeActive ? 'page' : undefined}
        >
          <div className="relative">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isHomeActive ? 2.5 : 2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {isHomeActive && (
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            )}
          </div>
          <span className="text-[10px] tracking-tight">Home</span>
        </Link>

        {/* Tab 2: Market Analysis */}
        <Link
          to="/market-analysis"
          className={`flex flex-col items-center justify-center h-full min-h-[44px] gap-1 transition-all active:scale-95 ${
            isMarketActive ? 'text-emerald-400 font-semibold' : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-current={isMarketActive ? 'page' : undefined}
        >
          <div className="relative">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isMarketActive ? 2.5 : 2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            {isMarketActive && (
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            )}
          </div>
          <span className="text-[10px] tracking-tight">Market</span>
        </Link>

        {/* Tab 3: Center Elevated Primary Action - Valuation (Predict) */}
        <div className="flex justify-center items-center h-full">
          <Link
            to="/predict"
            className="flex flex-col items-center justify-center -translate-y-3 transition-transform active:scale-90"
            aria-label="Predict vehicle valuation"
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg border transition-all ${
                isPredictActive
                  ? 'bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 text-gray-950 border-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.6)]'
                  : 'bg-gradient-to-tr from-emerald-600 to-teal-600 text-white border-white/20 shadow-emerald-950/60'
              }`}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-[10px] font-bold text-emerald-400 mt-1">Value</span>
          </Link>
        </div>

        {/* Tab 4: Dashboard / Account */}
        <Link
          to={dashboardTarget}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] gap-1 transition-all active:scale-95 ${
            isDashboardActive ? 'text-emerald-400 font-semibold' : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-current={isDashboardActive ? 'page' : undefined}
        >
          <div className="relative">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isDashboardActive ? 2.5 : 2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            {isDashboardActive && (
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            )}
          </div>
          <span className="text-[10px] tracking-tight">{isAuthenticated ? 'Dashboard' : 'Sign In'}</span>
        </Link>

        {/* Tab 5: Support */}
        <Link
          to="/support"
          className={`flex flex-col items-center justify-center h-full min-h-[44px] gap-1 transition-all active:scale-95 ${
            isSupportActive ? 'text-emerald-400 font-semibold' : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-current={isSupportActive ? 'page' : undefined}
        >
          <div className="relative">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isSupportActive ? 2.5 : 2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            {isSupportActive && (
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            )}
          </div>
          <span className="text-[10px] tracking-tight">Support</span>
        </Link>
      </div>
    </nav>
  );
}
