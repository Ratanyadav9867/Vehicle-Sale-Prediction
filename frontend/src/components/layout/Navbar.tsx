import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { InstallAppButton } from '../common/InstallAppButton';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const PUBLIC_NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Home',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    to: '/market-analysis',
    label: 'Market Analysis',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    to: '/model-architecture',
    label: 'Model Architecture',
    icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  },
  {
    to: '/about',
    label: 'About Project',
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const burgerButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close drawer on Escape key and handle focus trapping
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (drawerOpen) {
          setDrawerOpen(false);
          burgerButtonRef.current?.focus();
        }
        if (dropdownOpen) {
          setDropdownOpen(false);
        }
        return;
      }

      // Focus trapping inside drawer
      if (drawerOpen && e.key === 'Tab' && drawerRef.current) {
        const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen, dropdownOpen]);

  // Trap focus to close button when drawer opens and prevent background scrolling
  useEffect(() => {
    if (drawerOpen) {
      closeButtonRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const handleLogout = async () => {
    setDropdownOpen(false);
    setDrawerOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 bg-gray-950/90 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/30 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4 select-none">
          {/* LEFT: Burger Menu + Brand Logo (Car Worth) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Burger Button */}
            <button
              ref={burgerButtonRef}
              onClick={() => setDrawerOpen(true)}
              aria-label="Open Navigation Menu"
              aria-expanded={drawerOpen}
              aria-controls="slideout-sidebar"
              className="p-2.5 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Logo -> Car Worth linking to "/" */}
            <Link
              to="/"
              className="flex items-center gap-2 sm:gap-2.5 group cursor-pointer text-left focus:outline-none min-h-[44px]"
              aria-label="Car Worth Home"
            >
              {/* Responsive Logo: full emblem on normal viewports, compact mark on ultra-small <=360px */}
              <img
                src="/logo-header.png"
                alt="Car Worth logo"
                width={44}
                height={42}
                className="h-9 sm:h-11 w-auto object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
              />
              <div className="hidden min-[380px]:flex flex-col justify-center">
                <span className="text-sm sm:text-lg font-black tracking-tight text-white group-hover:text-amber-300 transition-colors leading-tight">
                  Car Worth
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-semibold tracking-widest uppercase">
                  Valuation AI
                </span>
              </div>
            </Link>
          </div>

          {/* CENTER: Desktop NavLinks shown ONLY when LOGGED OUT */}
          {!isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1">
              {PUBLIC_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'text-sky-400 bg-sky-500/10 border border-sky-500/20 shadow-sm'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}

          {/* RIGHT: Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {!isAuthenticated ? (
              /* Logged-out Auth Entrypoints */
              <>
                <Link
                  to="/login"
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 rounded-lg shadow-md shadow-sky-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  Register
                </Link>
              </>
            ) : (
              /* Logged-in Header: ONLY Primary 'Predict Price' button + Avatar dropdown */
              <>
                <Link
                  to="/predict"
                  className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 rounded-xl shadow-md shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  aria-label="Predict Vehicle Price"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="hidden min-[350px]:inline">Predict Price</span>
                  <span className="inline min-[350px]:hidden">Predict</span>
                </Link>

                {/* User Avatar Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen((o) => !o)}
                    aria-expanded={dropdownOpen}
                    aria-haspopup="true"
                    aria-label="User Profile Menu"
                    className="flex items-center gap-2 p-1 sm:p-1.5 sm:pr-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  >
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-xs uppercase shadow-inner">
                      {user?.name ? user.name.slice(0, 2) : 'U'}
                    </div>
                    <div className="text-left hidden md:block">
                      <p className="text-xs font-semibold text-white leading-tight truncate max-w-[110px]">
                        {user?.name}
                      </p>
                      <p className="text-[10px] text-amber-400 font-medium capitalize">
                        {user?.role}
                      </p>
                    </div>
                    <svg
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 transition-transform duration-200 ${
                        dropdownOpen ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {dropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-56 rounded-xl bg-gray-900/95 border border-white/15 backdrop-blur-2xl shadow-2xl py-2 z-50 divide-y divide-white/10"
                      >
                        {/* User Info Header */}
                        <div className="px-4 py-2.5">
                          <p className="text-xs text-gray-400">Signed in as</p>
                          <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                          <span
                            className={`inline-block mt-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                              isAdmin
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            }`}
                          >
                            {user?.role}
                          </span>
                        </div>

                        {/* Dropdown Items: Dashboard, Profile, Logout */}
                        <div className="py-1">
                          <Link
                            to={isAdmin ? '/admin/dashboard' : '/dashboard'}
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                            Dashboard
                          </Link>

                          <Link
                            to={isAdmin ? '/admin/dashboard#profile' : '/dashboard#profile'}
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Profile
                          </Link>
                        </div>

                        {/* Logout Option */}
                        <div className="py-1">
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors text-left cursor-pointer"
                          >
                            <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Sign Out
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Slide-in Left Drawer with Focus Trap and ARIA support */}
      <AnimatePresence>
        {drawerOpen && (
          <div
            className="fixed inset-0 z-50 flex"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation drawer"
          >
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Slide-in Drawer Container */}
            <motion.div
              ref={drawerRef}
              id="slideout-sidebar"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="relative w-80 max-w-[85vw] bg-gray-950 border-r border-white/10 backdrop-blur-2xl z-50 flex flex-col shadow-2xl h-full"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <Link
                  to="/"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-2.5 group cursor-pointer focus:outline-none"
                  aria-label="Car Worth Home"
                >
                  <img
                    src="/logo-header.png"
                    alt="Car Worth logo"
                    width={36}
                    height={34}
                    className="h-[36px] w-auto object-contain drop-shadow-md"
                  />
                  <div className="flex flex-col justify-center">
                    <span className="text-base font-black tracking-tight text-white leading-tight">
                      Car Worth
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">
                      Valuation AI
                    </span>
                  </div>
                </Link>

                {/* Close Button */}
                <button
                  ref={closeButtonRef}
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close Navigation Menu"
                  className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50 cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Drawer Links */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* 1. Public Pages (accessible in both states) */}
                <div>
                  <p className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Main Navigation
                  </p>
                  <nav className="space-y-1">
                    {PUBLIC_NAV_ITEMS.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        onClick={() => setDrawerOpen(false)}
                        className={({ isActive }) =>
                          `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                            isActive
                              ? 'text-sky-400 bg-sky-500/10 border border-sky-500/20 font-semibold shadow-sm'
                              : 'text-gray-300 hover:text-white hover:bg-white/10'
                          }`
                        }
                      >
                        <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={item.icon} />
                        </svg>
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                    {/* Support — visible to everyone */}
                    <NavLink
                      to="/support"
                      onClick={() => setDrawerOpen(false)}
                      className={({ isActive }) =>
                        `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? 'text-sky-400 bg-sky-500/10 border border-sky-500/20 font-semibold shadow-sm'
                            : 'text-gray-300 hover:text-white hover:bg-white/10'
                        }`
                      }
                    >
                      <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Support</span>
                    </NavLink>
                  </nav>
                </div>

                {/* 2. User Workspace (Home, Market Analysis, Model Architecture, About Project, Dashboard, Predict Price, My Predictions, Profile) */}
                {isAuthenticated && (
                  <div>
                    <p className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      User Workspace
                    </p>
                    <div className="space-y-1">
                      <NavLink
                        to="/predict"
                        onClick={() => setDrawerOpen(false)}
                        className={({ isActive }) =>
                          `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                            isActive
                              ? 'text-emerald-300 bg-emerald-500/20 border border-emerald-500/30'
                              : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20'
                          }`
                        }
                      >
                        <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Predict Price</span>
                      </NavLink>

                      <NavLink
                        to={isAdmin ? '/admin/dashboard' : '/dashboard'}
                        end
                        onClick={() => setDrawerOpen(false)}
                        className={({ isActive }) =>
                          `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                            isActive
                              ? 'text-white bg-white/15'
                              : 'text-gray-300 hover:text-white hover:bg-white/10'
                          }`
                        }
                      >
                        <svg className="w-5 h-5 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                        <span>Dashboard</span>
                      </NavLink>

                      <Link
                        to={isAdmin ? '/admin/dashboard#predictions' : '/dashboard#history'}
                        onClick={() => setDrawerOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <svg className="w-5 h-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>My Predictions</span>
                      </Link>

                      <Link
                        to={isAdmin ? '/admin/dashboard#profile' : '/dashboard#profile'}
                        onClick={() => setDrawerOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>Profile</span>
                      </Link>
                    </div>
                  </div>
                )}

                {/* 3. Admin Section: Admin Dashboard, Users, Activity Logs, All Predictions */}
                {isAdmin && (
                  <div className="pt-2 border-t border-white/10">
                    <div className="px-3 flex items-center justify-between mb-2">
                      <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                        Admin Controls
                      </p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase font-mono">
                        Superuser
                      </span>
                    </div>
                    <div className="space-y-1">
                      <NavLink
                        to="/admin/dashboard"
                        end
                        onClick={() => setDrawerOpen(false)}
                        className={({ isActive }) =>
                          `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                            isActive
                              ? 'text-amber-300 bg-amber-500/20 border border-amber-500/30'
                              : 'text-gray-300 hover:text-white hover:bg-white/10'
                          }`
                        }
                      >
                        <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span>Admin Dashboard</span>
                      </NavLink>

                      <Link
                        to="/admin/dashboard#users"
                        onClick={() => setDrawerOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <svg className="w-5 h-5 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span>Users</span>
                      </Link>

                      <NavLink
                        to="/admin/logs"
                        onClick={() => setDrawerOpen(false)}
                        className={({ isActive }) =>
                          `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                            isActive
                              ? 'text-amber-300 bg-amber-500/20 border border-amber-500/30 font-semibold'
                              : 'text-gray-300 hover:text-white hover:bg-white/10'
                          }`
                        }
                      >
                        <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Activity Logs</span>
                      </NavLink>

                      <Link
                        to="/admin/dashboard#predictions"
                        onClick={() => setDrawerOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>All Predictions</span>
                      </Link>

                      <NavLink
                        to="/admin/support"
                        onClick={() => setDrawerOpen(false)}
                        className={({ isActive }) =>
                          `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                            isActive
                              ? 'text-amber-300 bg-amber-500/20 border border-amber-500/30 font-semibold'
                              : 'text-gray-300 hover:text-white hover:bg-white/10'
                          }`
                        }
                      >
                        <svg className="w-5 h-5 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Support Inbox</span>
                      </NavLink>
                    </div>
                  </div>
                )}

                {/* 4. Application Installation (Authenticated Users & Admins) */}
                {isAuthenticated && (
                  <div className="pt-2 border-t border-white/10">
                    <p className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Application
                    </p>
                    <InstallAppButton
                      variant="drawer"
                      onInstalledClick={() => setDrawerOpen(false)}
                    />
                  </div>
                )}

                {/* 5. Visitor Quick Portals */}
                {!isAuthenticated && (
                  <div className="pt-2 border-t border-white/10">
                    <p className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Portal Access
                    </p>
                    <div className="space-y-1">
                      <Link
                        to="/login"
                        onClick={() => setDrawerOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        <span>User Sign In</span>
                      </Link>
                      <Link
                        to="/register"
                        onClick={() => setDrawerOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        <span>Create Account</span>
                      </Link>
                      <Link
                        to="/admin/login"
                        onClick={() => setDrawerOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span>Admin Gateway</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer / User Status */}
              <div className="p-4 border-t border-white/10 bg-black/40">
                {isAuthenticated ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs uppercase">
                        {user?.name?.slice(0, 2) || 'U'}
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-semibold text-white leading-tight truncate max-w-[130px]">{user?.name}</p>
                        <p className="text-[10px] text-gray-400 capitalize">{user?.role} Account</p>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="text-xs text-rose-400 hover:text-rose-300 p-2 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Sign Out"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Link
                      to="/login"
                      onClick={() => setDrawerOpen(false)}
                      className="w-full block py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 shadow-md shadow-sky-500/20 transition-all text-center cursor-pointer"
                    >
                      Sign In to Predict Price
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
