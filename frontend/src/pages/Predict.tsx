import { useState, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useOptions } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import type { PredictRequest, PredictResponse, PredictionRecord } from '../types/api';

const CURRENT_YEAR = new Date().getFullYear();

const BRANDS = [
  'Maruti', 'Hyundai', 'Honda', 'Toyota', 'Ford', 'Volkswagen',
  'Tata', 'Mahindra', 'Renault', 'Nissan', 'Kia', 'MG', 'Skoda',
  'BMW', 'Mercedes-Benz', 'Audi', 'Jeep', 'Other',
];

type FormData = {
  brand: string;
  year: string;
  present_price: string;
  kms_driven: string;
  fuel_type: string;
  seller_type: string;
  transmission: string;
  owner: string;
};

const INITIAL_FORM: FormData = {
  brand: '',
  year: String(CURRENT_YEAR - 4),
  present_price: '',
  kms_driven: '',
  fuel_type: 'Petrol',
  seller_type: 'Dealer',
  transmission: 'Manual',
  owner: '0',
};

function formatCurrency(lakh: number): { inr: string; lakhStr: string } {
  const inrValue = Math.round(lakh * 100000);
  return {
    inr: `₹${inrValue.toLocaleString('en-IN')}`,
    lakhStr: `₹${lakh.toFixed(2)} Lakh`,
  };
}

