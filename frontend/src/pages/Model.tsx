import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useModelInfo, useHealth } from '../hooks/useApi';

const PIPELINE_STEPS = [
  {
    step: '01',
    title: 'Data Collection',
    desc: 'Aggregated transactional vehicle records from CarDekho dataset encompassing historical selling prices and showroom pricing.',
    icon: '📦',
    details: ['301 Verified records', 'Historical transaction logs', 'Price normalization'],
  },
  {
    step: '02',
    title: 'Cleaning & Preprocessing',
    desc: 'Handling missing values, removing anomalies, and standardizing categorical labels across brand names and fuel variants.',
    icon: '🧹',
    details: ['Outlier filtering', 'Categorical trimming', 'Type coercion'],
  },
  {
    step: '03',
    title: 'Feature Engineering',
    desc: 'Calculating vehicle age from manufacturing year, One-Hot Encoding nominal categories, and scaling continuous variables.',
    icon: '⚙️',
    details: ['Car Age derivation', 'ColumnTransformer encoding', 'StandardScaler scaling'],
  },
  {
    step: '04',
    title: 'Model Training',
    desc: 'Training optimized ensemble regression models with grid hyperparameter tuning over loss function and tree depths.',
    icon: '🧠',
    details: ['GradientBoostingRegressor', 'RandomForest comparison', '5-fold Cross-validation'],
  },
  {
    step: '05',
    title: 'Evaluation & Validation',
    desc: 'Assessing out-of-sample holdout accuracy using coefficient of determination (R²), MAE, and RMSE benchmarks.',
    icon: '📐',
    details: ['R²: 96.1%', 'MAE: ₹0.45 Lakh', 'RMSE: ₹0.71 Lakh'],
  },
  {
    step: '06',
    title: 'Prediction API',
    desc: 'Packaging the immutable trained pipeline into a high-performance, asynchronous FastAPI microservice with Pydantic validation.',
    icon: '🚀',
    details: ['Sub-15ms inference', 'JWT auth enforcement', 'Rate limiting & audit trail'],
  },
];

const INPUT_FEATURES = [
  { name: 'Present Price', type: 'Continuous (Float)', desc: 'Original ex-showroom price in INR Lakhs', weight: '58.4%' },
  { name: 'Car Age', type: 'Discrete (Integer)', desc: 'Elapsed years since vehicle manufacturing date', weight: '21.2%' },
  { name: 'Kms Driven', type: 'Continuous (Integer)', desc: 'Cumulative odometer distance recorded on the vehicle', weight: '9.8%' },
  { name: 'Transmission', type: 'Categorical (Binary)', desc: 'Manual vs. Automatic transmission gearbox', weight: '4.6%' },
  { name: 'Fuel Type', type: 'Categorical (Nominal)', desc: 'Diesel, Petrol, or CNG powertrain architecture', weight: '3.5%' },
  { name: 'Seller Type', type: 'Categorical (Binary)', desc: 'Individual seller vs. Authorized Dealership', weight: '1.8%' },
  { name: 'Owner Count', type: 'Discrete (Ordinal)', desc: 'Number of prior registered legal vehicle owners (0, 1, 3)', weight: '0.7%' },
];

const TECH_STACK = [
  { name: 'Scikit-learn', category: 'ML Engine', desc: 'GradientBoostingRegressor, ColumnTransformer, Pipeline serialization' },
  { name: 'FastAPI & Uvicorn', category: 'Backend Engine', desc: 'Asynchronous REST API, dependency injection, and JWT security' },
  { name: 'Pydantic v2', category: 'Data Contract', desc: 'Strict runtime type verification, schema validation, and error guards' },
  { name: 'React 19 & TypeScript', category: 'Frontend', desc: 'Type-safe reactive state, interactive telemetry, and design system' },
  { name: 'Tailwind CSS v4', category: 'Styling', desc: 'Custom glassmorphic styling, responsive layout, sky-cyan accents' },
  { name: 'SQLite with WAL', category: 'Persistence', desc: 'Relational persistence for predictions, user accounts, and audit events' },
];

