import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface AuthPopupProps {
  isOpen: boolean;
  onClose: () => void;
  type?: 'error' | 'warning' | 'success';
  title?: string;
  message: string;
  code?: string;
  actionLink?: {
    text: string;
    to: string;
  };
  failingInputId?: string;
  autoDismissMs?: number;
}

export const AuthPopup: React.FC<AuthPopupProps> = ({
  isOpen,
  onClose,
  type = 'error',
  title,
  message,
  code,
  actionLink,
  failingInputId,
  autoDismissMs = 5000,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const remainingTimeRef = useRef(autoDismissMs);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<any>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Focus trap / initial focus on popup
  useEffect(() => {
    if (isOpen && popupRef.current) {
      popupRef.current.focus();
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, failingInputId]);

  // Timer handling with hover pause
  useEffect(() => {
    if (!isOpen || autoDismissMs <= 0) return;

    remainingTimeRef.current = autoDismissMs;
    startTimeRef.current = Date.now();

    const startTimer = () => {
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, remainingTimeRef.current);
    };

    if (!isPaused) {
      startTimer();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen, isPaused, autoDismissMs]);

  const handleMouseEnter = () => {
    if (autoDismissMs <= 0) return;
    setIsPaused(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
  };

  const handleMouseLeave = () => {
    if (autoDismissMs <= 0) return;
    startTimeRef.current = Date.now();
    setIsPaused(false);
  };

  const handleDismiss = () => {
    onClose();
    if (failingInputId) {
      setTimeout(() => {
        const el = document.getElementById(failingInputId);
        if (el) {
          el.focus();
          if ('select' in el && typeof (el as HTMLInputElement).select === 'function') {
            (el as HTMLInputElement).select();
          }
        }
      }, 50);
    }
  };

  const config = {
    error: {
      border: 'border-rose-500/40',
      bg: 'bg-gradient-to-r from-rose-950/90 via-slate-900/95 to-slate-900/95',
      glow: 'shadow-[0_8px_30px_rgba(244,63,94,0.25)]',
      iconColor: 'text-rose-400',
      titleColor: 'text-rose-200',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      Icon: AlertCircle,
      defaultTitle: 'Authentication Error',
    },
    warning: {
      border: 'border-amber-500/40',
      bg: 'bg-gradient-to-r from-amber-950/90 via-slate-900/95 to-slate-900/95',
      glow: 'shadow-[0_8px_30px_rgba(245,158,11,0.25)]',
      iconColor: 'text-amber-400',
      titleColor: 'text-amber-200',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      Icon: AlertTriangle,
      defaultTitle: 'Notice',
    },
    success: {
      border: 'border-emerald-500/40',
      bg: 'bg-gradient-to-r from-emerald-950/90 via-slate-900/95 to-slate-900/95',
      glow: 'shadow-[0_8px_30px_rgba(16,185,129,0.25)]',
      iconColor: 'text-emerald-400',
      titleColor: 'text-emerald-200',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      Icon: CheckCircle2,
      defaultTitle: 'Success',
    },
  }[type];

  const CurrentIcon = config.Icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={popupRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`relative w-full rounded-xl border ${config.border} ${config.bg} ${config.glow} backdrop-blur-xl p-4 my-3 outline-none text-left z-50`}
        >
          <div className="flex items-start gap-3">
            <div className={`p-1.5 rounded-lg bg-black/30 border border-white/5 shrink-0 mt-0.5 ${config.iconColor}`}>
              <CurrentIcon className="w-5 h-5" aria-hidden="true" />
            </div>

            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-sm font-semibold tracking-wide ${config.titleColor}`}>
                  {title || config.defaultTitle}
                </span>
                {code && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider ${config.badgeColor}`}>
                    {code}
                  </span>
                )}
              </div>

              <p className="text-sm text-slate-200 leading-relaxed font-normal">
                {message}
              </p>

              {actionLink && (
                <div className="mt-2.5 pt-2 border-t border-white/10">
                  <Link
                    to={actionLink.to}
                    onClick={handleDismiss}
                    className="inline-flex items-center gap-1 text-sm font-medium text-sky-400 hover:text-sky-300 hover:underline transition-colors"
                  >
                    <span>{actionLink.text}</span>
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss notification"
              className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Micro progress indicator for auto-dismiss */}
          {autoDismissMs > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden rounded-b-xl bg-white/5">
              <div
                className={`h-full ${type === 'error' ? 'bg-rose-500' : type === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'} transition-all duration-300 opacity-60`}
                style={{
                  animation: !isPaused ? `shrinkWidth ${autoDismissMs}ms linear forwards` : 'none',
                }}
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
