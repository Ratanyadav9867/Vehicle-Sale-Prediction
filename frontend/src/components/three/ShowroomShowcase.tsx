import React, { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { Plus, Minus, RotateCcw } from 'lucide-react';

const MODEL_URL = '/models/3d_car_model.glb';
useGLTF.preload(MODEL_URL);

/**
 * Car model with exact mathematical offset so wheels sit precisely at y = 0
 */
function Car() {
  const { scene } = useGLTF(MODEL_URL);

  useEffect(() => {
    scene.traverse((o: any) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;

      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m: any) => {
        // Enhance specular highlights on dark burgundy body
        if ('envMapIntensity' in m) {
          m.envMapIntensity = 1.8;
        }
        // Safe glass: disable fragile transmission render targets on all devices
        if (m.transmission > 0) {
          m.transmission = 0;
          m.transparent = true;
          m.opacity = 0.35;
          m.depthWrite = false;
          m.needsUpdate = true;
        }
      });
    });
  }, [scene]);

  // The raw GLB node units are 0.01x (length is 0.047 units).
  // Scaling by 100 restores real dimensions: 1.92m wide, 1.66m tall, 4.72m long, with wheels at y = 0.
  return (
    <group scale={[100, 100, 100]}>
      <primitive object={scene} />
    </group>
  );
}

/**
 * Soft radial ground contact shadow under the car with feathered falloff
 */
function GroundContactShadow() {
  const shadowTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
      grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.55)');
      grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.18)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, []);

  if (!shadowTexture) return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
      <planeGeometry args={[6.4, 6.4]} />
      <meshBasicMaterial
        map={shadowTexture}
        transparent
        opacity={0.75}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * Pulsing cyan neon turntable ring at ground level (y = 0.01) under wheels
 */
function StageNeonRing({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (reducedMotion || !matRef.current) return;
    const t = clock.getElapsedTime();
    matRef.current.opacity = 0.55 + Math.sin(t * 1.8) * 0.25;
  });

  return (
    <group position={[0, 0.01, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.1, 0.016, 16, 80]} />
        <meshBasicMaterial ref={matRef} color="#38bdf8" transparent opacity={0.7} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * Camera controller for narrow phone screens (aspect ratio < 1)
 */
function ResponsiveCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    if (aspect < 1.0) {
      // Narrow screen: pull back proportionally so the 4.8m car fits within horizontal FOV
      const distanceFactor = Math.min(1.8, 1.0 / Math.max(aspect, 0.45));
      camera.position.set(5.0 * distanceFactor, 1.8 * distanceFactor, 6.0 * distanceFactor);
    } else {
      camera.position.set(5.0, 1.8, 6.0);
    }
    camera.lookAt(0, 0.7, 0);
  }, [camera, size.width, size.height]);

  return null;
}