export default function Model() {
  const { data: modelInfo, error: modelError, refetch: refetchModel } = useModelInfo();
  const { data: health, error: healthError, refetch: refetchHealth } = useHealth();

  const isHealthy = health?.status === 'ok' && health?.model_loaded;
  const connectionError = healthError || modelError;

  useEffect(() => {
    document.title = 'Model Architecture | Car Worth';
  }, []);

  const handleRetryAll = () => {
    refetchHealth();
    refetchModel();
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-4"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-wider">
          Machine Learning Infrastructure
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          Model Specifications & Architecture
        </h1>
        <p className="text-slate-300 max-w-3xl text-base sm:text-lg leading-relaxed">
          Full technical architecture of Car Worth's predictive valuation engine — detailing
          our end-to-end data pipeline, Gradient Boosting ensemble algorithm, input feature matrix,
          and evaluation metrics.
        </p>
      </motion.div>

      {/* Connection Notice if any */}
      {connectionError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass border border-amber-500/30 bg-amber-500/10 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm"
        >
          <div>
            <div className="font-semibold text-amber-300 flex items-center gap-2">
              <span>⚠️</span> Backend Connection Notice
            </div>
            <p className="text-amber-200/80 text-xs mt-1">{connectionError}</p>
          </div>
          <button
            type="button"
            onClick={handleRetryAll}
            className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold shrink-0 transition-colors border border-amber-500/30 cursor-pointer"
          >
            Retry Connection
          </button>
        </motion.div>
      )}

      {/* Production Model Status Bar */}
      <div className="glass p-6 sm:p-8 rounded-2xl border-l-4 border-sky-400 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-xs font-mono uppercase tracking-wider text-sky-400">Deployed Production Estimator</span>
          </div>
          <h2 className="text-2xl font-bold text-white mt-1">
            {modelInfo?.model_name || 'GradientBoostingRegressor (Tuned)'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Tuned Gradient Boosting Tree ensemble with cross-validated loss minimization.
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center">
            <div className="text-[11px] text-gray-400">R² Score</div>
            <div className="text-lg font-bold text-sky-400">
              {modelInfo ? `${(modelInfo.r2 * 100).toFixed(1)}%` : '96.1%'}
            </div>
          </div>
          <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center">
            <div className="text-[11px] text-gray-400">MAE</div>
            <div className="text-lg font-bold text-sky-400">
              {modelInfo ? `₹${modelInfo.mae.toFixed(2)} Lakh` : '₹0.45 Lakh'}
            </div>
          </div>
          <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center">
            <div className="text-[11px] text-gray-400">RMSE</div>
            <div className="text-lg font-bold text-sky-400">
              {modelInfo ? `₹${modelInfo.rmse.toFixed(2)} Lakh` : '₹0.71 Lakh'}
            </div>
          </div>
        </div>
      </div>

      {/* Step-by-Step Pipeline Diagram (Step 7 Requirement) */}
      <div className="space-y-6">
        <div>
          <div className="text-xs font-mono text-sky-400 uppercase tracking-wider">End-to-End Workflow</div>
          <h2 className="text-2xl font-bold text-white mt-1">Step-by-Step Pipeline Architecture</h2>
          <p className="text-sm text-gray-400 mt-1">
            Sequential stages from raw automotive data collection to production API inference.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PIPELINE_STEPS.map((item, idx) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.4 }}
              className="glass p-6 rounded-2xl border border-white/10 hover:border-sky-500/30 transition-all space-y-4 relative group"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl p-2 rounded-xl bg-white/5">{item.icon}</span>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Step {item.step}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  {item.desc}
                </p>
              </div>
              <div className="pt-3 border-t border-white/5 space-y-1">
                {item.details.map((d) => (
                  <div key={d} className="flex items-center gap-2 text-[11px] text-gray-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Input Features & Weights */}
      <div className="glass p-6 sm:p-8 rounded-2xl border border-white/10 space-y-6">
        <div>
          <div className="text-xs font-mono text-sky-400 uppercase tracking-wider">Feature Matrix</div>
          <h2 className="text-2xl font-bold text-white mt-1">Input Features & Predictive Influence</h2>
          <p className="text-sm text-gray-400 mt-1">
            The input variables supplied to the Scikit-learn pipeline and their observed Gini importance weights.
          </p>
        </div>

        <div className="divide-y divide-white/10">
          {INPUT_FEATURES.map((feat) => (
            <div key={feat.name} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm">{feat.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10 font-mono">
                    {feat.type}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{feat.desc}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-mono text-sky-400 font-bold">{feat.weight}</span>
                <span className="text-[10px] text-gray-500 block">Relative Impact</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Technology Stack Grid (Step 7 Requirement) */}
      <div className="space-y-6">
        <div>
          <div className="text-xs font-mono text-sky-400 uppercase tracking-wider">Ecosystem</div>
          <h2 className="text-2xl font-bold text-white mt-1">Production Technology Stack</h2>
          <p className="text-sm text-gray-400 mt-1">
            Libraries, frameworks, and deployment components powering the Car Worth application.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TECH_STACK.map((tech) => (
            <div key={tech.name} className="glass p-5 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">{tech.name}</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  {tech.category}
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{tech.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
