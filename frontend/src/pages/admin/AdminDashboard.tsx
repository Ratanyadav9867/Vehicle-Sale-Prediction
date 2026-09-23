import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import type { DashboardStats, User, LogEntry, PredictionRecord } from '../../types/api';
import { AccountSettingsModal } from '../../components/auth/AccountSettingsModal';

export default function AdminDashboard() {
  const { user: currentAdmin } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [adminPredictions, setAdminPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Search & filter for users table
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');

  // Selected user for timeline drawer
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userTimeline, setUserTimeline] = useState<LogEntry[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Status message
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#profile') {
        setIsProfileModalOpen(true);
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, usersData, logsData, predictionsData] = await Promise.all([
        api.logs.getAdminStats(),
        api.users.list({ limit: 100 }),
        api.logs.getAdminLogs({ limit: 8 }),
        api.predictions.getAdminPredictions(50),
      ]);
      setStats(statsData);
      setUsers(usersData.items);
      setRecentLogs(logsData.items);
      setAdminPredictions(predictionsData.items || []);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to fetch admin data.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Admin Dashboard | Car Worth';
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Open user timeline
  const handleOpenUserTimeline = async (user: User) => {
    setSelectedUser(user);
    setLoadingTimeline(true);
    try {
      const timeline = await api.logs.getUserTimeline(user.id, 50);
      setUserTimeline(timeline);
    } catch {
      setUserTimeline([]);
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Toggle user active status
  const handleToggleStatus = async (user: User) => {
    try {
      const newStatus = !user.is_active;
      await api.users.updateStatus(user.id, newStatus);
      setActionMessage({
        type: 'success',
        text: `User ${user.email} has been ${newStatus ? 'activated' : 'deactivated'}.`,
      });
      fetchDashboardData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to update user status.' });
    }
  };

  // Toggle user role
  const handleToggleRole = async (user: User) => {
    if (user.id === currentAdmin?.id) {
      alert('You cannot change your own administrative role.');
      return;
    }
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Are you sure you want to change ${user.name}'s role to ${newRole.toUpperCase()}?`)) {
      return;
    }
    try {
      await api.users.updateRole(user.id, newRole);
      setActionMessage({
        type: 'success',
        text: `Role for ${user.email} updated to ${newRole}.`,
      });
      fetchDashboardData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to update role.' });
    }
  };

  // Delete user
  const handleDeleteUser = async (user: User) => {
    if (user.id === currentAdmin?.id) {
      alert('You cannot delete your own active administrator account.');
      return;
    }
    if (!confirm(`PERMANENT DELETE: Are you sure you want to delete user ${user.email}? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.users.delete(user.id);
      setActionMessage({
        type: 'success',
        text: `User ${user.email} was permanently deleted and logged.`,
      });
      fetchDashboardData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete user.' });
    }
  };

  // Filtered users
  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter ? u.role === userRoleFilter : true;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen bg-transparent text-gray-100 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Admin Header Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-gray-900 to-amber-950/40 border border-amber-500/20 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-3">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                SYSTEM ADMINISTRATOR PORTAL
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Control Center &amp; User Management
              </h1>
              <p className="text-sm text-gray-300 mt-1 max-w-2xl">
                Real-time security auditing, multi-tenant user lifecycle governance, and AI model telemetry logs.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/predict"
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Predict Price
              </Link>
              <Link
                to="/admin/logs"
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Full Audit Logs
              </Link>
              <button
                onClick={() => api.logs.downloadExport('csv')}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/15 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </button>
              <button
                id="admin-account-settings-btn"
                onClick={() => setIsProfileModalOpen(true)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Account &amp; Security
              </button>
            </div>
          </div>
        </div>

        {/* Action feedback toast */}
        {actionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
              actionMessage.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{actionMessage.text}</span>
            <button
              onClick={() => setActionMessage(null)}
              className="text-xs underline cursor-pointer hover:opacity-80"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-4 rounded-2xl bg-gray-900/70 border border-white/10">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Users</p>
            <p className="text-2xl font-extrabold text-white mt-1">{stats?.total_users ?? '-'}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Registered accounts</p>
          </div>

          <div className="p-4 rounded-2xl bg-gray-900/70 border border-white/10">
            <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Active Users</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-1">{stats?.active_users ?? '-'}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Permitted accounts</p>
          </div>

          <div className="p-4 rounded-2xl bg-gray-900/70 border border-white/10">
            <p className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider">New Registrations</p>
            <p className="text-2xl font-extrabold text-white mt-1">{stats?.new_registrations_today ?? 0}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Joined today</p>
          </div>

          <div className="p-4 rounded-2xl bg-gray-900/70 border border-white/10">
            <p className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Failed Logins</p>
            <p className={`text-2xl font-extrabold mt-1 ${(stats?.failed_logins_today ?? 0) > 0 ? 'text-rose-400' : 'text-gray-300'}`}>
              {stats?.failed_logins_today ?? 0}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">Auth failures today</p>
          </div>

          <div className="p-4 rounded-2xl bg-gray-900/70 border border-white/10">
            <p className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">Total Predictions</p>
            <p className="text-2xl font-extrabold text-white mt-1">{stats?.total_predictions ?? '-'}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">ML model inquiries</p>
          </div>

          <div className="p-4 rounded-2xl bg-gray-900/70 border border-white/10">
            <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Audit Logs</p>
            <p className="text-2xl font-extrabold text-amber-300 mt-1">{stats?.total_logs ?? '-'}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Immutable records</p>
          </div>
        </div>

        {/* Users Management Section */}
        <div className="rounded-2xl bg-gray-900/80 border border-white/10 backdrop-blur-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Registered Users Directory</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Search accounts, toggle account status, elevate roles, or inspect user activity history.
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors w-56"
              />

              <select
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-gray-900 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="">All Roles</option>
                <option value="user">Users</option>
                <option value="admin">Admins</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          {loading ? (
            <div className="py-16 text-center text-gray-400">
              <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Loading accounts...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 uppercase tracking-wider">
                    <th className="pb-3 font-semibold">User</th>
                    <th className="pb-3 font-semibold">Role</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Registered</th>
                    <th className="pb-3 font-semibold">Last Login</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5">
                        <button
                          onClick={() => handleOpenUserTimeline(u)}
                          className="flex items-center gap-3 text-left group cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-white/10 group-hover:bg-amber-500/20 text-gray-300 group-hover:text-amber-300 flex items-center justify-center font-bold text-xs transition-colors">
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-white group-hover:text-amber-300 transition-colors">
                              {u.name}
                            </p>
                            <p className="text-[11px] text-gray-400 font-mono">{u.email}</p>
                          </div>
                        </button>
                      </td>

                      <td className="py-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'admin'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
                          u.is_active
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {u.is_active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>

                      <td className="py-3.5 text-gray-400">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 text-gray-400">
                        {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                      </td>

                      <td className="py-3.5 text-right space-x-2">
                        <button
                          onClick={() => handleOpenUserTimeline(u)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
                          title="View User Activity Timeline"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            u.is_active
                              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                          }`}
                          title={u.is_active ? 'Deactivate User' : 'Activate User'}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>

                        {u.id !== currentAdmin?.id && (
                          <>
                            <button
                              onClick={() => handleToggleRole(u)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
                              title={`Change role to ${u.role === 'admin' ? 'user' : 'admin'}`}
                            >
                              Role
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                              title="Delete Account"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* All Users' Prediction History Section */}
        <div className="rounded-2xl bg-gray-900/80 border border-white/10 backdrop-blur-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>All Users' Prediction History</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  {adminPredictions.length} Logged
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Centralized registry of all vehicle valuations calculated across the platform
              </p>
            </div>
            <Link
              to="/predict"
              className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
            >
              <span>+ Run New Valuation</span>
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-400 text-xs">Loading predictions...</div>
          ) : adminPredictions.length === 0 ? (
            <p className="text-center py-8 text-xs text-gray-400">No predictions recorded yet across any user.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 uppercase tracking-wider">
                    <th className="pb-3 font-semibold">User</th>
                    <th className="pb-3 font-semibold">Vehicle</th>
                    <th className="pb-3 font-semibold">Specs</th>
                    <th className="pb-3 font-semibold">Showroom</th>
                    <th className="pb-3 font-semibold">Predicted Price</th>
                    <th className="pb-3 font-semibold text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {adminPredictions.map(p => (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3">
                        <p className="font-semibold text-white">{p.user_name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{p.email}</p>
                      </td>
                      <td className="py-3 text-white font-medium">
                        {p.brand} ({p.year})
                      </td>
                      <td className="py-3 text-gray-300">
                        {p.fuel_type} &bull; {p.transmission} &bull; {p.kms_driven.toLocaleString('en-IN')} km
                      </td>
                      <td className="py-3 text-gray-300">
                        ₹{(p.present_price * 100000).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3">
                        <span className="font-bold text-emerald-400">
                          ₹{Math.round(p.predicted_price * 100000).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-gray-400 block font-mono">
                          ({p.predicted_price.toFixed(2)} Lakh)
                        </span>
                      </td>
                      <td className="py-3 text-right text-gray-400 font-mono text-[11px]">
                        {new Date(p.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activity Feed & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Live Feed */}
          <div className="lg:col-span-2 rounded-2xl bg-gray-900/80 border border-white/10 backdrop-blur-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Live Activity Stream</h3>
                <p className="text-xs text-gray-400">Audited operational events recorded across all users</p>
              </div>
              <Link
                to="/admin/logs"
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                View All &rarr;
              </Link>
            </div>

            <div className="space-y-3 divide-y divide-white/5">
              {recentLogs.map(log => (
                <div key={log.id} className="pt-3 first:pt-0 flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        log.status === 'success'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {log.action_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-gray-400">{log.user_name} ({log.role})</span>
                    </div>
                    <p className="text-gray-200">{log.description}</p>
                  </div>
                  <div className="text-right shrink-0 text-[11px] text-gray-500">
                    <p>{new Date(log.timestamp).toLocaleTimeString()}</p>
                    <p className="font-mono text-[10px]">{log.ip_address}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Management Shortcuts */}
          <div className="rounded-2xl bg-gray-900/80 border border-white/10 backdrop-blur-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white border-b border-white/10 pb-4">
              System Operations
            </h3>

            <div className="space-y-3">
              <button
                onClick={() => navigate('/admin/logs')}
                className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left flex items-center justify-between text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </span>
                  <div>
                    <p>Audit Log Inspector</p>
                    <p className="text-[10px] text-gray-400 font-normal">Real-time filter, timeline &amp; alerts</p>
                  </div>
                </div>
                <span>&rarr;</span>
              </button>

              <button
                onClick={() => api.logs.downloadExport('csv')}
                className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left flex items-center justify-between text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </span>
                  <div>
                    <p>Export Audit Logs (CSV)</p>
                    <p className="text-[10px] text-gray-400 font-normal">Audited export for compliance</p>
                  </div>
                </div>
                <span>&darr;</span>
              </button>

              <button
                onClick={() => api.logs.downloadExport('json')}
                className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left flex items-center justify-between text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </span>
                  <div>
                    <p>Export Audit Logs (JSON)</p>
                    <p className="text-[10px] text-gray-400 font-normal">Structured payload backup</p>
                  </div>
                </div>
                <span>&darr;</span>
              </button>

              <button
                onClick={() => navigate('/#model')}
                className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left flex items-center justify-between text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </span>
                  <div>
                    <p>ML Pipeline Diagnostics</p>
                    <p className="text-[10px] text-gray-400 font-normal">Inspect production weights &amp; R²</p>
                  </div>
                </div>
                <span>&rarr;</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* User Timeline Drawer Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="w-full max-w-xl bg-gray-950 border-l border-white/10 h-full flex flex-col p-6 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedUser.name}'s Activity History
                  </h3>
                  <p className="text-xs text-gray-400">{selectedUser.email}</p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {loadingTimeline ? (
                  <div className="py-12 text-center text-gray-400">
                    <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs">Fetching user timeline...</p>
                  </div>
                ) : userTimeline.length === 0 ? (
                  <p className="text-center py-12 text-xs text-gray-400">No activity recorded for this user.</p>
                ) : (
                  userTimeline.map(item => (
                    <div key={item.id} className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          item.status === 'success'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {item.action_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-white font-medium">{item.description}</p>
                      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 font-mono">
                        <span>IP: {item.ip_address}</span>
                        <span>Cat: {item.category}</span>
                      </div>
                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <pre className="p-2 rounded bg-black/40 text-[10px] text-emerald-300 font-mono overflow-x-auto">
                          {JSON.stringify(item.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Account & Security Settings Modal */}
      <AccountSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false);
          if (window.location.hash === '#profile') {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }}
        onProfileUpdated={fetchDashboardData}
        initialTab="security"
      />
    </div>
  );
}
