import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { submitTicket } from '../api/support';

const SUPPORT_EMAIL = 'support@example.com';

const FAQS = [
  {
    q: 'How does the price prediction work?',
    a: 'Car Worth uses a Gradient Boosting Regressor trained on thousands of real used-car transactions. You enter details like brand, year, mileage, fuel type, and condition, and the model returns an estimated market price in Lakh INR.',
  },
  {
    q: 'How accurate are the predictions?',
    a: 'The model achieves an R² score above 0.95 on our test set. Predictions are estimates — actual market prices can vary based on local demand, vehicle condition, and negotiation.',
  },
  {
    q: 'Which car types are supported?',
    a: 'The model is trained on Indian used-car data covering most popular brands. Petrol, Diesel, and CNG fuel types are supported. Electric vehicles are not yet included.',
  },
  {
    q: 'I cannot log in / my account is locked. What should I do?',
    a: 'After 5 failed login attempts your account is temporarily locked for 15 minutes. If it stays locked, use the contact form below or email us directly and we will unlock it manually.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Submit a ticket using the "Account Help" category and we will permanently delete your account and all associated data within 48 hours.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. We store only the vehicle details you enter to generate and save your prediction history. We never sell or share your data with third parties.',
  },
  {
    q: 'The prediction is not loading. What should I try?',
    a: 'First check your internet connection, then refresh the page. If the issue persists, the ML model server may be temporarily unavailable — try again in a few minutes or contact support.',
  },
];

