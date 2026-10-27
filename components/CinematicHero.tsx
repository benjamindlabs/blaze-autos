"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export interface CinematicHeroProps {
  totalFrames?: number;
  getFramePath?: (index: number) => string;
  scrollDistance?: number | string;
}

const DEFAULT_TOTAL_FRAMES = 240;

const defaultFramePath = (index: number) => {
  const frameNumber = String(index + 1).padStart(3, "0");
  return `/frames/interior/ezgif-frame-${frameNumber}.jpg`;
};

export function CinematicHero({
  totalFrames = DEFAULT_TOTAL_FRAMES,
  getFramePath = defaultFramePath,
  scrollDistance = 3600,
}: CinematicHeroProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const imagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const loadedRef = useRef<boolean[]>([]);
  const currentIndexRef = useRef<number>(0);
  const renderRequestedRef = useRef<boolean>(false);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const canvas = canvasRef.current;
    const hero = heroRef.current;
    const container = containerRef.current;
    if (!canvas || !hero || !container) return;

    let isDisposed = false;

    // Initialize tracking arrays
    imagesRef.current = new Array(totalFrames).fill(null);
    loadedRef.current = new Array(totalFrames).fill(false);
    currentIndexRef.current = 0;

    const drawFrame = (frameIndex: number) => {
      if (!canvas || isDisposed) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Select target frame or fallback to the closest loaded frame
      let img = imagesRef.current[frameIndex];
      if (!loadedRef.current[frameIndex] || !img) {
        let minDistance = Infinity;
        let closestIndex = -1;
        for (let i = 0; i < totalFrames; i++) {
          if (loadedRef.current[i] && imagesRef.current[i]) {
            const distance = Math.abs(i - frameIndex);
            if (distance < minDistance) {
              minDistance = distance;
              closestIndex = i;
            }
          }
        }
        if (closestIndex !== -1) {
          img = imagesRef.current[closestIndex];
        } else {
          return;
        }
      }

      if (!img) return;

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      const imgWidth = img.naturalWidth || 1280;
      const imgHeight = img.naturalHeight || 720;
      const imageRatio = imgWidth / imgHeight;
      const canvasRatio = canvasWidth / canvasHeight;

      const isMobile = window.innerWidth <= 768;

      let drawWidth = canvasWidth;
      let drawHeight = canvasHeight;
      let offsetX = 0;
      let offsetY = 0;

      if (isMobile) {
        // Mobile portrait: fit width with vertical centering so vehicle profile is preserved
        drawWidth = canvasWidth;
        drawHeight = canvasWidth / imageRatio;
        offsetY = (canvasHeight - drawHeight) / 2;
        offsetX = 0;
      } else if (canvasRatio > imageRatio) {
        // Viewport is wider than image (ultra-wide / landscape)
        drawWidth = canvasWidth;
        drawHeight = canvasWidth / imageRatio;
        offsetY = (canvasHeight - drawHeight) / 2;
      } else {
        // Desktop tall / tablet
        drawHeight = canvasHeight;
        drawWidth = canvasHeight * imageRatio;
        offsetX = (canvasWidth - drawWidth) / 2;
      }

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    };

    const requestRender = () => {
      if (renderRequestedRef.current || isDisposed) return;
      renderRequestedRef.current = true;
      requestAnimationFrame(() => {
        drawFrame(currentIndexRef.current);
        renderRequestedRef.current = false;
      });
    };

    const updateCanvasSize = () => {
      if (!canvas || !hero || isDisposed) return;
      // Cap DPR to 2 to prevent GPU memory crashes on high-density mobile screens
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = hero.getBoundingClientRect();
      const pixelWidth = Math.round(rect.width * dpr);
      const pixelHeight = Math.round(rect.height * dpr);

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }

      drawFrame(currentIndexRef.current);
    };

    // Preload strategy: prioritize first 10 frames, fade loading overlay when 5 are ready
    const initialBatchCount = Math.min(10, totalFrames);
    let initialLoadedCount = 0;

    const checkInitialLoadProgress = () => {
      if (isDisposed) return;
      let firstFiveLoaded = true;
      for (let i = 0; i < Math.min(5, totalFrames); i++) {
        if (!loadedRef.current[i]) {
          firstFiveLoaded = false;
          break;
        }
      }
      if (firstFiveLoaded) {
        setIsLoaded(true);
        requestRender();
      }
    };

    const loadRemainingFrames = () => {
      if (isDisposed) return;
      const BATCH_SIZE = 6;
      let nextIndex = initialBatchCount;

      const loadNextBatch = () => {
        if (isDisposed || nextIndex >= totalFrames) return;
        const batchEnd = Math.min(nextIndex + BATCH_SIZE, totalFrames);
        let batchLoaded = 0;
        const currentBatchSize = batchEnd - nextIndex;

        for (let i = nextIndex; i < batchEnd; i++) {
          const idx = i;
          const img = new Image();
          img.src = getFramePath(idx);
          img.onload = () => {
            if (isDisposed) return;
            imagesRef.current[idx] = img;
            loadedRef.current[idx] = true;
            if (currentIndexRef.current === idx) {
              requestRender();
            }
            batchLoaded++;
            if (batchLoaded === currentBatchSize) {
              nextIndex = batchEnd;
              setTimeout(loadNextBatch, 16);
            }
          };
          img.onerror = () => {
            if (process.env.NODE_ENV === "development") {
              console.warn(`[CinematicHero] Failed to load frame: ${img.src}`);
            }
            batchLoaded++;
            if (batchLoaded === currentBatchSize) {
              nextIndex = batchEnd;
              setTimeout(loadNextBatch, 16);
            }
          };
        }
      };

      loadNextBatch();
    };

    for (let i = 0; i < initialBatchCount; i++) {
      const idx = i;
      const img = new Image();
      img.src = getFramePath(idx);
      img.onload = () => {
        if (isDisposed) return;
        imagesRef.current[idx] = img;
        loadedRef.current[idx] = true;
        initialLoadedCount++;
        if (idx === 0) {
          updateCanvasSize();
          requestRender();
        }
        checkInitialLoadProgress();

        if (initialLoadedCount === initialBatchCount) {
          loadRemainingFrames();
        }
      };
      img.onerror = () => {
        initialLoadedCount++;
        if (process.env.NODE_ENV === "development") {
          console.warn(`[CinematicHero] Failed to load initial frame: ${img.src}`);
        }
        checkInitialLoadProgress();
        if (initialLoadedCount === initialBatchCount) {
          loadRemainingFrames();
        }
      };
    }

    // Respect prefers-reduced-motion
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const prefersReducedMotion = reducedMotionQuery.matches;

    updateCanvasSize();

    // GSAP context for safe cleanup & Fast Refresh compatibility
    const ctx = gsap.context(() => {
      if (!prefersReducedMotion) {
        ScrollTrigger.create({
          trigger: container,
          start: "top top",
          end: typeof scrollDistance === "number" ? `+=${scrollDistance}` : scrollDistance,
          pin: hero,
          pinSpacing: true,
          scrub: 0.5, // Numerical scrub adds smoothing essential for iOS Safari
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const progress = self.progress;
            const targetIndex = Math.min(
              totalFrames - 1,
              Math.max(0, Math.round(progress * (totalFrames - 1)))
            );
            if (targetIndex !== currentIndexRef.current) {
              currentIndexRef.current = targetIndex;
              requestRender();
            }
          },
        });
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
      ScrollTrigger.refresh();
    });
    resizeObserver.observe(hero);

    const handleWindowResize = () => {
      updateCanvasSize();
      ScrollTrigger.refresh();
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      isDisposed = true;
      window.removeEventListener("resize", handleWindowResize);
      resizeObserver.disconnect();
      ctx.revert();

      // Release image references to free mobile GPU/RAM
      imagesRef.current.forEach((img) => {
        if (img) {
          img.onload = null;
          img.onerror = null;
          img.src = "";
        }
      });
      imagesRef.current = [];
      loadedRef.current = [];

      // Clear canvas buffer
      if (canvasRef.current) {
        const c = canvasRef.current;
        const context = c.getContext("2d");
        context?.clearRect(0, 0, c.width, c.height);
        c.width = 0;
        c.height = 0;
      }
    };
  }, [totalFrames, getFramePath, scrollDistance]);

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black select-none"
      style={{ minHeight: "100dvh" }}
    >
      <div
        ref={heroRef}
        className="relative w-full h-screen h-[100dvh] overflow-hidden bg-black flex items-center justify-center"
      >
        <canvas
          ref={canvasRef}
          className="cinematic-canvas w-full h-full block pointer-events-none object-cover touch-pan-y"
          style={{
            filter: "blur(1.5px) contrast(1.05) brightness(0.95)",
            transform: "translateZ(0) scale(1.01)",
            touchAction: "pan-y",
          }}
          aria-label="Cinematic automotive sequence"
          role="img"
        />

        {/* Subtle dark vignette overlay to blend edges and mask banding */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              "radial-gradient(circle, transparent 50%, rgba(0, 0, 0, 0.4) 100%)",
          }}
          aria-hidden="true"
        />

        {/* Initial loading screen that fades out once the first 5 frames are ready */}
        <div
          className={`pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black transition-opacity duration-700 ease-out ${
            isLoaded ? "opacity-0" : "opacity-100"
          }`}
          aria-hidden={isLoaded}
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-zinc-200" />
        </div>
      </div>
    </div>
  );
}
