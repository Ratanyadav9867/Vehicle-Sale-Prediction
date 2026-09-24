import { useState, useEffect, useCallback } from 'react';

// BeforeInstallPromptEvent interface definition
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Module-level state to share captured event and status across all hook instances
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((callback) => callback());
}

// Global listener setup (only once)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifySubscribers();
  });
}

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

function checkIsIOSSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isWebKit = /WebKit/i.test(ua);
  const isChromeIOS = /CriOS/i.test(ua);
  const isFirefoxIOS = /FxiOS/i.test(ua);
  const isEdgeIOS = /EdgiOS/i.test(ua);

  // iOS Safari specific (not embedded standalone and not third-party iOS browsers)
  return isIOS && isWebKit && !isChromeIOS && !isFirefoxIOS && !isEdgeIOS && !checkIsStandalone();
}

export function useInstallPrompt() {
  const [, setTick] = useState(0);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    subscribers.add(handleUpdate);

    // Also listen to display-mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = () => setTick((t) => t + 1);
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      subscribers.delete(handleUpdate);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  const isStandalone = checkIsStandalone();
  const isIOS = checkIsIOSSafari();
  const isInstalled = isStandalone;

  // Can install if deferred prompt is available, or if on iOS Safari (where we guide manual add)
  // But NEVER if already standalone/installed
  const canInstall = !isStandalone && (Boolean(deferredPrompt) || isIOS);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (isStandalone) {
      return false;
    }

    // iOS Safari does not support native prompt() -> open guide modal
    if (isIOS) {
      setShowIOSModal(true);
      return false;
    }

    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        deferredPrompt = null;
        notifySubscribers();
        return true;
      }
    } catch (err) {
      console.warn('Install prompt failed:', err);
    }

    return false;
  }, [isStandalone, isIOS]);

  return {
    canInstall,
    isInstalled,
    isStandalone,
    isIOS,
    showIOSModal,
    setShowIOSModal,
    promptInstall,
  };
}

export default useInstallPrompt;