export default function Predict() {
  const { user } = useAuth();
  const { data: opts, loading: optsLoading, error: optsError, refetch: refetchOpts } = useOptions();

  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResponse | null>(null);

  // Prediction History
  const [history, setHistory] = useState<PredictionRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.predictions.getMyPredictions(30);
      setHistory(res.items || []);
    } catch {
      // Non-blocking fallback
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    document.title = 'Predict Vehicle Price | Car Worth';
    fetchHistory();
  }, []);

  const set = (k: keyof FormData, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
    setApiError(null);
  };

  function validate(): boolean {
    const errs: Partial<FormData> = {};
    if (!form.brand) errs.brand = 'Please select a vehicle brand';
    const yr = Number(form.year);
    if (!form.year || isNaN(yr) || yr < 1990 || yr > CURRENT_YEAR) {
      errs.year = `Year must be between 1990 and ${CURRENT_YEAR}`;
    }
    const pp = Number(form.present_price);
    if (!form.present_price || isNaN(pp) || pp <= 0) {
      errs.present_price = 'Showroom price must be greater than 0';
    }
    const km = Number(form.kms_driven);
    if (form.kms_driven === '' || isNaN(km) || km < 0) {
      errs.kms_driven = 'Kilometres driven cannot be negative';
    }
    if (!form.fuel_type) errs.fuel_type = 'Select fuel type';
    if (!form.seller_type) errs.seller_type = 'Select seller type';
    if (!form.transmission) errs.transmission = 'Select transmission';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setApiError(null);
    setResult(null);

    try {
      const payload: PredictRequest = {
        brand: form.brand,
        year: Number(form.year),
        present_price: Number(form.present_price),
        kms_driven: Number(form.kms_driven),
        fuel_type: form.fuel_type,
        seller_type: form.seller_type,
        transmission: form.transmission,
        owner: Number(form.owner),
      };

      const res = await api.predict(payload);
      setResult(res);
      // Refresh history list
      fetchHistory();
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Prediction failed. Please ensure the backend is active.';
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setForm(INITIAL_FORM);
    setErrors({});
    setResult(null);
    setApiError(null);
  }

  return (
    <div className="min-h-screen bg-transparent text-gray-100 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Title */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Authenticated Valuation Workspace
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Predict Vehicle Market Price
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            Logged in as <span className="text-emerald-400 font-semibold">{user?.name}</span> ({user?.email}).
            Enter the vehicle parameters below for instant machine-learning appraisal.
          </p>
        </motion.div>

        {/* Backend Connection Notice */}
        {optsError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass border border-amber-500/30 bg-amber-500/10 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm"
          >
            <div>
              <div className="font-semibold text-amber-300 flex items-center gap-2">
                <span>⚠️</span> Backend Connection Notice
              </div>
              <p className="text-amber-200/80 text-xs mt-1">{optsError}</p>
            </div>
            <button
              type="button"
              onClick={() => refetchOpts()}
              className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold shrink-0 transition-colors border border-amber-500/30 cursor-pointer"
            >
              Retry Connection
            </button>
          </motion.div>
        )}

        {/* Main Grid: Prediction Form & Active Result */}
        <div className="grid lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Prediction Form Column */}
          <div className="lg:col-span-7 space-y-6">
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSubmit}
              className="glass-dark p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl space-y-6"
              noValidate
            >
              <div className="border-b border-white/10 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">Vehicle Specifications</h2>
                  <p className="text-[11px] sm:text-xs text-gray-400">Provide vehicle attributes for appraisal</p>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="min-h-[44px] px-3 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer inline-flex items-center"
                >
                  Reset form
                </button>
              </div>

              {/* Section 1: Vehicle Identity */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  1. Vehicle Identity
                </div>
                <div className="grid sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      Brand / Make
                    </label>
                    <select
                      className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-gray-900/90 border border-white/10 text-white text-base sm:text-sm focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                      value={form.brand}
                      onChange={e => set('brand', e.target.value)}
                    >
                      <option value="" className="bg-gray-900 text-gray-400">Select brand...</option>
                      {BRANDS.map(b => (
                        <option key={b} value={b} className="bg-gray-900 text-white">{b}</option>
                      ))}
                    </select>
                    {errors.brand && <p className="text-rose-400 text-xs mt-1">{errors.brand}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      Manufacturing Year
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-base sm:text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                      placeholder={`1990 – ${CURRENT_YEAR}`}
                      min={optsLoading ? 1990 : (opts?.year_min ?? 1990)}
                      max={optsLoading ? CURRENT_YEAR : (opts?.year_max ?? CURRENT_YEAR)}
                      value={form.year}
                      onChange={e => set('year', e.target.value)}
                    />
                    {errors.year && <p className="text-rose-400 text-xs mt-1">{errors.year}</p>}
                  </div>
                </div>
              </div>

              {/* Section 2: Economics & Usage */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  2. Pricing &amp; Usage
                </div>
                <div className="grid sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      Ex-Showroom Price <span className="text-gray-400 lowercase">(Lakh ₹)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      inputMode="decimal"
                      className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-base sm:text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                      placeholder="e.g. 7.5 (for ₹7,50,000)"
                      value={form.present_price}
                      onChange={e => set('present_price', e.target.value)}
                    />
                    {errors.present_price && <p className="text-rose-400 text-xs mt-1">{errors.present_price}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      Kilometres Driven
                    </label>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-base sm:text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                      placeholder="e.g. 45000"
                      value={form.kms_driven}
                      onChange={e => set('kms_driven', e.target.value)}
                    />
                    {errors.kms_driven && <p className="text-rose-400 text-xs mt-1">{errors.kms_driven}</p>}
                  </div>
                </div>
              </div>

              {/* Section 3: Technical & Ownership */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  3. Technical &amp; Ownership
                </div>
                <div className="grid sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      Fuel Type
                    </label>
                    <select
                      className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-gray-900/90 border border-white/10 text-white text-base sm:text-sm focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                      value={form.fuel_type}
                      onChange={e => set('fuel_type', e.target.value)}
                    >
                      {(opts?.fuel_types ?? ['Petrol', 'Diesel', 'CNG']).map(f => (
                        <option key={f} value={f} className="bg-gray-900 text-white">{f}</option>
                      ))}
                    </select>
                    {errors.fuel_type && <p className="text-rose-400 text-xs mt-1">{errors.fuel_type}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      Transmission
                    </label>
                    <select
                      className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-gray-900/90 border border-white/10 text-white text-base sm:text-sm focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                      value={form.transmission}
                      onChange={e => set('transmission', e.target.value)}
                    >
                      {(opts?.transmission_types ?? ['Manual', 'Automatic']).map(t => (
                        <option key={t} value={t} className="bg-gray-900 text-white">{t}</option>
                      ))}
                    </select>
                    {errors.transmission && <p className="text-rose-400 text-xs mt-1">{errors.transmission}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      Seller Type
                    </label>
                    <select
                      className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-gray-900/90 border border-white/10 text-white text-base sm:text-sm focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                      value={form.seller_type}
                      onChange={e => set('seller_type', e.target.value)}
                    >
                      {(opts?.seller_types ?? ['Dealer', 'Individual']).map(s => (
                        <option key={s} value={s} className="bg-gray-900 text-white">{s}</option>
                      ))}
                    </select>
                    {errors.seller_type && <p className="text-rose-400 text-xs mt-1">{errors.seller_type}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      Previous Owners
                    </label>
                    <select
                      className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-gray-900/90 border border-white/10 text-white text-base sm:text-sm focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                      value={form.owner}
                      onChange={e => set('owner', e.target.value)}
                    >
                      {(opts?.owner_options ?? [0, 1, 2, 3]).map(o => (
                        <option key={o} value={o} className="bg-gray-900 text-white">
                          {o === 0 ? '0 (First Owner)' : `${o} Previous Owner${o > 1 ? 's' : ''}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Error Banner */}
              <AnimatePresence>
                {apiError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{apiError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[52px] py-4 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 active:scale-98 shadow-xl shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-3 text-sm sm:text-base"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Evaluating ML Model...</span>
                  </>
                ) : (
                  <>
                    <span>Calculate Market Price</span>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </motion.form>
          </div>

          {/* Prediction Result Column */}
          <div className="lg:col-span-5 space-y-6">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950/40 border border-emerald-500/30 p-5 sm:p-8 backdrop-blur-2xl shadow-2xl space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">
                      Valuation Result
                    </span>
                    <span className="text-[11px] sm:text-xs text-gray-400 font-mono">
                      Just now
                    </span>
                  </div>

                  {/* Highlighted Price */}
                  <div className="text-center py-5 bg-white/5 rounded-2xl border border-white/10 space-y-1">
                    <p className="text-[11px] sm:text-xs text-gray-400 uppercase font-semibold">Predicted Fair Selling Price</p>
                    <div className="text-3xl sm:text-5xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                      {formatCurrency(result.predicted_price).inr}
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-emerald-300">
                      {formatCurrency(result.predicted_price).lakhStr}
                    </p>
                  </div>

                  {/* Summary Details */}
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                      <p className="text-gray-400 text-[11px]">Car Age</p>
                      <p className="font-bold text-white mt-0.5">{result.car_age} Years Old</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                      <p className="text-gray-400 text-[11px]">Fuel &amp; Gearbox</p>
                      <p className="font-bold text-white mt-0.5 truncate">{result.fuel_type} &bull; {result.transmission}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                      <p className="text-gray-400 text-[11px]">Showroom Price</p>
                      <p className="font-bold text-white mt-0.5">₹{(result.present_price * 100000).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                      <p className="text-gray-400 text-[11px]">Pipeline Model</p>
                      <p className="font-bold text-emerald-400 mt-0.5 truncate">{result.model}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="w-full min-h-[48px] py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm text-white bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Predict Another Vehicle
                    </button>
                    <Link
                      to="/dashboard"
                      className="w-full min-h-[48px] py-3 px-4 rounded-xl font-medium text-xs sm:text-sm text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors text-center inline-flex items-center justify-center"
                    >
                      Go to User Dashboard &rarr;
                    </Link>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl sm:rounded-3xl glass p-6 sm:p-8 border border-white/10 text-center space-y-4"
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-2xl">
                    📊
                  </div>
                  <h3 className="text-base font-bold text-white">Live Prediction Ready</h3>
                  <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
                    Fill out the vehicle specifications form and tap "Calculate Market Price" to view an instant valuation.
                  </p>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-left text-xs text-gray-400 space-y-1.5">
                    <p className="font-semibold text-gray-300">Features considered:</p>
                    <p>&bull; Depreciation calculated automatically from model year</p>
                    <p>&bull; Standardized scaling applied to showroom price &amp; mileage</p>
                    <p>&bull; One-hot encoding for fuel and transmission characteristics</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── "My Predictions" History List ──────────────────────────────── */}
        <div className="rounded-2xl sm:rounded-3xl bg-gray-900/80 border border-white/10 backdrop-blur-xl p-4 sm:p-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>My Predictions History</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {history.length} {history.length === 1 ? 'Record' : 'Records'}
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                Past valuations saved automatically under your account
              </p>
            </div>

            <button
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-gray-300 hover:text-white transition-colors flex items-center gap-2 cursor-pointer self-start sm:self-auto"
            >
              <svg className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh History</span>
            </button>
          </div>

          {loadingHistory ? (
            <div className="py-12 text-center text-gray-400 space-y-2">
              <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin mx-auto" />
              <p className="text-xs">Loading past predictions...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm space-y-2">
              <p>No past predictions recorded yet for this account.</p>
              <p className="text-xs text-gray-400">
                Use the form above to run your first vehicle price estimation!
              </p>
            </div>
          ) : (
            <>
              {/* Mobile-First Cards View (Visible on mobile/tablet screens < 768px) */}
              <div className="md:hidden space-y-3">
                {history.map(item => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-base">
                          🚗
                        </span>
                        <div>
                          <p className="font-bold text-white text-sm">
                            {item.brand} ({item.year})
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {item.car_age} years old &bull; {item.owner === 0 ? 'First Owner' : `${item.owner} Owners`}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono shrink-0">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-gray-300 border border-white/5">
                        {item.fuel_type}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-gray-300 border border-white/5">
                        {item.transmission}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-gray-300 border border-white/5">
                        {item.kms_driven.toLocaleString('en-IN')} kms
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-gray-300 border border-white/5">
                        Showroom: ₹{(item.present_price * 100000).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                      <span className="text-gray-400 text-xs">Estimated Resale:</span>
                      <div className="text-right">
                        <span className="text-sm font-black text-emerald-400">
                          {formatCurrency(item.predicted_price).inr}
                        </span>
                        <span className="text-[10px] text-emerald-300/80 block font-mono">
                          {formatCurrency(item.predicted_price).lakhStr}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Responsive Table View (Visible on >= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400 uppercase tracking-wider">
                      <th className="pb-3 font-semibold">Vehicle</th>
                      <th className="pb-3 font-semibold">Specs</th>
                      <th className="pb-3 font-semibold">Showroom Price</th>
                      <th className="pb-3 font-semibold">Predicted Resale Price</th>
                      <th className="pb-3 font-semibold text-right">Date / Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {history.map(item => (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3.5 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                              🚗
                            </span>
                            <div>
                              <p>{item.brand} ({item.year})</p>
                              <p className="text-[10px] text-gray-400 font-normal">
                                {item.car_age} years old &bull; {item.owner === 0 ? 'First Owner' : `${item.owner} Prev. Owners`}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 text-gray-300">
                          <p>{item.fuel_type} &bull; {item.transmission}</p>
                          <p className="text-[10px] text-gray-400">
                            {item.kms_driven.toLocaleString('en-IN')} kms
                          </p>
                        </td>

                        <td className="py-3.5 text-gray-300">
                          ₹{(item.present_price * 100000).toLocaleString('en-IN')}
                          <span className="text-[10px] text-gray-400 block font-mono">
                            ({item.present_price} Lakh)
                          </span>
                        </td>

                        <td className="py-3.5">
                          <span className="text-sm font-bold text-emerald-400">
                            {formatCurrency(item.predicted_price).inr}
                          </span>
                          <span className="text-[10px] text-emerald-300/80 block font-mono">
                            {formatCurrency(item.predicted_price).lakhStr}
                          </span>
                        </td>

                        <td className="py-3.5 text-right text-gray-400 font-mono text-[11px]">
                          {new Date(item.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
