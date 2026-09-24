import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import type { LogEntry, PredictionRecord } from '../../types/api';
import { AccountSettingsModal } from '../../components/auth/AccountSettingsModal';

export default function UserDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loadingPredictions, setLoadingPredictions] = useState(true);
  const [profileModal, setProfileModal] = useState(false);

  const fetchMyLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await api.logs.getMyLogs(30);
      setLogs(data);
    } catch {
      // Fallback
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchPredictions = async () => {
    setLoadingPredictions(true);
    try {
      const data = await api.predictions.getMyPredictions(20);
      setPredictions(data.items || []);
    } catch {
      // Fallback
    } finally {
      setLoadingPredictions(false);
    }
  };

  useEffect(() => {
    document.title = 'Dashboard | Car Worth';
    fetchMyLogs();
    fetchPredictions();
  }, []);

  const valuationsCount = predictions.length || logs.filter(l => l.action_type === 'valuation_predicted').length;
  const loginsCount = logs.filter(l => l.action_type.includes('login')).length;

  return (
    <div className="min-h-screen bg-transparent text-gray-100 pt-20 sm:pt-24 pb-16 px-3 sm:px-6 lg:px-8 select-none">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-emerald-950/60 via-gray-900 to-cyan-950/40 border border-emerald-500/20 p-5 sm:p-8 backdrop-blur-xl shadow-2xl"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Active Account &bull; {user?.role?.toUpperCase()}
              </div>
              <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
                Welcome back, {user?.name}!
              </h1>
              <p className="text-xs sm:text-sm text-gray-300 mt-1 max-w-xl">
                Access your machine learning vehicle valuations, manage personal credentials, and track your recent activity records.
              </p>
            </div>

            <div className="flex flex-col min-[420px]:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
              <button
                onClick={() => setProfileModal(true)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-gray-200 bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit Profile
              </button>
              <button
                onClick={() => navigate('/predict')}
                className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/25 transition-all transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Predict Vehicle Price
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid - 2x2 on mobile, 4-col on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-gray-900/70 border border-white/10 backdrop-blur-xl">
            <div className="flex items-center justify-between text-gray-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="truncate">Predictions</span>
              <span className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-white">{valuationsCount}</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-1 truncate">Total appraisals</p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-gray-900/70 border border-white/10 backdrop-blur-xl">
            <div className="flex items-center justify-between text-gray-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="truncate">Status</span>
              <span className="p-1.5 sm:p-2 rounded-lg bg-teal-500/10 text-teal-400">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 capitalize">{user?.is_active ? 'Active' : 'Suspended'}</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-1 truncate">Verified account</p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-gray-900/70 border border-white/10 backdrop-blur-xl">
            <div className="flex items-center justify-between text-gray-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="truncate">Sessions</span>
              <span className="p-1.5 sm:p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-white">{loginsCount || 1}</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-1 truncate">Active sessions</p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-gray-900/70 border border-white/10 backdrop-blur-xl">
            <div className="flex items-center justify-between text-gray-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="truncate">Member Since</span>
              <span className="p-1.5 sm:p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </span>
            </div>
            <p className="text-sm sm:text-lg font-bold text-white truncate">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Today'}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-1 truncate">Registration</p>
          </div>
        </div>

        {/* Saved Predictions Overview */}
        <div className="rounded-2xl sm:rounded-3xl bg-gray-900/80 border border-white/10 backdrop-blur-xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>My Saved Valuations</span>
                <span className="text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  {predictions.length} {predictions.length === 1 ? 'Record' : 'Records'}
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Automated history of vehicle valuations you have calculated</p>
            </div>
            <button
              onClick={() => navigate('/predict')}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 active:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <span>+ Predict Vehicle Price</span>
            </button>
          </div>

          {loadingPredictions ? (
            <div className="py-8 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
              <span>Loading valuation records...</span>
            </div>
          ) : predictions.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-xs space-y-2">
              <p>No vehicle predictions recorded yet for this account.</p>
              <button
                onClick={() => navigate('/predict')}
                className="text-emerald-400 hover:underline font-semibold cursor-pointer min-h-[44px] inline-flex items-center"
              >
                Run your first vehicle price prediction &rarr;
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {predictions.slice(0, 6).map(p => (
                <div key={p.id} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2.5 text-xs hover:border-emerald-500/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span>🚗</span> {p.brand} ({p.year})
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-gray-300 border border-white/5">
                      {p.fuel_type}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-gray-300 border border-white/5">
                      {p.transmission}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-gray-300 border border-white/5">
                      {p.kms_driven.toLocaleString('en-IN')} kms
                    </span>
                  </div>
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-gray-400 text-[11px]">Fair Value:</span>
                    <span className="text-emerald-400 font-black text-sm sm:text-base">
                      ₹{Math.round(p.predicted_price * 100000).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profile Details & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="p-6 rounded-2xl bg-gray-900/80 border border-white/10 backdrop-blur-xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white">Profile Details</h2>
              <button
                onClick={() => setProfileModal(true)}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
              >
                Edit
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-gray-400">Display Name</p>
                <p className="font-semibold text-white mt-0.5">{user?.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Email Address</p>
                <p className="font-semibold text-white mt-0.5">{user?.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Assigned Role</p>
                <span className="inline-block mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                  {user?.role}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-400">Last Sign-In</p>
                <p className="text-xs text-gray-300 mt-0.5">
                  {user?.last_login ? new Date(user.last_login).toLocaleString() : 'Currently active'}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <button
                onClick={() => setProfileModal(true)}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/15 transition-colors cursor-pointer text-center"
              >
                Change Password &amp; Settings
              </button>
            </div>
          </div>

          {/* My Activity Feed */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-gray-900/80 border border-white/10 backdrop-blur-xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-base font-bold text-white">My Activity Timeline</h2>
                <p className="text-xs text-gray-400 mt-0.5">Audit log of your recent interactions</p>
              </div>
              <button
                onClick={fetchMyLogs}
                disabled={loadingLogs}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
                title="Refresh Activity"
              >
                <svg className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {loadingLogs ? (
              <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
                <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
                <p className="text-xs">Loading activity records...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                <p>No logged activity records found yet.</p>
                <button
                  onClick={() => navigate('/predict')}
                  className="mt-3 text-xs text-emerald-400 hover:underline cursor-pointer"
                >
                  Run your first vehicle price prediction &rarr;
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1 divide-y divide-white/5">
                {logs.map(item => (
                  <div key={item.id} className="pt-3 first:pt-0 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          item.status === 'success'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {item.action_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-200">{item.description}</p>
                      {item.metadata?.predicted_price && (
                        <p className="text-xs font-semibold text-emerald-400">
                          Estimated Valuation: ₹{item.metadata.predicted_price} Lakh
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono shrink-0">
                      {item.ip_address}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Account & Security Settings Modal */}
      <AccountSettingsModal
        isOpen={profileModal}
        onClose={() => setProfileModal(false)}
        onProfileUpdated={fetchMyLogs}
      />
    </div>
  );
}
