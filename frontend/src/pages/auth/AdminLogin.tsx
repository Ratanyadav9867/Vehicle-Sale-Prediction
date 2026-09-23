import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuthPopup } from '../../components/auth/AuthPopup';

export default function AdminLogin() {
  const { isAuthenticated, user, adminLogin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Admin Portal | Car Worth';
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Field errors
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // AuthPopup state
  const [popupState, setPopupState] = useState<{
    isOpen: boolean;
    message: string;
    code?: string;
    type?: 'error' | 'warning' | 'success';
    title?: string;
    failingInputId?: string;
    actionLink?: { text: string; to: string };
    autoDismissMs?: number;
  }>({
    isOpen: false,
    message: '',
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    setPopupState(prev => ({ ...prev, isOpen: false }));

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setEmailError('Admin email is required');
      setPopupState({
        isOpen: true,
        message: 'Please enter your administrator email address.',
        code: 'MISSING_EMAIL',
        type: 'warning',
        title: 'Email Required',
        failingInputId: 'admin-email',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setEmailError('Invalid email format');
      setPopupState({
        isOpen: true,
        message: 'Please enter a valid administrator email address.',
        code: 'INVALID_FORMAT',
        type: 'warning',
        title: 'Invalid Email Format',
        failingInputId: 'admin-email',
      });
      return;
    }

    if (!password) {
      setPasswordError('Password is required');
      setPopupState({
        isOpen: true,
        message: 'Please enter your administrator password.',
        code: 'MISSING_PASSWORD',
        type: 'warning',
        title: 'Password Required',
        failingInputId: 'admin-password',
      });
      return;
    }

    setIsLoading(true);
    try {
      await adminLogin(cleanEmail, password);
      navigate('/admin/dashboard');
    } catch (err: any) {
      const code = err.code || '';
      const message = err.message || 'Access denied. Administrator privileges required.';

      if (code === 'INVALID_EMAIL') {
        setEmailError('Invalid admin email');
        setPopupState({
          isOpen: true,
          message: 'No administrator account found with this email address.',
          code: 'INVALID_EMAIL',
          type: 'error',
          title: 'Invalid Admin Email',
          failingInputId: 'admin-email',
        });
      } else if (code === 'INVALID_PASSWORD') {
        setPassword('');
        setPasswordError('Incorrect password');
        setPopupState({
          isOpen: true,
          message: 'The administrator password is incorrect. Please try again.',
          code: 'INVALID_PASSWORD',
          type: 'error',
          title: 'Invalid Password',
          failingInputId: 'admin-password',
        });
      } else if (code === 'ACCESS_DENIED') {
        setPopupState({
          isOpen: true,
          message: 'Access denied. This account does not possess administrator privileges.',
          code: 'ACCESS_DENIED',
          type: 'error',
          title: 'Access Denied',
          actionLink: { text: 'Sign in to user account', to: '/login' },
        });
      } else if (code === 'ACCOUNT_DISABLED') {
        setPopupState({
          isOpen: true,
          message: message || 'Your administrator account has been deactivated.',
          code: 'ACCOUNT_DISABLED',
          type: 'error',
          title: 'Account Deactivated',
        });
      } else if (code === 'TOO_MANY_ATTEMPTS') {
        setPopupState({
          isOpen: true,
          message: message || 'Too many failed attempts. Gateway locked for 15 minutes.',
          code: 'TOO_MANY_ATTEMPTS',
          type: 'warning',
          title: 'Security Lockout',
        });
      } else {
        setPopupState({
          isOpen: true,
          message,
          code: code || 'ADMIN_AUTH_ERROR',
          type: 'error',
          title: 'Authentication Error',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background amber glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-md w-full relative z-10"
      >
        <div className="bg-slate-900/80 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="text-center mb-6">
            <Link to="/" className="inline-block mb-3 focus:outline-none group" aria-label="Car Worth Home">
              <img
                src="/logo-full.png"
                alt="Car Worth logo"
                width={80}
                height={76}
                className="h-16 sm:h-20 w-auto mx-auto object-contain drop-shadow-[0_6px_20px_rgba(245,158,11,0.4)] group-hover:scale-105 transition-transform"
              />
            </Link>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono uppercase tracking-widest mb-2 font-bold mx-auto">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Secure Gateway</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Admin Console</h1>
            <p className="text-sm text-gray-400 mt-1">
              Restricted portal for authorized system administrators
            </p>
          </div>

          {/* Auth Error Popup */}
          <AuthPopup
            isOpen={popupState.isOpen}
            onClose={() => setPopupState(prev => ({ ...prev, isOpen: false }))}
            type={popupState.type}
            title={popupState.title}
            message={popupState.message}
            code={popupState.code}
            failingInputId={popupState.failingInputId}
            actionLink={popupState.actionLink}
            autoDismissMs={5000}
          />

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="admin-email" className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Admin Email Address
                </label>
                {emailError && (
                  <span className="text-xs text-rose-400 font-medium">{emailError}</span>
                )}
              </div>
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                placeholder="admin@carworth.com"
                className={`w-full px-4 py-2.5 rounded-xl bg-white/5 border text-sm text-white placeholder-gray-500 focus:outline-none transition-all ${
                  emailError
                    ? 'border-rose-500/60 ring-2 ring-rose-500/20 focus:border-rose-500 focus:ring-rose-500/30'
                    : 'border-white/10 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30'
                }`}
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="admin-password" className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Master Password
                </label>
                {passwordError && (
                  <span className="text-xs text-rose-400 font-medium">{passwordError}</span>
                )}
              </div>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder="Enter administrator password"
                  className={`w-full px-4 py-2.5 pr-11 rounded-xl bg-white/5 border text-sm text-white placeholder-gray-500 focus:outline-none transition-all ${
                    passwordError
                      ? 'border-rose-500/60 ring-2 ring-rose-500/20 focus:border-rose-500 focus:ring-rose-500/30'
                      : 'border-white/10 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-lg shadow-amber-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <span>Access Admin Console</span>
              )}
            </button>
          </form>

          {/* Links */}
          <div className="mt-6 pt-5 border-t border-white/10 text-center text-xs text-gray-400">
            Standard user?{' '}
            <Link to="/login" className="text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2">
              Go to User Login
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