const CATEGORIES = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'account', label: 'Account Help' },
  { value: 'prediction', label: 'Prediction Issue' },
  { value: 'general', label: 'General Enquiry' },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left bg-white/5 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50"
        aria-expanded={open}
      >
        <span className="text-sm sm:text-base font-medium text-slate-100">{q}</span>
        <svg
          className={`w-5 h-5 shrink-0 text-sky-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <p className="px-5 py-4 text-sm text-slate-300 bg-white/[0.03] border-t border-white/10">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FormState {
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
  file: File | null;
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

export default function Support() {
  const { user } = useAuth();
  const openedAt = useRef(Date.now());
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [ticketId, setTicketId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [form, setForm] = useState<FormState>({
    name: user?.name || '',
    email: user?.email || '',
    subject: '',
    category: 'general',
    message: '',
    file: null,
  });

  // Keep name/email in sync if user logs in after page load
  useEffect(() => {
    if (user) {
      setForm((f) => ({ ...f, name: f.name || user.name, email: f.email || user.email }));
    }
  }, [user]);

  useEffect(() => {
    document.title = 'Support | Car Worth';
    return () => { document.title = 'Car Worth | Vehicle Sale Prediction'; };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback — browser clipboard denied
    }
  };

  const updateField = (field: keyof FormState, value: string | File | null) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleFile = (file: File | null) => {
    if (!file) { updateField('file', null); return; }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setErrors((e) => ({ ...e, file: 'Only JPG, PNG, or WebP images are accepted.' }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors((e) => ({ ...e, file: 'File must be smaller than 2 MB.' }));
      return;
    }
    updateField('file', file);
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Valid email is required.';
    if (!form.subject.trim()) errs.subject = 'Subject is required.';
    if (form.message.trim().length < 20) errs.message = 'Message must be at least 20 characters.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitState('loading');
    const fillTime = (Date.now() - openedAt.current) / 1000;

    const fd = new FormData();
    fd.append('name', form.name.trim());
    fd.append('email', form.email.trim().toLowerCase());
    fd.append('subject', form.subject.trim());
    fd.append('category', form.category);
    fd.append('message', form.message.trim());
    fd.append('fill_time', String(Math.round(fillTime)));
    fd.append('website', ''); // honeypot always empty
    if (form.file) fd.append('attachment', form.file);

    try {
      const res = await submitTicket(fd);
      setTicketId(res.ticket_id);
      setSubmitState('success');
    } catch {
      setSubmitState('error');
    }
  };

  const cardClass =
    'bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl shadow-black/30 p-6 sm:p-8';

  return (
    <div className="min-h-screen text-gray-100">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24 space-y-12">

        {/* ── Hero ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4"
        >
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight bg-gradient-to-br from-sky-300 via-cyan-200 to-white bg-clip-text text-transparent">
            How can we help?
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto">
            Tell us about any issue and we&apos;ll reply by email.
          </p>

          {/* Email contact block */}
          <div className="inline-flex flex-wrap items-center justify-center gap-3 mt-2">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              id="support-email-link"
              className="text-sky-400 hover:text-sky-300 font-mono text-sm sm:text-base underline underline-offset-2 transition-colors"
            >
              {SUPPORT_EMAIL}
            </a>
            <button
              onClick={handleCopy}
              id="copy-email-btn"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 transition-colors border border-white/10"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  Copy email
                </>
              )}
            </button>
          </div>
          <p className="text-slate-500 text-xs">
            We usually reply within 24–48 hours.
          </p>
        </motion.div>

        {/* ── FAQ ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          aria-labelledby="faq-heading"
        >
          <div className={cardClass}>
            <h2 id="faq-heading" className="text-lg font-bold text-slate-100 mb-5">
              Frequently Asked Questions
            </h2>
            <div className="space-y-2">
              {FAQS.map((item) => (
                <FAQItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── Contact Form ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          aria-labelledby="contact-heading"
        >
          <div className={cardClass}>
            <h2 id="contact-heading" className="text-lg font-bold text-slate-100 mb-6">
              Send us a Message
            </h2>

            {/* ── Success State ── */}
            {submitState === 'success' && (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-emerald-300">Message Sent!</h3>
                {ticketId && (
                  <p className="text-slate-300 text-sm">
                    Your ticket ID is <span className="font-mono font-bold text-sky-300">#{ticketId}</span>.
                  </p>
                )}
                <p className="text-slate-400 text-sm max-w-xs mx-auto">
                  Check your inbox — we sent a confirmation to <strong>{form.email}</strong>. We usually reply within 24–48 hours.
                </p>
                <button
                  onClick={() => { setSubmitState('idle'); setForm((f) => ({ ...f, subject: '', message: '', file: null })); }}
                  className="mt-2 text-sky-400 hover:text-sky-300 text-sm underline underline-offset-2 transition-colors"
                >
                  Submit another ticket
                </button>
              </div>
            )}

            {/* ── Error Banner ── */}
            {submitState === 'error' && (
              <div role="alert" className="mb-5 flex items-start gap-3 bg-red-500/15 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>
                  Couldn&apos;t send your message. Please email us directly at{' '}
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline hover:text-red-200">{SUPPORT_EMAIL}</a>.
                </span>
              </div>
            )}

            {/* ── Form ── */}
            {submitState !== 'success' && (
              <form onSubmit={handleSubmit} noValidate className="space-y-5" id="support-form">
                {/* Honeypot */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  aria-hidden="true"
                  autoComplete="off"
                  style={{ display: 'none' }}
                />

                {/* Name + Email */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="sup-name" className="block text-xs font-semibold text-slate-400 mb-1.5">
                      Your Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="sup-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      readOnly={!!user}
                      autoComplete="name"
                      placeholder="Ratan Yadav"
                      className={`w-full px-4 py-2.5 rounded-xl bg-white/5 border text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-colors ${errors.name ? 'border-red-500/60' : 'border-white/10'} ${user ? 'opacity-70 cursor-not-allowed' : ''}`}
                    />
                    {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor="sup-email" className="block text-xs font-semibold text-slate-400 mb-1.5">
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="sup-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      readOnly={!!user}
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={`w-full px-4 py-2.5 rounded-xl bg-white/5 border text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-colors ${errors.email ? 'border-red-500/60' : 'border-white/10'} ${user ? 'opacity-70 cursor-not-allowed' : ''}`}
                    />
                    {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
                  </div>
                </div>

                {/* Subject + Category */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="sup-subject" className="block text-xs font-semibold text-slate-400 mb-1.5">
                      Subject <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="sup-subject"
                      type="text"
                      value={form.subject}
                      onChange={(e) => updateField('subject', e.target.value)}
                      placeholder="Briefly describe your issue"
                      className={`w-full px-4 py-2.5 rounded-xl bg-white/5 border text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-colors ${errors.subject ? 'border-red-500/60' : 'border-white/10'}`}
                    />
                    {errors.subject && <p className="mt-1 text-xs text-red-400">{errors.subject}</p>}
                  </div>
                  <div>
                    <label htmlFor="sup-category" className="block text-xs font-semibold text-slate-400 mb-1.5">
                      Category
                    </label>
                    <select
                      id="sup-category"
                      value={form.category}
                      onChange={(e) => updateField('category', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-colors"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="sup-message" className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Message <span className="text-red-400">*</span>
                    <span className="ml-1 font-normal text-slate-500">(min 20 characters)</span>
                  </label>
                  <textarea
                    id="sup-message"
                    value={form.message}
                    onChange={(e) => updateField('message', e.target.value)}
                    rows={5}
                    placeholder="Describe your issue in detail..."
                    className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 resize-y transition-colors ${errors.message ? 'border-red-500/60' : 'border-white/10'}`}
                  />
                  <div className="flex items-center justify-between mt-1">
                    {errors.message ? (
                      <p className="text-xs text-red-400">{errors.message}</p>
                    ) : <span />}
                    <p className={`text-xs ${form.message.length < 20 ? 'text-slate-600' : 'text-emerald-500'}`}>
                      {form.message.length} / 5000
                    </p>
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Attachment <span className="font-normal text-slate-500">(optional — JPG/PNG/WebP, max 2 MB)</span>
                  </label>
                  <div
                    role="button"
                    tabIndex={0}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0] ?? null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('file-input')?.click(); } }}
                    onClick={() => document.getElementById('file-input')?.click()}
                    className={`border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-colors ${dragOver ? 'border-sky-400 bg-sky-500/10' : 'border-white/15 hover:border-white/30 bg-white/[0.02]'} ${errors.file ? 'border-red-500/60' : ''}`}
                    aria-label="Upload attachment"
                  >
                    {form.file ? (
                      <div className="flex items-center justify-center gap-3 text-sm">
                        <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="text-slate-200 font-medium truncate max-w-[200px]">{form.file.name}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); updateField('file', null); }}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                          aria-label="Remove file"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ) : (
                      <div className="text-slate-500 text-sm space-y-1">
                        <svg className="w-8 h-8 mx-auto text-slate-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        <p>Drag & drop or click to select a screenshot</p>
                      </div>
                    )}
                    <input
                      id="file-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  {errors.file && <p className="mt-1 text-xs text-red-400">{errors.file}</p>}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitState === 'loading'}
                  id="support-submit-btn"
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-sky-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-sky-400/60"
                >
                  {submitState === 'loading' ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                      Sending…
                    </span>
                  ) : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
