import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchTickets, updateTicketStatus, getAttachmentUrl } from '../../api/support';
import type { SupportTicket } from '../../api/support';

const STATUS_TABS = ['all', 'open', 'resolved', 'closed'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const STATUS_BADGE: Record<string, string> = {
  open:     'bg-amber-500/15 text-amber-300 border-amber-500/30',
  resolved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  closed:   'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const CATEGORY_BADGE: Record<string, string> = {
  bug:        'bg-red-500/15 text-red-300',
  account:    'bg-purple-500/15 text-purple-300',
  prediction: 'bg-sky-500/15 text-sky-300',
  general:    'bg-slate-500/15 text-slate-400',
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso.slice(0, 16).replace('T', ' ');
  }
}

export default function AdminSupport() {
  const [tab, setTab] = useState<StatusTab>('all');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [updating, setUpdating] = useState(false);

  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTickets({
        status: tab === 'all' ? undefined : tab,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setTickets(res.items);
      setTotal(res.total);
    } catch {
      // silently handled — empty state shown
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    document.title = 'Support Inbox | Car Worth';
    return () => { document.title = 'Car Worth | Vehicle Sale Prediction'; };
  }, []);

  useEffect(() => {
    setPage(0);
    setSelected(null);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (ticket: SupportTicket, newStatus: SupportTicket['status']) => {
    setUpdating(true);
    try {
      const updated = await updateTicketStatus(ticket.id, newStatus);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      if (selected?.id === updated.id) setSelected(updated);
    } catch {
      // noop
    } finally {
      setUpdating(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Support Inbox</h1>
          <p className="text-slate-400 text-sm mt-1">{total} ticket{total !== 1 ? 's' : ''} total</p>
        </div>
        <button
          onClick={load}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-slate-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border capitalize transition-all ${
              tab === t
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
                : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Ticket Table */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-500">
              <svg className="w-6 h-6 animate-spin mr-2" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
              Loading tickets…
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
              <p>No tickets found.</p>
            </div>
          ) : (
            <>
              <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs text-slate-500 uppercase tracking-wide">
                        <th className="text-left px-4 py-3 font-semibold">#</th>
                        <th className="text-left px-4 py-3 font-semibold">From</th>
                        <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Subject</th>
                        <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Category</th>
                        <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Date</th>
                        <th className="text-left px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((ticket) => (
                        <tr
                          key={ticket.id}
                          onClick={() => setSelected(ticket.id === selected?.id ? null : ticket)}
                          className={`border-b border-white/5 cursor-pointer transition-colors ${
                            selected?.id === ticket.id
                              ? 'bg-sky-500/10'
                              : 'hover:bg-white/5'
                          }`}
                        >
                          <td className="px-4 py-3 font-mono text-slate-400 text-xs">#{ticket.id}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-100 truncate max-w-[120px]">{ticket.name}</p>
                            <p className="text-xs text-slate-500 truncate max-w-[120px]">{ticket.email}</p>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="text-slate-200 truncate max-w-[180px] block">{ticket.subject}</span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${CATEGORY_BADGE[ticket.category] || CATEGORY_BADGE.general}`}>
                              {ticket.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs whitespace-nowrap">
                            {formatDate(ticket.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize border ${STATUS_BADGE[ticket.status] || STATUS_BADGE.open}`}>
                              {ticket.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
                  <span>Page {page + 1} of {totalPages}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selected && (
            <motion.aside
              key={selected.id}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={{ duration: 0.2 }}
              className="w-full lg:w-96 shrink-0 bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl p-6 space-y-5 self-start"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500 font-mono">Ticket #{selected.id}</p>
                  <h2 className="text-base font-bold text-slate-100 mt-0.5 break-words">{selected.subject}</h2>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                  aria-label="Close detail panel"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Meta */}
              <div className="text-sm space-y-2 text-slate-300">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  <span>{selected.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <a href={`mailto:${selected.email}`} className="text-sky-400 hover:underline break-all">{selected.email}</a>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span>{formatDate(selected.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${CATEGORY_BADGE[selected.category] || CATEGORY_BADGE.general}`}>
                    {selected.category}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize border ${STATUS_BADGE[selected.status] || STATUS_BADGE.open}`}>
                    {selected.status}
                  </span>
                </div>
              </div>

              {/* Message */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Message</p>
                <div className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                  {selected.message}
                </div>
              </div>

              {/* Attachment */}
              {selected.attachment_name && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Attachment</p>
                  <a
                    href={getAttachmentUrl(selected.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm text-slate-200"
                  >
                    <svg className="w-5 h-5 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="truncate">{selected.attachment_name}</span>
                    <svg className="w-4 h-4 text-slate-500 shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                </div>
              )}

              {/* Status Update */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Change Status</p>
                <div className="flex gap-2 flex-wrap">
                  {(['open', 'resolved', 'closed'] as const).map((s) => (
                    <button
                      key={s}
                      disabled={selected.status === s || updating}
                      onClick={() => handleStatusChange(selected, s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        selected.status === s
                          ? `${STATUS_BADGE[s]} cursor-default`
                          : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reply shortcut */}
              <a
                href={`mailto:${selected.email}?subject=Re: [Ticket %23${selected.id}] ${encodeURIComponent(selected.subject)}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 transition-all shadow-md shadow-sky-500/20"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                Reply via Email
              </a>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
