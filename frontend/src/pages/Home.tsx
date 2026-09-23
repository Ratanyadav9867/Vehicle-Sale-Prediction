import { lazy, Suspense, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { GuestOnly } from '../components/auth/GuestOnly';

// Lazy-loaded 3D Showroom Showcase
const ShowroomShowcase = lazy(() => import('../components/three/ShowroomShowcase'));

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Create an account or sign in',
    desc: 'Register in seconds or log into your verified user account to unlock access to our AI valuation engine.',
    icon: (
      <svg className="w-6 h-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    step: '02',
    title: 'Enter your vehicle details',
    desc: 'Provide your car brand, model year, showroom price, mileage driven, fuel type, transmission, and ownership condition.',
    icon: (
      <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    step: '03',
    title: 'Get your predicted price',
    desc: 'Receive an instant, real-time estimated resale valuation in Lakhs and INR calculated by our machine learning model.',
    icon: (
      <svg className="w-6 h-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const BENEFITS = [
  {
    title: 'Fast & Real-Time',
    desc: 'Instant valuations delivered in under a second with no tedious manual surveys or long waiting periods.',
    icon: '⚡',
    border: 'hover:border-sky-500/40',
  },
  {
    title: 'Data-Driven Precision',
    desc: 'Trained on comprehensive historical automobile transactions using GradientBoosting ML algorithms.',
    icon: '🧠',
    border: 'hover:border-cyan-500/40',
  },
  {
    title: 'Easy to Use',
    desc: 'Streamlined, mobile-friendly interface designed for any everyday car buyer or seller.',
    icon: '✨',
    border: 'hover:border-teal-500/40',
  },
  {
    title: 'Secure Account',
    desc: 'Private user sessions, encrypted credentials, and historical logs of all your past valuations.',
    icon: '🛡️',
    border: 'hover:border-indigo-500/40',
  },
];

export default function Home() {
  useEffect(() => {
    document.title = 'Car Worth | Vehicle Sale Prediction';
  }, []);

  return (
    <div className="relative">
      {/* ── 1. HERO BANNER (Car Worth on single line with text-shadow over video) ── */}
      <section className="relative min-h-[65vh] sm:min-h-[75vh] flex flex-col items-center justify-center text-center px-4 pt-12 pb-16 pointer-events-none select-none">
        <h1 className="font-mono text-[clamp(2.4rem,9vw,8rem)] font-black tracking-tighter uppercase leading-none whitespace-nowrap text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]">
          Car Worth
        </h1>
        <p className="mt-4 font-mono text-xs sm:text-sm md:text-base max-w-xl text-slate-200 font-medium px-4 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
          Know what your car is worth: smart, data-driven price predictions in seconds.
        </p>
      </section>

      {/* ── 2. NEW 3D CAR SHOWCASE SECTION ─────────────────────────────────── */}
      <Suspense
        fallback={
          <section className="relative w-full py-16 sm:py-20 lg:py-24">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center mb-8 sm:mb-12">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
                Price it right. Sell it faster.
              </h2>
              <p className="mt-3 text-base sm:text-lg font-medium text-slate-300">
                Data-driven predictions to help you sell with confidence.
              </p>
            </div>
            <div className="max-w-6xl mx-auto h-[60vh] min-h-[340px] max-h-[640px] rounded-3xl" />
          </section>
        }
      >
        <ShowroomShowcase />
      </Suspense>

      {/* ── 3. HERO FEATURE SHOWCASE ───────────────────────────────────────── */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-3xl space-y-6">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-semibold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              Car Worth Market Intelligence
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.1] text-white">
              AI-Powered Accurate Vehicle Valuation
            </h2>
            <p className="mt-3 text-base sm:text-lg font-medium bg-gradient-to-r from-sky-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Predict fair market selling prices with trained machine learning intelligence.
            </p>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl"
          >
            Car Worth analyzes vehicle characteristics, market depreciation patterns, and historical sales data to help you determine transparent, realistic valuations before buying or selling.
          </motion.p>

          {/* CTAs (Visible to Guests only) */}
          <GuestOnly>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="flex flex-wrap items-center gap-4 pt-2"
            >
              <Link
                to="/login"
                className="px-6 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 shadow-xl shadow-sky-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 cursor-pointer"
              >
                Sign in to predict your vehicle price
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
              <Link
                to="/register"
                className="px-6 py-3.5 rounded-xl font-semibold text-sm text-gray-200 bg-white/10 hover:bg-white/15 border border-white/10 hover:text-white transition-all transform hover:-translate-y-0.5 cursor-pointer"
              >
                Create a free account
              </Link>
            </motion.div>
          </GuestOnly>

          {/* Quick stats badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="pt-4 flex items-center gap-6 text-xs text-gray-400"
          >
            <div className="flex items-center gap-2">
              <span className="text-sky-400 font-bold text-sm">96.1%</span>
              <span>Model R² Score</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-gray-600" />
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold text-sm">₹45K</span>
              <span>Mean Absolute Error</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-gray-600" />
            <div className="flex items-center gap-2">
              <span className="text-teal-400 font-bold text-sm">&lt; 100ms</span>
              <span>Fast Inference</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 4. WHAT IT DOES & PURPOSE ────────────────────────────────────── */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-white/10">
        <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-stretch">
          {/* What it does */}
          <motion.div
            custom={0}
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="bg-slate-900/60 p-8 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-5">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <span className="text-xs uppercase font-bold tracking-wider text-sky-400">Core Capability</span>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1 mb-4">What It Does</h3>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Car Worth predicts current market prices of used and pre-owned vehicles using modern machine learning and data analysis. By evaluating key attributes—such as brand, model year, original showroom price, cumulative mileage, fuel type, transmission, and ownership condition—it generates highly accurate, real-world valuations in real time.
              </p>
            </div>
            <div className="mt-6 pt-6 border-t border-white/10 flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span className="text-sky-400 font-bold">&check;</span> Inputs: Brand &bull; Year &bull; Mileage &bull; Fuel &bull; Transmission &bull; Owners
            </div>
          </motion.div>

          {/* Purpose */}
          <motion.div
            custom={1}
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="bg-slate-900/60 p-8 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-5">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-xs uppercase font-bold tracking-wider text-teal-400">Our Mission</span>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1 mb-4">Why We Built It</h3>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                The used vehicle market frequently suffers from opaque pricing, high dealer markups, and uncertain fair values. Our goal is to bring total transparency and algorithmic objectivity to vehicle transactions, empowering everyday buyers and sellers with accurate benchmark intelligence before they negotiate.
              </p>
            </div>
            <div className="mt-6 pt-6 border-t border-white/10 flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span className="text-teal-400 font-bold">&check;</span> Objective ML &bull; Zero Dealer Bias &bull; Free Transparency
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 5. HOW IT WORKS ──────────────────────────────────────────────── */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-white/10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs uppercase font-bold tracking-wider text-sky-400">Simple 3-Step Process</span>
          <h2 className="text-3xl sm:text-4xl font-black text-white mt-2 mb-4">How Car Worth Works</h2>
          <p className="text-slate-300 text-sm sm:text-base">
            From vehicle specifications to an AI-verified valuation in three effortless steps.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {HOW_IT_WORKS.map((item, idx) => (
            <motion.div
              key={item.step}
              custom={idx}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="relative p-8 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md hover:border-sky-500/30 transition-all group"
            >
              <div className="text-4xl font-mono font-black text-slate-700/60 mb-6 group-hover:text-sky-500/40 transition-colors">
                {item.step}
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-white/10 flex items-center justify-center mb-5">
                {item.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 6. BENEFITS & FEATURES ───────────────────────────────────────── */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-white/10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs uppercase font-bold tracking-wider text-cyan-400">Platform Advantages</span>
          <h2 className="text-3xl sm:text-4xl font-black text-white mt-2 mb-4">Why Choose Car Worth</h2>
          <p className="text-slate-300 text-sm sm:text-base">
            Engineered for precision, security, and an effortless user experience.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {BENEFITS.map((b, i) => (
            <motion.div
              key={b.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className={`p-6 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md ${b.border} transition-all`}
            >
              <div className="text-3xl mb-4">{b.icon}</div>
              <h3 className="text-base font-bold text-white mb-2">{b.title}</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 7. MARKET ANALYSIS DASHBOARD PREVIEW ─────────────────────────── */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-white/10">
        <div className="rounded-3xl bg-gradient-to-r from-sky-950/40 via-slate-900/80 to-slate-900/90 border border-sky-500/20 p-8 sm:p-12 backdrop-blur-xl shadow-2xl">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider">
                Interactive Analytics
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                Explore Market Trends & Valuation Drivers
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Dive deeper than single price predictions. Our market analysis dashboard breaks down depreciation curves across ownership years, price distributions by fuel type, and transmission impact.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  to="/market-analysis"
                  className="px-6 py-3 rounded-xl font-bold text-sm text-white bg-sky-500 hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20"
                >
                  View Market Analysis &rarr;
                </Link>
                <Link
                  to="/model-architecture"
                  className="px-6 py-3 rounded-xl font-semibold text-sm text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  Model Architecture
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 text-center">
                <div className="text-2xl sm:text-3xl font-black text-sky-400 font-mono">15+</div>
                <div className="text-xs text-slate-400 mt-1 font-medium">Brands Evaluated</div>
              </div>
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 text-center">
                <div className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono">100%</div>
                <div className="text-xs text-slate-400 mt-1 font-medium">Algorithmic Precision</div>
              </div>
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 text-center">
                <div className="text-2xl sm:text-3xl font-black text-teal-400 font-mono">10 Yrs</div>
                <div className="text-xs text-slate-400 mt-1 font-medium">Historical Span</div>
              </div>
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 text-center">
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">0 Bias</div>
                <div className="text-xs text-slate-400 mt-1 font-medium">Pure Data Insight</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. CALL TO ACTION (Visible to Guests only) ────────────────────── */}
      <GuestOnly>
        <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-white/10">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
              Ready to value your vehicle?
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Join Car Worth today. Experience instant, data-driven valuations backed by machine learning intelligence.
            </p>
            <div className="flex flex-wrap justify-center items-center gap-4 pt-4">
              <Link
                to="/register"
                className="px-8 py-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500 hover:opacity-90 shadow-2xl shadow-sky-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                Create an account
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 rounded-xl font-semibold text-sm text-slate-200 bg-white/10 hover:bg-white/15 border border-white/10 hover:text-white transition-all transform hover:-translate-y-0.5"
              >
                Sign in to your account
              </Link>
            </div>
          </div>
        </section>
      </GuestOnly>

      {/* ── 9. FREQUENTLY ASKED QUESTIONS ─────────────────────────────────── */}
      <section className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-white/10">
        <div className="text-center mb-12">
          <span className="text-xs uppercase font-bold tracking-wider text-sky-400">Need Help?</span>
          <h2 className="text-3xl sm:text-4xl font-black text-white mt-2 mb-4">Frequently Asked Questions</h2>
          <p className="text-slate-300 text-sm">Everything you need to know about our valuation system.</p>
        </div>

        <div className="space-y-4">
          {[
            {
              q: 'How accurate is the Car Worth valuation model?',
              a: 'Our GradientBoosting model achieves an R² score of 96.1% and a Mean Absolute Error of ~₹45,000 on rigorous holdout evaluation splits, making it one of the most reliable automated benchmark tools available.',
            },
            {
              q: 'What information do I need to predict a vehicle price?',
              a: 'You will need the brand/make, manufacturing year, original ex-showroom price, cumulative distance driven (in km), fuel type, transmission type, and number of previous owners.',
            },
            {
              q: 'Is Car Worth free to use?',
              a: 'Yes, full access to vehicle price predictions, market analytics, and model transparency metrics is completely free for registered members.',
            },
            {
              q: 'How does mileage and age affect the predicted price?',
              a: 'Our model analyzes non-linear depreciation curves. Older model years and higher cumulative odometer readings result in progressive value depreciation, balanced against original showroom tier and brand retention patterns.',
            },
          ].map((faq, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md"
            >
              <h3 className="text-base font-bold text-white mb-2">{faq.q}</h3>
              <p className="text-slate-300 text-sm leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
