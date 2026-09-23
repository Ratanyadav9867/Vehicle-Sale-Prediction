import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { GuestOnly } from '../components/auth/GuestOnly';

const AUDIENCE_SEGMENTS = [
  {
    title: 'Individual Car Sellers',
    desc: 'Avoid undervaluation by dealerships or aggressive trade-in offers with an impartial, data-backed fair market baseline.',
    icon: '👤',
  },
  {
    title: 'Prospective Buyers',
    desc: 'Verify whether a listed used-car price is reasonable before making an offer or entering negotiations.',
    icon: '🛒',
  },
  {
    title: 'Automotive Dealerships',
    desc: 'Price inventory efficiently and substantiate trade-in offers with statistical transparency for customers.',
    icon: '🏢',
  },
  {
    title: 'Insurers & Finance Analysts',
    desc: 'Assess realistic vehicle value retention, risk exposure, and residual value curves over vehicle lifespans.',
    icon: '📊',
  },
];

const KEY_FEATURES = [
  {
    title: 'Instant Machine Learning Valuations',
    desc: 'Trained Gradient Boosting models calculate market value in under 15ms without manual spreadsheet guesswork.',
    icon: '⚡',
  },
  {
    title: 'Comprehensive Parameter Analysis',
    desc: 'Evaluates 7 distinct vehicle variables including brand, showroom price, age, odometer mileage, and transmission.',
    icon: '🔍',
  },
  {
    title: 'Secure Accounts & Prediction History',
    desc: 'Every valuation is saved to your personal history list for easy reference, comparison, and exporting.',
    icon: '🔒',
  },
  {
    title: 'Empirical Market Transparency',
    desc: 'Backed by real historical resale transaction datasets rather than anecdotal or arbitrary dealer markups.',
    icon: '📈',
  },
];

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Create Account or Sign In',
    desc: 'Register a free account or log in securely to access our private valuation tools and cloud-saved history.',
  },
  {
    step: '2',
    title: 'Enter Vehicle Details',
    desc: 'Provide your car’s manufacturing year, present showroom price, kilometers driven, fuel type, and transmission.',
  },
  {
    step: '3',
    title: 'Get Instant Fair Market Price',
    desc: 'Receive immediate price estimation in Indian Lakhs / Rupees with detailed depreciation breakdowns.',
  },
];

const TECH_STACK_SUMMARY = [
  { name: 'FastAPI (Python)', role: 'High-speed REST API & Model Serving' },
  { name: 'Scikit-learn', role: 'Gradient Boosting Regressor & Encoders' },
  { name: 'React 19 & TypeScript', role: 'Interactive, type-safe web frontend' },
  { name: 'Tailwind CSS v4', role: 'Dark mode styling with sky-cyan accents' },
  { name: 'SQLite with WAL', role: 'User accounts, prediction records & audit logs' },
  { name: 'Recharts', role: 'Market telemetry & depreciation charts' },
];

export default function About() {
  useEffect(() => {
    document.title = 'About Project | Car Worth';
  }, []);

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      {/* Header & Purpose of Car Worth */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-3xl mx-auto space-y-4"
      >
        <div className="mb-4">
          <img
            src="/logo-full.png"
            alt="Car Worth logo"
            width={160}
            height={152}
            className="h-28 sm:h-36 md:h-40 w-auto mx-auto object-contain drop-shadow-[0_8px_32px_rgba(0,0,0,0.7)] hover:scale-105 transition-transform duration-300"
          />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-wider">
          Empowering Automotive Decisions
        </div>
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight">
          About Car Worth
        </h1>
        <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
          Car Worth exists to eliminate the friction, opacity, and guesswork in used vehicle transactions.
          By combining historical automotive datasets with calibrated machine learning estimators,
          we provide buyers and sellers with an unbiased, transparent estimate of a vehicle's true market worth.
        </p>
      </motion.div>

      {/* What It Does & Who It Is For */}
      <div className="space-y-6">
        <div>
          <div className="text-xs font-mono text-sky-400 uppercase tracking-wider">Audience & Use Cases</div>
          <h2 className="text-2xl font-bold text-white mt-1">Who Car Worth Is For</h2>
          <p className="text-sm text-gray-400 mt-1">
            Built for everyday drivers, automotive professionals, and market analysts alike.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {AUDIENCE_SEGMENTS.map((item, idx) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.4 }}
              className="glass p-6 rounded-2xl border border-white/10 hover:border-sky-500/30 transition-all space-y-3 group"
            >
              <div className="text-3xl p-2 rounded-xl bg-white/5 w-fit">{item.icon}</div>
              <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
                {item.title}
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Key Features */}
      <div className="space-y-6">
        <div>
          <div className="text-xs font-mono text-sky-400 uppercase tracking-wider">Platform Capabilities</div>
          <h2 className="text-2xl font-bold text-white mt-1">Key Features</h2>
          <p className="text-sm text-gray-400 mt-1">
            Core technological strengths that set Car Worth apart from rule-of-thumb valuation tools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {KEY_FEATURES.map((feat, idx) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.4 }}
              className="glass p-6 sm:p-8 rounded-2xl border border-white/10 hover:border-sky-500/30 transition-all space-y-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl p-2 rounded-xl bg-white/5">{feat.icon}</span>
                <h3 className="text-lg font-bold text-white">{feat.title}</h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* How It Works (3 Steps) */}
      <div className="glass p-6 sm:p-10 rounded-2xl border border-white/10 space-y-8">
        <div>
          <div className="text-xs font-mono text-sky-400 uppercase tracking-wider">Simple 3-Step Process</div>
          <h2 className="text-2xl font-bold text-white mt-1">How It Works</h2>
          <p className="text-sm text-gray-400 mt-1">
            Getting an accurate vehicle valuation takes less than a minute.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map((flow) => (
            <div key={flow.step} className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center text-white font-mono font-bold text-lg shadow-md shadow-sky-500/20">
                {flow.step}
              </div>
              <h3 className="text-base font-bold text-white">{flow.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{flow.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="glass p-6 sm:p-8 rounded-2xl border border-white/10 space-y-6">
        <div>
          <div className="text-xs font-mono text-sky-400 uppercase tracking-wider">Under the Hood</div>
          <h2 className="text-2xl font-bold text-white mt-1">Technology Architecture</h2>
          <p className="text-sm text-gray-400 mt-1">
            Production-grade stack ensuring speed, reliability, and security.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TECH_STACK_SUMMARY.map((tech) => (
            <div key={tech.name} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
              <div className="text-sm font-semibold text-white">{tech.name}</div>
              <div className="text-xs text-gray-400">{tech.role}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Call to Action Buttons (Visible for Guests only) */}
      <GuestOnly>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-sky-950/50 via-gray-900/90 to-cyan-950/40 border border-sky-500/30 text-center space-y-6 shadow-2xl"
        >
          <div className="space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Ready to Discover Your Vehicle’s Worth?
            </h2>
            <p className="text-sm text-gray-300">
              Sign in or create a free account to access our predictive model and view saved valuations.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              to="/login"
              className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 shadow-lg shadow-sky-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-center cursor-pointer"
            >
              Sign in to predict your vehicle price
            </Link>
            <Link
              to="/register"
              className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-sm text-gray-200 hover:text-white bg-white/10 hover:bg-white/15 border border-white/15 transition-all text-center cursor-pointer"
            >
              Create a free account
            </Link>
          </div>
        </motion.div>
      </GuestOnly>
    </div>
  );
}
