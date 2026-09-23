import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuthPopup } from '../../components/auth/AuthPopup';

export default function Login() {
  const { isAuthenticated, user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.title = 'Sign In | Car Worth';
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
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotModal, setForgotModal] = useState(false);

  // Field validation errors for inline red outlines
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

  const fromPath = (location.state as any)?.from?.pathname;
  const redirectMessage = (location.state as any)?.message;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    setPopupState(prev => ({ ...prev, isOpen: false }));

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setEmailError('Please enter your email address.');
      setPopupState({
        isOpen: true,
        message: 'Please enter your registered email address.',
        code: 'MISSING_EMAIL',
        type: 'warning',
        title: 'Email Required',
        failingInputId: 'login-email',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setEmailError('Please enter a valid email address.');
      setPopupState({
        isOpen: true,
        message: 'Please enter a valid email address (e.g. name@domain.com).',
        code: 'INVALID_FORMAT',
        type: 'warning',
        title: 'Invalid Email Format',
        failingInputId: 'login-email',
      });
      return;
    }

    if (!password) {
      setPasswordError('Please enter your password.');
      setPopupState({
        isOpen: true,
        message: 'Please enter your account password.',
        code: 'MISSING_PASSWORD',
        type: 'warning',
        title: 'Password Required',
        failingInputId: 'login-password',
      });
      return;
    }

    setIsLoading(true);
    try {
      const loggedUser = await login(cleanEmail, password, rememberMe);
      // Redirect based on role unless specific route was requested
      if (fromPath && fromPath !== '/login' && fromPath !== '/register') {
        navigate(fromPath);
      } else if (loggedUser.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      const code = err.code || '';
      const message = err.message || 'Invalid email or password. Please try again.';

      if (code === 'INVALID_EMAIL') {
        setEmailError('Invalid email address');
        setPopupState({
          isOpen: true,
          message: 'No Car Worth account exists with this email address.',
          code: 'INVALID_EMAIL',
          type: 'error',
          title: 'Invalid Email',
          failingInputId: 'login-email',
          actionLink: { text: 'Create an account', to: '/register' },
        });
      } else if (code === 'INVALID_PASSWORD') {
        // Clear ONLY password field, retain email, focus password
        setPassword('');
        setPasswordError('Invalid password');
        setPopupState({
          isOpen: true,
          message: 'The password you entered is incorrect. Please try again.',
          code: 'INVALID_PASSWORD',
          type: 'error',
          title: 'Invalid Password',
          failingInputId: 'login-password',
        });
      } else if (code === 'ACCOUNT_DISABLED') {
        setPopupState({
          isOpen: true,
          message: message || 'Your account has been deactivated. Contact support.',
          code: 'ACCOUNT_DISABLED',
          type: 'error',
          title: 'Account Deactivated',
        });
      } else if (code === 'TOO_MANY_ATTEMPTS') {
        setPopupState({
          isOpen: true,
          message: message || 'Too many failed login attempts. Please try again in 15 minutes.',
          code: 'TOO_MANY_ATTEMPTS',
          type: 'warning',
          title: 'Temporary Security Lockout',
        });
      } else {
        setPopupState({
          isOpen: true,
          message,
          code: code || 'AUTH_ERROR',
          type: 'error',
          title: 'Sign In Failed',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-md w-full"
      >
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="text-center mb-6">
            <Link to="/" className="inline-block mb-3 focus:outline-none group" aria-label="Car Worth Home">
              <img
                src="/logo-full.png"
                alt="Car Worth logo"
                width={80}
                height={76}
                className="h-16 sm:h-20 w-auto mx-auto object-contain drop-shadow-[0_6px_20px_rgba(0,0,0,0.6)] group-hover:scale-105 transition-transform"
              />
            </Link>
            <h1 className="text-2xl font-bold text-white tracking-tight">Sign In</h1>
            <p className="text-sm text-gray-400 mt-1">
              Welcome back to Car Worth Price Intelligence
            </p>
          </div>

          {/* Redirect / Info Message */}
          {redirectMessage && !popupState.isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-5 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm flex items-start gap-2.5"
            >
              <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{redirectMessage}</span>
            </motion.div>
          )}

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
                <label htmlFor="login-email" className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Email Address
                </label>
                {emailError && (
                  <span className="text-xs text-rose-400 font-medium">
                    {emailError}
                  </span>
                )}
              </div>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                placeholder="name@example.com"
                className={`w-full px-4 py-2.5 rounded-xl bg-white/5 border text-sm text-white placeholder-gray-500 focus:outline-none transition-all ${
                  emailError
                    ? 'border-rose-500/60 ring-2 ring-rose-500/20 focus:border-rose-500 focus:ring-rose-500/30'
                    : 'border-white/10 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                }`}
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Password
                </label>
                <div className="flex items-center gap-3">
                  {passwordError && (
                    <span className="text-xs text-rose-400 font-medium">
                      {passwordError}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setForgotModal(true)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder="Enter your password"
                  className={`w-full px-4 py-2.5 pr-11 rounded-xl bg-white/5 border text-sm text-white placeholder-gray-500 focus:outline-none transition-all ${
                    passwordError
                      ? 'border-rose-500/60 ring-2 ring-rose-500/20 focus:border-rose-500 focus:ring-rose-500/30'
                      : 'border-white/10 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2 pt-1">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-white/10 border-white/20 text-emerald-500 focus:ring-emerald-500/40 focus:ring-offset-0 cursor-pointer accent-emerald-500"
              />
              <label htmlFor="rememberMe" className="text-xs text-gray-300 cursor-pointer select-none">
                Remember me on this device
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 shadow-lg shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Links */}
          <div className="mt-6 pt-5 border-t border-white/10 space-y-3 text-center text-xs text-gray-400">
            <div>
              Don't have an account?{' '}
              <Link to="/register" className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2">
                Register now
              </Link>
            </div>
            <div>
              Administrator?{' '}
              <Link to="/admin/login" className="text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2">
                Go to Admin Gateway &rarr;
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {forgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-sm w-full p-6 rounded-2xl bg-gray-900 border border-white/10 shadow-2xl space-y-4"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">Reset Your Password</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                For security, automated password reset emails are dispatched by administrators. Please contact your system administrator or login with an active session to change your password under Settings.
              </p>
              <button
                onClick={() => setForgotModal(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
