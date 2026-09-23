import { Link } from 'react-router-dom';
import { GuestOnly } from '../auth/GuestOnly';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/70 backdrop-blur-md py-12 mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo & Branding -> logo-full on white chip */}
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <Link to="/" className="flex items-center gap-3.5 group cursor-pointer focus:outline-none" aria-label="Car Worth Home">
              <img
                src="/logo-full.png"
                alt="Car Worth logo"
                width={56}
                height={53}
                className="h-[52px] sm:h-[60px] w-auto object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)] group-hover:scale-105 transition-transform"
              />
              <div>
                <p className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">Car Worth</p>
                <p className="text-xs text-slate-400">Know what your car is worth</p>
              </div>
            </Link>
          </div>

          {/* Router NavLinks (no dead href="#" or reload) */}
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <Link to="/" className="text-slate-300 hover:text-sky-300 transition-colors">
              Home
            </Link>
            <Link to="/market-analysis" className="text-slate-300 hover:text-sky-300 transition-colors">
              Market Analysis
            </Link>
            <Link to="/model-architecture" className="text-slate-300 hover:text-sky-300 transition-colors">
              Model Architecture
            </Link>
            <Link to="/about" className="text-slate-300 hover:text-sky-300 transition-colors">
              About Project
            </Link>
            <Link to="/support" className="text-slate-300 hover:text-sky-300 transition-colors">
              Support
            </Link>
          </nav>

          {/* Copyright */}
          <p className="text-slate-500 text-xs text-center md:text-right">
            © {new Date().getFullYear()} Car Worth. All rights reserved.
          </p>
        </div>

        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 text-center sm:text-left">
          <p>
            Automotive Valuation Intelligence · Powered by Gradient Boosting Regressor ML Pipeline
          </p>
          <div className="flex items-center gap-4">
            <GuestOnly>
              <Link to="/login" className="hover:text-white transition-colors">
                Sign In
              </Link>
              <Link to="/register" className="hover:text-white transition-colors">
                Register
              </Link>
            </GuestOnly>
            <Link to="/admin/login" className="hover:text-amber-400 transition-colors">
              Admin Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