export default function ShowroomShowcase() {
  const [hasMounted, setHasMounted] = useState(false);
  const [wheelHintVisible, setWheelHintVisible] = useState(false);
  const [interacted, setInteracted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mount-once lazy loading with IntersectionObserver
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasMounted(true);
          observer.disconnect(); // Mount once, never unmount
        }
      },
      { threshold: 0.05 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Check prefers-reduced-motion
  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Inactivity auto-rotate reset (4s) without re-rendering Canvas
  const handleUserInteraction = () => {
    if (!interacted) setInteracted(true);
    setWheelHintVisible(false);

    if (controlsRef.current) {
      controlsRef.current.autoRotate = false;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    if (!reducedMotion) {
      timerRef.current = setTimeout(() => {
        if (controlsRef.current) {
          controlsRef.current.autoRotate = true;
        }
      }, 4000);
    }
  };

  // Zoom handlers (direct camera and controls updates without re-renders)
  const handleZoom = (direction: number) => {
    handleUserInteraction();
    if (!controlsRef.current) return;
    const camera = controlsRef.current.object as THREE.Camera;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    camera.position.addScaledVector(dir, direction * 0.6);
    controlsRef.current.update();
  };

  const handleReset = () => {
    handleUserInteraction();
    if (!controlsRef.current) return;
    const camera = controlsRef.current.object as THREE.Camera;
    const aspect = typeof window !== 'undefined' ? window.innerWidth / Math.max(window.innerHeight, 1) : 1;
    const distanceFactor = aspect < 1.0 ? Math.min(1.8, 1.0 / Math.max(aspect, 0.45)) : 1.0;
    camera.position.set(5.0 * distanceFactor, 1.8 * distanceFactor, 6.0 * distanceFactor);
    controlsRef.current.target.set(0, 0.75, 0);
    controlsRef.current.update();
  };

  // Keyboard navigation (+, -, r)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      handleZoom(1);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      handleZoom(-1);
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      handleReset();
    }
  };

  return (
    <section className="relative w-full py-16 sm:py-20 lg:py-24 overflow-hidden select-none">
      {/* ── Section Heading & Tagline ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center mb-8 sm:mb-12 relative z-10">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]">
          Price it right. Sell it faster.
        </h2>
        <p className="mt-3 text-base sm:text-lg font-medium text-slate-300 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
          Data-driven predictions to help you sell with confidence.
        </p>
      </div>

      {/* ── 3D Stage Container ── */}
      <div
        id="showroom-stage"
        ref={containerRef}
        tabIndex={0}
        role="region"
        aria-label="Interactive 3D car. Drag to rotate, pinch or use the buttons to zoom."
        onKeyDown={handleKeyDown}
        onClick={() => {
          if (controlsRef.current) controlsRef.current.enableZoom = true;
          handleUserInteraction();
        }}
        onMouseEnter={() => {
          if (!interacted) setWheelHintVisible(true);
        }}
        onMouseLeave={() => {
          if (controlsRef.current) controlsRef.current.enableZoom = false;
          setWheelHintVisible(false);
        }}
        className="relative max-w-6xl mx-auto h-[60vh] min-h-[340px] max-h-[640px] outline-none cursor-grab active:cursor-grabbing rounded-3xl"
      >
        {/* ── Stage Layer 1: Cyan Radial Spotlight (Top Center ~20% Opacity) ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 65% 45% at 50% 0%, rgba(56, 189, 248, 0.20) 0%, rgba(56, 189, 248, 0.04) 40%, transparent 70%)',
          }}
        />

        {/* ── Stage Layer 2: Emerald Glow at Bottom (~10% Opacity) ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 40% at 50% 95%, rgba(34, 197, 94, 0.10) 0%, transparent 65%)',
          }}
        />

        {/* ── Stage Layer 3: Bottom Gradient Fade ── */}
        <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none bg-gradient-to-t from-[#030407]/80 to-transparent" />

        {/* ── WebGL 3D Canvas (Mount-once lazy loading, frameloop="always") ── */}
        {hasMounted && (
          <Canvas
            frameloop="always"
            camera={{ position: [5.0, 1.8, 6.0], fov: 40 }}
            gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
            dpr={[1, 1.5]}
            onCreated={({ gl, scene }) => {
              gl.setClearColor(0x000000, 0);
              scene.background = null;
              gl.domElement.addEventListener('webglcontextlost', (e) => {
                console.error('[ShowroomShowcase] webglcontextlost fired!', e);
              });
            }}
            style={{
              background: 'transparent',
              touchAction: 'pan-y', // Vertical swipe scrolls page, horizontal rotates
            }}
          >
            {/* Camera aspect ratio responder */}
            <ResponsiveCamera />

            {/* Stage lighting */}
            <ambientLight intensity={0.8} />
            <directionalLight position={[3, 7, 4]} intensity={2.8} castShadow color="#ffffff" />
            <directionalLight position={[-6, 4, -5]} intensity={3.0} color="#38bdf8" />
            <directionalLight position={[6, 4, -5]} intensity={2.6} color="#38bdf8" />
            <pointLight position={[4, 0.8, 3]} intensity={2.0} color="#22c55e" distance={10} />

            {/* Soft ground contact shadow directly under car wheels at y = 0 */}
            <GroundContactShadow />

            {/* Pulsing cyan ring at wheel ground level y = 0.01 */}
            <StageNeonRing reducedMotion={reducedMotion} />

            {/* Model in separate Suspense boundary with fallback={null} */}
            <Suspense fallback={null}>
              <Car />
            </Suspense>

            {/* Offline Lightformer Environment in separate Suspense boundary */}
            <Suspense fallback={null}>
              <Environment resolution={256}>
                <Lightformer form="rect" intensity={2} position={[0, 5, 0]} scale={[10, 4, 1]} rotation-x={Math.PI / 2} />
                <Lightformer form="rect" intensity={3} color="#38bdf8" position={[-6, 1, 0]} scale={[1, 4, 1]} rotation-y={Math.PI / 2} />
                <Lightformer form="rect" intensity={3} color="#38bdf8" position={[6, 1, 0]} scale={[1, 4, 1]} rotation-y={-Math.PI / 2} />
              </Environment>
            </Suspense>

            <OrbitControls
              ref={controlsRef}
              makeDefault
              target={[0, 0.75, 0]}
              enablePan={false}
              enableZoom={false} // Enabled only after click
              minDistance={3.2}
              maxDistance={12.0}
              maxPolarAngle={Math.PI / 2.05} // Cannot go under floor
              minPolarAngle={0.2}
              autoRotate={!reducedMotion}
              autoRotateSpeed={0.8}
              onStart={handleUserInteraction}
            />
          </Canvas>
        )}

        {/* ── Top-Right Controls Toolbar (Sibling component outside Canvas) ── */}
        <div className="absolute top-3 right-3 sm:top-5 sm:right-5 z-20 flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/70 border border-white/10 backdrop-blur-md shadow-xl">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleZoom(1);
            }}
            title="Zoom In (+)"
            aria-label="Zoom in"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sky-400 outline-none transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleZoom(-1);
            }}
            title="Zoom Out (-)"
            aria-label="Zoom out"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sky-400 outline-none transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleReset();
            }}
            title="Reset View (R)"
            aria-label="Reset camera view"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sky-400 outline-none transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* ── Wheel Zoom Hint (Fades out when active or interacted) ── */}
        {wheelHintVisible && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-sky-400/30 text-sky-300 text-xs font-medium backdrop-blur-md pointer-events-none shadow-lg animate-fade-in">
            Click to zoom with the wheel
          </div>
        )}

        {/* ── Bottom Interaction Hint ── */}
        {!interacted && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-full bg-slate-900/75 border border-white/10 text-slate-300 text-xs font-medium backdrop-blur-md pointer-events-none shadow-lg transition-opacity duration-500">
            Drag to rotate · Pinch to zoom
          </div>
        )}
      </div>
    </section>
  );
}


