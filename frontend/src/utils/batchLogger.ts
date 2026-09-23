/**
 * Batch & Debounce Client-Side Telemetry Logger
 * =============================================
 * Buffers navigation and client telemetry events in memory and sends them in batches
 * via POST /api/logs/batch or navigator.sendBeacon, preventing high request load
 * during rapid browsing or clicking.
 */

export interface TelemetryEvent {
  action_type: string;
  category?: string;
  description: string;
  status?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

class BatchLogger {
  private queue: TelemetryEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxBatchSize = 15;
  private readonly flushIntervalMs = 5000;

  constructor() {
    if (typeof window !== 'undefined') {
      // Flush on page unload or background switch
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushBeacon();
        }
      });
      window.addEventListener('pagehide', () => {
        this.flushBeacon();
      });
    }
  }

  public log(event: TelemetryEvent) {
    this.queue.push({
      ...event,
      timestamp: new Date().toISOString(),
    });

    if (this.queue.length >= this.maxBatchSize) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
    }
  }

  public async flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.length === 0) return;

    const eventsToSend = [...this.queue];
    this.queue = [];

    try {
      await fetch('/api/logs/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: eventsToSend }),
      });
    } catch {
      // Background telemetry failure is silent and non-blocking
    }
  }

  public flushBeacon() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.length === 0) return;

    const eventsToSend = [...this.queue];
    this.queue = [];

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ events: eventsToSend })], {
        type: 'application/json',
      });
      navigator.sendBeacon('/api/logs/batch', blob);
    }
  }
}

export const batchLogger = new BatchLogger();
export default batchLogger;
