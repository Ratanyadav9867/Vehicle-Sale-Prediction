import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function NotFound() {
  useEffect(() => {
    document.title = 'Page Not Found | Car Worth';
  }, []);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md mx-auto space-y-6"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 font-mono text-3xl font-bold shadow-lg shadow-sky-500/10">
          404
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white tracking-tight">Page Not Found</h1>
          <p className="text-sm text-gray-400">
            The page you're looking for doesn't exist, has been moved, or is temporarily unavailable.
          </p>
        </div>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 shadow-lg shadow-sky-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Return to Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
