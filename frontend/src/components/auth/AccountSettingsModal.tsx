import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  EyeOff,
  Lock,
  User as UserIcon,
  ShieldCheck,
  CheckCircle2,
  Circle,
  X,
  KeyRound,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuthPopup } from './AuthPopup';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
  initialTab?: 'profile' | 'security';
}

const COMMON_PASSWORDS = new Set([
  'password123!',
  'password123',
  'admin12345!',
  'welcome123!',
  'carworth123!',
  '12345678a!',
  'qwerty12345!',
  'password@123',
]);

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  onProfileUpdated,
  initialTab = 'profile',
}) => {
  const { user, updateProfile, changePassword } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>(initialTab);

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Security / Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Popup Alert State
  const [popupState, setPopupState] = useState<{
    isOpen: boolean;
    type: 'error' | 'warning' | 'success';
    title?: string;
    message: string;
    code?: string;
    failingInputId?: string;
  }>({
    isOpen: false,
    type: 'error',
    message: '',
  });

  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setProfileSuccessMsg(null);
      setProfileErrorMsg(null);
    }
  }, [isOpen, initialTab]);

  // Live Password Criteria & Strength Evaluation
  const criteria = {
    length: newPassword.length >= 8 && newPassword.length <= 72,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[!@#$%^&*(),.?":{}|<>\-_=+/\\\[\]~`]/.test(newPassword),
    notCommon: !COMMON_PASSWORDS.has(newPassword.toLowerCase()),
  };

  const criteriaMetCount = [
    criteria.length,
    criteria.upper,
    criteria.lower,
    criteria.number,
    criteria.special,
    criteria.notCommon,
  ].filter(Boolean).length;

  const strengthPercent = (criteriaMetCount / 6) * 100;

  let strengthLabel = 'Very Weak';
  let strengthColor = 'bg-rose-500 text-rose-400';
  if (criteriaMetCount >= 6) {
    strengthLabel = 'Strong';
    strengthColor = 'bg-emerald-500 text-emerald-400';
  } else if (criteriaMetCount >= 4) {
    strengthLabel = 'Good';
    strengthColor = 'bg-yellow-500 text-yellow-400';
  } else if (criteriaMetCount >= 3) {
    strengthLabel = 'Fair';
    strengthColor = 'bg-amber-500 text-amber-400';
  }

  // Handle Profile Update
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);

    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 60) {
      setProfileErrorMsg('Full name must be between 2 and 60 characters.');
      return;
    }

    if (trimmed === user?.name) {
      setProfileSuccessMsg('Name is already up to date.');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await updateProfile({ name: trimmed });
      setProfileSuccessMsg('Profile updated successfully!');
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      setProfileErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Handle Change Password Submit
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      setPopupState({
        isOpen: true,
        type: 'error',
        title: 'Current Password Required',
        message: 'Please enter your current account password to proceed.',
        failingInputId: 'current-password-input',
      });
      return;
    }

    if (!newPassword) {
      setPopupState({
        isOpen: true,
        type: 'error',
        title: 'New Password Required',
        message: 'Please provide a new password.',
        failingInputId: 'new-password-input',
      });
      return;
    }

    if (newPassword === currentPassword) {
      setPopupState({
        isOpen: true,
        type: 'error',
        title: 'Same Password',
        code: 'SAME_PASSWORD',
        message: 'New password must be different from your current password.',
        failingInputId: 'new-password-input',
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPopupState({
        isOpen: true,
        type: 'error',
        title: 'Password Mismatch',
        code: 'PASSWORD_MISMATCH',
        message: 'Passwords do not match. Please verify confirmation.',
        failingInputId: 'confirm-password-input',
      });
      return;
    }

    if (criteriaMetCount < 5 || !criteria.length || !criteria.notCommon) {
      setPopupState({
        isOpen: true,
        type: 'error',
        title: 'Weak Password',
        code: 'WEAK_PASSWORD',
        message: 'New password does not meet security complexity requirements.',
        failingInputId: 'new-password-input',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_new_password: confirmNewPassword,
      });

      // Clear fields upon success
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');

      setPopupState({
        isOpen: true,
        type: 'success',
        title: 'Password Changed',
        message: res.message || "Password changed successfully. You've been signed out of all other devices.",
      });

      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      const code = err.code || err.response?.data?.code;
      const message = err.message || err.response?.data?.message || 'Failed to update password.';

      let failingInput = 'new-password-input';
      if (code === 'INVALID_CURRENT_PASSWORD' || err.status === 401) {
        failingInput = 'current-password-input';
      } else if (code === 'PASSWORD_MISMATCH') {
        failingInput = 'confirm-password-input';
      } else if (code === 'SAME_PASSWORD' || code === 'WEAK_PASSWORD') {
        failingInput = 'new-password-input';
      }

      let errorTitle = 'Password Update Failed';
      if (code === 'INVALID_CURRENT_PASSWORD' || err.status === 401) {
        errorTitle = 'Current Password Incorrect';
      } else if (code === 'TOO_MANY_ATTEMPTS' || err.status === 429) {
        errorTitle = 'Too Many Attempts';
      } else if (code === 'PASSWORD_MISMATCH') {
        errorTitle = 'Passwords Do Not Match';
      } else if (code === 'SAME_PASSWORD') {
        errorTitle = 'Same Password';
      } else if (code === 'WEAK_PASSWORD') {
        errorTitle = 'Weak Password';
      } else if (err.status === 404) {
        errorTitle = 'Endpoint Not Found';
      }

      setPopupState({
        isOpen: true,
        type: code === 'TOO_MANY_ATTEMPTS' || err.status === 429 ? 'warning' : 'error',
        title: errorTitle,
        code,
        message,
        failingInputId: failingInput,
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-xl bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-gray-100 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Account &amp; Security Settings</h2>
                  <p className="text-xs text-gray-400">Manage credentials, active sessions, and profile details</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close settings"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/10 bg-white/[0.01] px-6 pt-2">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'profile'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                Profile Information
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'security'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                Change Password &amp; Sessions
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {activeTab === 'profile' ? (
                /* Profile Tab */
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  {profileErrorMsg && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                      {profileErrorMsg}
                    </div>
                  )}
                  {profileSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      {profileSuccessMsg}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-gray-300">Email Address</label>
                      <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                        Primary Identifier
                      </span>
                    </div>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-gray-400 text-sm cursor-not-allowed select-none"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">Email address is permanent and used for audit traceability.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold block">Role</span>
                      <span className="text-xs font-bold text-emerald-400 capitalize">{user?.role || 'User'}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold block">Account Status</span>
                      <span className="text-xs font-bold text-cyan-400 capitalize">{user?.is_active !== false ? 'Active' : 'Deactivated'}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdatingProfile}
                      className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    >
                      {isUpdatingProfile ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Profile Details'
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Security / Change Password Tab */
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <p className="font-semibold">Session Revocation Policy</p>
                      <p className="text-[11px] text-amber-200/80 mt-0.5">
                        Changing your password terminates all other active sessions and tokens immediately across all devices.
                        Your current device will be issued a fresh session cookie seamlessly.
                      </p>
                    </div>
                  </div>

                  {/* Current Password */}
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">Current Password</label>
                    <div className="relative">
                      <input
                        id="current-password-input"
                        type={showCurrent ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="Enter your current password"
                        autoComplete="current-password"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent(!showCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                        tabIndex={-1}
                        aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                      >
                        {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">New Password</label>
                    <div className="relative">
                      <input
                        id="new-password-input"
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Create a strong, unique password"
                        autoComplete="new-password"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                        tabIndex={-1}
                        aria-label={showNew ? 'Hide new password' : 'Show new password'}
                      >
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Live Strength Meter */}
                    {newPassword.length > 0 && (
                      <div className="mt-2.5 space-y-2 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-400">Password Strength:</span>
                          <span className={`font-semibold ${strengthColor}`}>{strengthLabel}</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full ${
                              criteriaMetCount >= 6
                                ? 'bg-emerald-500'
                                : criteriaMetCount >= 4
                                ? 'bg-yellow-500'
                                : criteriaMetCount >= 3
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${strengthPercent}%` }}
                            transition={{ duration: 0.2 }}
                          />
                        </div>

                        {/* Checklist */}
                        <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                          <div className={`flex items-center gap-1.5 ${criteria.length ? 'text-emerald-400' : 'text-gray-500'}`}>
                            {criteria.length ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                            <span>8–72 characters</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${criteria.upper ? 'text-emerald-400' : 'text-gray-500'}`}>
                            {criteria.upper ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                            <span>Uppercase letter (A-Z)</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${criteria.lower ? 'text-emerald-400' : 'text-gray-500'}`}>
                            {criteria.lower ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                            <span>Lowercase letter (a-z)</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${criteria.number ? 'text-emerald-400' : 'text-gray-500'}`}>
                            {criteria.number ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                            <span>At least one number</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${criteria.special ? 'text-emerald-400' : 'text-gray-500'}`}>
                            {criteria.special ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                            <span>Special symbol (!@#$%)</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${criteria.notCommon ? 'text-emerald-400' : 'text-gray-500'}`}>
                            {criteria.notCommon ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                            <span>Not easily guessed</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1.5">Confirm New Password</label>
                    <div className="relative">
                      <input
                        id="confirm-password-input"
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmNewPassword}
                        onChange={e => setConfirmNewPassword(e.target.value)}
                        placeholder="Re-enter your new password"
                        autoComplete="new-password"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                        tabIndex={-1}
                        aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmNewPassword.length > 0 && newPassword !== confirmNewPassword && (
                      <p className="text-[11px] text-rose-400 mt-1">Passwords do not match.</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 transition-all shadow-md shadow-emerald-500/25 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    >
                      {isChangingPassword ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Updating Password...
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          Update Password
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* AuthPopup Feedback Dialog */}
      <AuthPopup
        isOpen={popupState.isOpen}
        onClose={() => setPopupState(prev => ({ ...prev, isOpen: false }))}
        type={popupState.type}
        title={popupState.title}
        message={popupState.message}
        code={popupState.code}
        failingInputId={popupState.failingInputId}
      />
    </>
  );
};
