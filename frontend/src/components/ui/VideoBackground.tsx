import { useEffect, useRef, useState } from 'react';

/**
 * Global Video Overlay Opacity
 * Adjustable constant for the dark backdrop over the background video
 */
export const VIDEO_OVERLAY_OPACITY = 0.6;

/**
 * Determines whether to show only the static poster instead of playing the video:
 * - prefers-reduced-motion: reduce
 * - navigator.connection.saveData is true
 * - connection is slow (2g/3g/slow-2g)
 * - deviceMemory <= 2 (low-end mobile devices)
 */
function shouldDisableVideo(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Reduced motion preference
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return true;
  }

  // 2. Data saver & slow network
  const nav = navigator as any;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (connection) {
    if (connection.saveData === true) return true;
    if (['slow-2g', '2g', '3g'].includes(connection.effectiveType)) return true;
  }

  // 3. Low-end device memory
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) {
    return true;
  }

  return false;
}

export default function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoDisabled, setVideoDisabled] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (shouldDisableVideo()) {
      setVideoDisabled(true);
      return;
    }

    // Listen to prefers-reduced-motion changes dynamically
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setVideoDisabled(true);
      }
    };
    mediaQuery.addEventListener?.('change', handleMotionChange);

    // Pause video when tab is hidden, resume when visible
    const handleVisibilityChange = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.hidden) {
        video.pause();
      } else {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Silently swallow autoplay resume rejections
          });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Attempt play safely without throwing uncaught errors
    const video = videoRef.current;
    if (video) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay was blocked; silent fallback to poster
          setHasError(true);
        });
      }
    }

    return () => {
      mediaQuery.removeEventListener?.('change', handleMotionChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none overflow-hidden"
      style={{ zIndex: -20, backgroundColor: '#030407' }}
      aria-hidden="true"
    >
      {/* 1. Static Poster (Instant render fallback, zero layout shift) */}
      <img
        src="/videos/carworth-bg-poster.jpg"
        alt=""
        className={`fixed inset-0 w-full h-full object-cover transition-opacity duration-700 pointer-events-none ${
          isLoaded && !videoDisabled && !hasError ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ zIndex: -20 }}
      />

      {/* 2. Global Autoplaying Looping Muted Background Video */}
      {!videoDisabled && !hasError && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/videos/carworth-bg-poster.jpg"
          aria-hidden="true"
          disablePictureInPicture
          onCanPlay={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`fixed inset-0 w-full h-full object-cover transition-opacity duration-700 pointer-events-none ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ zIndex: -20 }}
        >
          {/* WebM (VP9) first for efficiency */}
          <source src="/videos/carworth-bg.webm" type="video/webm" />
          {/* 720p version for mobile / tablet screens */}
          <source
            src="/videos/carworth-bg-720p.mp4"
            type="video/mp4"
            media="(max-width: 1023px)"
          />
          {/* 1080p MP4 default */}
          <source src="/videos/carworth-bg.mp4" type="video/mp4" />
        </video>
      )}

      {/* 3. Dark Overlay (fixed inset-0 -z-10 bg-slate-950/60) with subtle gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: -10,
          backgroundColor: `rgba(2, 6, 23, ${VIDEO_OVERLAY_OPACITY})`,
        }}
      />
      {/* Subtle top/bottom vignette gradients for perfect text readability */}
      <div
        className="fixed inset-0 pointer-events-none bg-gradient-to-b from-slate-950/70 via-transparent to-slate-950/80"
        style={{ zIndex: -10 }}
      />
    </div>
  );
}
