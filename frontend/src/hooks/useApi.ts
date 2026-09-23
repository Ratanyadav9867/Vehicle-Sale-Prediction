import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { HealthResponse, ModelInfoResponse, OptionsResponse } from '../types/api';

export function useHealth() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    api.health()
      .then(res => {
        setData(res);
        setError(null);
      })
      .catch((e: Error) => {
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading, error, refetch };
}

export function useModelInfo() {
  const [data, setData] = useState<ModelInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    api.modelInfo()
      .then(res => {
        setData(res);
        setError(null);
      })
      .catch((e: Error) => {
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading, error, refetch };
}

export function useOptions() {
  const [data, setData] = useState<OptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    api.options()
      .then(res => {
        setData(res);
        setError(null);
      })
      .catch((e: Error) => {
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading, error, refetch };
}
