import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import type { LogEntry } from '../../types/api';

export default function AdminLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  // Live Auto-refresh
  const [isLive, setIsLive] = useState(false);
  const timerRef = useRef<any>(null);

  // Modals / Drawers
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [userTimelineEmail, setUserTimelineEmail] = useState<string | null>(null);
  const [userTimelineLogs, setUserTimelineLogs] = useState<LogEntry[]>([]);
  const [loadingUserTimeline, setLoadingUserTimeline] = useState(false);

  // Fetch logs
  const fetchLogs = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await api.logs.getAdminLogs({
        page,
        limit,
        search: search.trim() || undefined,
        category: category || undefined,
        role: role || undefined,
        status: status || undefined,
      });
      setLogs(data.items);
      setTotalLogs(data.total);
      setTotalPages(data.total_pages);
    } catch {
      // Handle error gracefully
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [page, limit, search, category, role, status]);

  useEffect(() => {
    document.title = 'Audit Logs | Car Worth';
    fetchLogs(true);
  }, [fetchLogs]);

  // Handle live auto-refresh polling (every 5 seconds)
  useEffect(() => {
    if (isLive) {
      timerRef.current = setInterval(() => {
        fetchLogs(false);
      }, 5000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLive, fetchLogs]);

  // Open user timeline
  const handleOpenUserTimeline = async (log: LogEntry) => {
    if (!log.user_id && !log.email) return;
    setUserTimelineEmail(log.email || log.user_name);
    setLoadingUserTimeline(true);
    try {
      if (log.user_id) {
        const history = await api.logs.getUserTimeline(log.user_id, 100);
        setUserTimelineLogs(history);
      } else {
        // Filter by email if unauthenticated or no user_id
        const res = await api.logs.getAdminLogs({ search: log.email, limit: 100 });
        setUserTimelineLogs(res.items);
      }
    } catch {
      setUserTimelineLogs([]);
    } finally {
      setLoadingUserTimeline(false);
    }
  };

  // Export handlers
  const handleExport = async (format: 'csv' | 'json') => {
    try {
      await api.logs.downloadExport(format, {
        search: search.trim(),
        category,
        role,
        status,
      });
      // Re-fetch to show the logged export event
      setTimeout(() => fetchLogs(false), 1000);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // Suspicious Activity Detection
  const failedLogins = logs.filter(l => l.action_type.includes('login') && l.status === 'failed');
  const accessDeniedLogs = logs.filter(l => l.action_type === 'access_denied_403' || l.action_type === 'admin_login_denied');
  const suspiciousCount = failedLogins.length + accessDeniedLogs.length;

  return (
    <div className="min-h-screen bg-transparent text-gray-100 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Link to="/admin/dashboard" className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold">
                &larr; Admin Dashboard
              </Link>
              <span className="text-gray-600">/</span>
              <span className="text-xs text-gray-400">Security Audit Logs</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
              System Process &amp; Audit Logs
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Immutable audit trail capturing all user actions, security checks, valuations, and administrative interventions.
            </p>
          </div>

          {/* Controls: Live Refresh + Export */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Live Refresh Toggle */}
            <button
              onClick={() => setIsLive(l => !l)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                isLive
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-500/10'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-ping' : 'bg-gray-500'}`} />
              <span>{isLive ? 'Live Streaming (5s)' : 'Auto-Refresh Off'}</span>
            </button>

            {/* Manual Refresh */}
            <button
              onClick={() => fetchLogs(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Refresh Logs"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Export Buttons */}
            <button
              onClick={() => handleExport('csv')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-500/15 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => handleExport('json')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-300 bg-white/10 hover:bg-white/15 border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {/* Security & Suspicious Activity Alerts Panel */}
        {suspiciousCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 backdrop-blur-xl flex items-start justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 mt-0.5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-300">
                  Security Alerts Detected ({suspiciousCount} anomalous events)
                </h3>
                <p className="text-xs text-rose-200/80 mt-0.5">
                  Recent audit streams show {failedLogins.length} failed credential attempts and {accessDeniedLogs.length} unauthorized route access blocks. Inspect IP and user agent below.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setStatus('failed');
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold shrink-0 cursor-pointer border border-rose-500/30"
            >
              Filter Failed Events &rarr;
            </button>
          </motion.div>
        )}

        {/* Filter Bar */}
        <div className="p-4 rounded-2xl bg-gray-900/80 border border-white/10 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <svg className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by action, email, description, or IP..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Select Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category */}
            <select
              value={category}
              onChange={e => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-gray-900 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Categories</option>
              <option value="auth">Auth</option>
              <option value="admin">Admin</option>
              <option value="navigation">Navigation</option>
              <option value="profile">Profile</option>
              <option value="system">System</option>
              <option value="error">Error</option>
            </select>

            {/* Role */}
            <select
              value={role}
              onChange={e => {
                setRole(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-gray-900 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
              <option value="anonymous">Anonymous</option>
            </select>

            {/* Status */}
            <select
              value={status}
              onChange={e => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-gray-900 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>

            {/* Clear Filters */}
            {(search || category || role || status) && (
              <button
                onClick={() => {
                  setSearch('');
                  setCategory('');
                  setRole('');
                  setStatus('');
                  setPage(1);
                }}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Logs Table */}
        <div className="rounded-2xl bg-gray-900/80 border border-white/10 backdrop-blur-xl overflow-hidden">
          {loading && logs.length === 0 ? (
            <div className="py-20 text-center text-gray-400">
              <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Fetching audit logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-20 text-center text-gray-400">
              <p className="text-sm font-semibold text-white">No logs matching filter criteria</p>
              <p className="text-xs text-gray-500 mt-1">Try broadening your search query or reset filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-gray-400 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Time (UTC)</th>
                    <th className="py-3 px-4 font-semibold">User</th>
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold">Action</th>
                    <th className="py-3 px-4 font-semibold">Description</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">IP Address</th>
                    <th className="py-3 px-4 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map(item => {
                    const isSuspicious = item.status === 'failed' || item.action_type.includes('denied');
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors hover:bg-white/5 ${
                          isSuspicious ? 'bg-rose-500/5' : ''
                        }`}
                      >
                        {/* Time */}
                        <td className="py-3.5 px-4 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                          {new Date(item.timestamp).toLocaleString()}
                        </td>

                        {/* User */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <button
                            onClick={() => handleOpenUserTimeline(item)}
                            className="text-left group cursor-pointer"
                            title="Click to view full user activity timeline"
                          >
                            <p className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                              {item.user_name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-gray-400 font-mono">{item.email}</span>
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                                item.role === 'admin'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-emerald-500/20 text-emerald-300'
                              }`}>
                                {item.role}
                              </span>
                            </div>
                          </button>
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            item.category === 'auth'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : item.category === 'admin'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : item.category === 'error' || item.category === 'system'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {item.category}
                          </span>
                        </td>

                        {/* Action Type */}
                        <td className="py-3.5 px-4 font-mono text-[11px] text-gray-300 whitespace-nowrap">
                          {item.action_type}
                        </td>

                        {/* Description */}
                        <td className="py-3.5 px-4 text-gray-200 max-w-xs truncate" title={item.description}>
                          {item.description}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            item.status === 'success'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'success' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            {item.status}
                          </span>
                        </td>

                        {/* IP Address */}
                        <td className="py-3.5 px-4 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                          {item.ip_address}
                        </td>

                        {/* Details Action */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelectedLog(item)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-cyan-400 hover:text-cyan-300 text-xs font-medium transition-colors cursor-pointer"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Bar */}
          <div className="p-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-400">
            <div>
              Showing page <span className="text-white font-semibold">{page}</span> of{' '}
              <span className="text-white font-semibold">{totalPages}</span> ({totalLogs} records)
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Log Detail Drawer / Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-2xl w-full p-6 sm:p-7 rounded-2xl bg-gray-900 border border-white/15 shadow-2xl space-y-5 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className={`text-xs uppercase font-bold px-2.5 py-0.5 rounded-full ${
                    selectedLog.status === 'success'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {selectedLog.status}
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    Audit Log #{selectedLog.id}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white/5">
                  <div>
                    <p className="text-gray-400 font-medium">Timestamp (UTC)</p>
                    <p className="text-white font-mono mt-0.5">{selectedLog.timestamp}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-medium">Action Type</p>
                    <p className="text-cyan-300 font-mono font-semibold mt-0.5">{selectedLog.action_type}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-medium">User Identity</p>
                    <p className="text-white mt-0.5">{selectedLog.user_name} ({selectedLog.email})</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-medium">Role &amp; Category</p>
                    <p className="text-white mt-0.5 capitalize">{selectedLog.role} &bull; {selectedLog.category}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-medium">IP Address</p>
                    <p className="text-white font-mono mt-0.5">{selectedLog.ip_address}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-medium">User ID</p>
                    <p className="text-white font-mono mt-0.5">{selectedLog.user_id ?? 'Anonymous'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-gray-400 font-medium mb-1">Event Description</p>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-200">
                    {selectedLog.description}
                  </div>
                </div>

                <div>
                  <p className="text-gray-400 font-medium mb-1">User Agent (Client Device)</p>
                  <p className="p-3 rounded-xl bg-white/5 font-mono text-[11px] text-gray-300 break-all">
                    {selectedLog.user_agent}
                  </p>
                </div>

                <div>
                  <p className="text-gray-400 font-medium mb-1">Metadata Payload (JSON)</p>
                  <pre className="p-3.5 rounded-xl bg-black/60 border border-white/10 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  Close Inspector
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Timeline Drawer */}
      <AnimatePresence>
        {userTimelineEmail && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="w-full max-w-xl bg-gray-950 border-l border-white/15 h-full flex flex-col p-6 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Full User Activity Timeline</h3>
                  <p className="text-xs text-cyan-400 font-mono">{userTimelineEmail}</p>
                </div>
                <button
                  onClick={() => setUserTimelineEmail(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {loadingUserTimeline ? (
                  <div className="py-12 text-center text-gray-400">
                    <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs">Loading user history...</p>
                  </div>
                ) : userTimelineLogs.length === 0 ? (
                  <p className="text-center py-12 text-xs text-gray-400">No logs for this user.</p>
                ) : (
                  userTimelineLogs.map(item => (
                    <div key={item.id} className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          item.status === 'success'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {item.action_type}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-white font-medium">{item.description}</p>
                      <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono pt-1">
                        <span>IP: {item.ip_address}</span>
                        <span>Cat: {item.category}</span>
                      </div>
                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <pre className="p-2 rounded bg-black/50 text-[10px] text-emerald-300 font-mono overflow-x-auto">
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
    </div>
  );
}
