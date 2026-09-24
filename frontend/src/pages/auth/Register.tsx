import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuthPopup } from '../../components/auth/AuthPopup';

const COMMON_PASSWORDS = new Set([
  'password', 'password123', '12345678', 'qwerty123', 'admin123', 'welcome123', 'letmein123', 'carworth123'
]);

export default function Register() {
  const { isAuthenticated, user, register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Register | Car Worth';
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

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirm_password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  // Password criteria analysis
  const passwordRules = useMemo(() => {
    const pwd = formData.password;
    const hasMinLength = pwd.length >= 8 && pwd.length <= 72;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasDigit = /\d/.test(pwd);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);
    const isCommon = COMMON_PASSWORDS.has(pwd.toLowerCase());

    const score = (hasMinLength ? 1 : 0) + ((hasUpper && hasLower) ? 1 : 0) + (hasDigit ? 1 : 0) + (hasSpecial ? 1 : 0);

    let strengthLabel = 'Too weak';
    let strengthColor = 'bg-rose-500';
    let textColor = 'text-rose-400';

    if (score === 2) {
      strengthLabel = 'Fair';
      strengthColor = 'bg-amber-500';
      textColor = 'text-amber-400';
    } else if (score === 3) {
      strengthLabel = 'Good';
      strengthColor = 'bg-sky-500';
      textColor = 'text-sky-400';
    } else if (score === 4 && !isCommon) {
      strengthLabel = 'Strong';
      strengthColor = 'bg-emerald-500';
      textColor = 'text-emerald-400';
    }

    return {
      hasMinLength,
      hasUpperLower: hasUpper && hasLower,
      hasDigit,
      hasSpecial,
      isCommon,
      score,
      strengthLabel,
      strengthColor,
      textColor,
    };
  }, [formData.password]);

  const validate = () => {
    const errs: Record<string, string> = {};
    const nameTrimmed = formData.name.trim();

    if (!nameTrimmed) {
      errs.name = 'Full name is required.';
    } else if (nameTrimmed.length < 2 || nameTrimmed.length > 60) {
      errs.name = 'Full name must be between 2 and 60 characters.';
    }

    const emailTrimmed = formData.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailTrimmed) {
      errs.email = 'Email address is required.';
    } else if (!emailRegex.test(emailTrimmed)) {
      errs.email = 'Please provide a valid email format (e.g. user@example.com).';
    }

    if (!formData.password) {
      errs.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      errs.password = 'Password must be at least 8 characters long.';
    } else if (passwordRules.isCommon) {
      errs.password = 'This password is too common. Please choose a more secure password.';
    } else if (passwordRules.score < 4) {
      errs.password = 'Password must meet all complexity requirements.';
    }

    if (!formData.confirm_password) {
      errs.confirm_password = 'Password confirmation is required.';
    } else if (formData.password !== formData.confirm_password) {
      errs.confirm_password = 'Passwords do not match.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPopupState(prev => ({ ...prev, isOpen: false }));

    if (!validate()) {
      // Find first failing field to focus and alert
      if (!formData.name.trim() || formData.name.trim().length < 2) {
        setPopupState({
          isOpen: true,
          message: 'Please enter your full name (2–60 characters).',
          code: 'INVALID_NAME',
          type: 'warning',
          failingInputId: 'reg-name',
        });
      } else if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        setPopupState({
          isOpen: true,
          message: 'Please provide a valid email address.',
          code: 'INVALID_EMAIL',
          type: 'warning',
          failingInputId: 'reg-email',
        });
      } else if (passwordRules.score < 4) {
        setPopupState({
          isOpen: true,
          message: 'Password does not meet the security checklist below.',
          code: 'WEAK_PASSWORD',
          type: 'warning',
          failingInputId: 'reg-password',
        });
      } else if (formData.password !== formData.confirm_password) {
        setPopupState({
          isOpen: true,
          message: 'Passwords do not match. Please re-enter your password confirmation.',
          code: 'PASSWORD_MISMATCH',
          type: 'warning',
          failingInputId: 'reg-confirm-password',
        });
      }
      return;
    }

    setIsLoading(true);
    try {
      await register(
        formData.name.trim(),
        formData.email.trim().toLowerCase(),
        formData.password,
        formData.confirm_password
      );

      setPopupState({
        isOpen: true,
        type: 'success',
        title: 'Account Created',
        message: 'Account created. Welcome to Car Worth.',
        autoDismissMs: 3000,
      });

      setTimeout(() => {
        navigate('/dashboard');
      }, 900);
    } catch (err: any) {
      const code = err.code || '';
      const message = err.message || 'Registration failed. Please check your details.';

      if (code === 'EMAIL_EXISTS') {
        setFieldErrors(prev => ({ ...prev, email: 'This email is already registered' }));
        setPopupState({
          isOpen: true,
          title: 'Email Already Registered',
          message: 'This email is already registered with an active account.',
          code: 'EMAIL_EXISTS',
          type: 'error',
          failingInputId: 'reg-email',
          actionLink: { text: 'Sign in instead', to: '/login' },
        });
      } else if (code === 'TOO_MANY_ATTEMPTS') {
        setPopupState({
          isOpen: true,
          title: 'Too Many Attempts',
          message: message || 'Too many attempts. Please try again in 15 minutes.',
          code: 'TOO_MANY_ATTEMPTS',
          type: 'warning',
        });
      } else {
        setPopupState({
          isOpen: true,
          title: 'Registration Error',
          message,
          code: code || 'REG_FAILED',
          type: 'error',
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
        {/* Card */}
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
            <h1 className="text-2xl font-bold text-white tracking-tight">Create an Account</h1>
            <p className="text-sm text-gray-400 mt-1">
              Join Car Worth for saved predictions and valuation history
            </p>
          </div>

          {/* Auth Error / Success Popup */}
          <AuthPopup
            isOpen={popupState.isOpen}
            onClose={() => setPopupState(prev => ({ ...prev, isOpen: false }))}
            type={popupState.type}
            title={popupState.title}
            message={popupState.message}
            code={popupState.code}
            failingInputId={popupState.failingInputId}
            actionLink={popupState.actionLink}
            autoDismissMs={popupState.type === 'success' ? 3000 : 5000}
          />

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Full Name */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="reg-name" className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Full Name
                </label>
                {fieldErrors.name && (
                  <span className="text-xs text-rose-400 font-medium">{fieldErrors.name}</span>
                )}
              </div>
              <input
                id="reg-name"
                type="text"
                required
                value={formData.name}
                onChange={e => {
                  setFormData({ ...formData, name: e.target.value });
                  if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: '' }));
                }}
                placeholder="John Doe"
                className={`w-full min-h-[48px] px-4 py-3 rounded-xl bg-white/5 border text-base sm:text-sm text-white placeholder-gray-500 focus:outline-none transition-all ${
                  fieldErrors.name
                    ? 'border-rose-500/60 ring-2 ring-rose-500/20 focus:border-rose-500 focus:ring-rose-500/30'
                    : 'border-white/10 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                }`}
              />
            </div>

            {/* Email Address */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="reg-email" className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Email Address
                </label>
                {fieldErrors.email && (
                  <span className="text-xs text-rose-400 font-medium">{fieldErrors.email}</span>
                )}
              </div>
              <input
                id="reg-email"
                type="email"
                required
                value={formData.email}
                onChange={e => {
                  setFormData({ ...formData, email: e.target.value });
                  if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                }}
                placeholder="name@example.com"
                className={`w-full min-h-[48px] px-4 py-3 rounded-xl bg-white/5 border text-base sm:text-sm text-white placeholder-gray-500 focus:outline-none transition-all ${
                  fieldErrors.email
                    ? 'border-rose-500/60 ring-2 ring-rose-500/20 focus:border-rose-500 focus:ring-rose-500/30'
                    : 'border-white/10 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                }`}
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="reg-password" className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Password
                </label>
                {fieldErrors.password && (
                  <span className="text-xs text-rose-400 font-medium">{fieldErrors.password}</span>
                )}
              </div>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={e => {
                    setFormData({ ...formData, password: e.target.value });
                    if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                  }}
                  placeholder="Create a strong password"
                  className={`w-full min-h-[48px] px-4 py-3 pr-11 rounded-xl bg-white/5 border text-base sm:text-sm text-white placeholder-gray-500 focus:outline-none transition-all ${
                    fieldErrors.password
                      ? 'border-rose-500/60 ring-2 ring-rose-500/20 focus:border-rose-500 focus:ring-rose-500/30'
                      : 'border-white/10 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {formData.password.length > 0 && (
                <div className="mt-2.5 space-y-2 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Password Strength:</span>
                    <span className={`font-semibold ${passwordRules.textColor}`}>
                      {passwordRules.strengthLabel}
                    </span>
                  </div>
                  {/* 4-bar indicator */}
                  <div className="grid grid-cols-4 gap-1.5 h-1.5">
                    {[1, 2, 3, 4].map(barIndex => (
                      <div
                        key={barIndex}
                        className={`rounded-full transition-all duration-300 ${
                          passwordRules.score >= barIndex
                            ? passwordRules.strengthColor
                            : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Checklist */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1.5 text-[11px]">
                    <div className={`flex items-center gap-1.5 ${passwordRules.hasMinLength ? 'text-emerald-400' : 'text-gray-400'}`}>
                      {passwordRules.hasMinLength ? (
                        <Check className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-600 inline-block" />
                      )}
                      <span>8+ characters</span>
                    </div>

                    <div className={`flex items-center gap-1.5 ${passwordRules.hasUpperLower ? 'text-emerald-400' : 'text-gray-400'}`}>
                      {passwordRules.hasUpperLower ? (
                        <Check className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-600 inline-block" />
                      )}
                      <span>Upper & lowercase</span>
                    </div>

                    <div className={`flex items-center gap-1.5 ${passwordRules.hasDigit ? 'text-emerald-400' : 'text-gray-400'}`}>
                      {passwordRules.hasDigit ? (
                        <Check className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-600 inline-block" />
                      )}
                      <span>At least one number</span>
                    </div>

                    <div className={`flex items-center gap-1.5 ${passwordRules.hasSpecial ? 'text-emerald-400' : 'text-gray-400'}`}>
                      {passwordRules.hasSpecial ? (
                        <Check className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-600 inline-block" />
                      )}
                      <span>Special symbol (!@#$)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Confirm Password
                </label>
                {formData.confirm_password && (
                  <span className={`text-xs font-medium flex items-center gap-1 ${
                    formData.password === formData.confirm_password ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {formData.password === formData.confirm_password ? (
                      <>
                        <Check className="w-3 h-3" /> Passwords match
                      </>
                    ) : (
                      <>
                        <X className="w-3 h-3" /> Passwords do not match
                      </>
                    )}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  id="reg-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={formData.confirm_password}
                  onChange={e => {
                    setFormData({ ...formData, confirm_password: e.target.value });
                    if (fieldErrors.confirm_password) setFieldErrors(prev => ({ ...prev, confirm_password: '' }));
                  }}
                  placeholder="Re-enter your password"
                  className={`w-full min-h-[48px] px-4 py-3 pr-11 rounded-xl bg-white/5 border text-base sm:text-sm text-white placeholder-gray-500 focus:outline-none transition-all ${
                    fieldErrors.confirm_password || (formData.confirm_password && formData.password !== formData.confirm_password)
                      ? 'border-rose-500/60 ring-2 ring-rose-500/20 focus:border-rose-500 focus:ring-rose-500/30'
                      : 'border-white/10 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[48px] mt-3 py-3.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 active:scale-98 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>

          {/* Links */}
          <div className="mt-6 pt-5 border-t border-white/10 text-center text-xs text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2">
              Sign in
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
