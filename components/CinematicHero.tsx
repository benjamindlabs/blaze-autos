"use client";

import { useEffect, useRef } from "react";
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
      if (!canvas) return;
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

      // Preserve image aspect ratio with cover-style fitting
      const imgWidth = img.naturalWidth || 1280;
      const imgHeight = img.naturalHeight || 720;
      const imageRatio = imgWidth / imgHeight;
      const canvasRatio = canvasWidth / canvasHeight;

      let drawWidth = canvasWidth;
      let drawHeight = canvasHeight;
      let offsetX = 0;
      let offsetY = 0;

      if (canvasRatio > imageRatio) {
        // Viewport is wider than image (ultra-wide / landscape)
        drawWidth = canvasWidth;
        drawHeight = canvasWidth / imageRatio;
        offsetY = (canvasHeight - drawHeight) / 2;
      } else {
        // Viewport is narrower than image (mobile portrait / tablet)
        drawHeight = canvasHeight;
        drawWidth = canvasHeight * imageRatio;
        offsetX = (canvasWidth - drawWidth) / 2;
      }

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    };

    const requestRender = () => {
      if (renderRequestedRef.current) return;
      renderRequestedRef.current = true;
      requestAnimationFrame(() => {
        drawFrame(currentIndexRef.current);
        renderRequestedRef.current = false;
      });
    };

    const updateCanvasSize = () => {
      if (!canvas || !hero) return;
      const dpr = window.devicePixelRatio || 1;
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

    // Preload strategy: prioritize frame 0
    const loadRemainingFrames = () => {
      for (let i = 1; i < totalFrames; i++) {
        if (isDisposed) break;
        const img = new Image();
        img.src = getFramePath(i);
        img.onload = () => {
          if (isDisposed) return;
          imagesRef.current[i] = img;
          loadedRef.current[i] = true;
          if (currentIndexRef.current === i) {
            requestRender();
          }
        };
        img.onerror = () => {
          if (process.env.NODE_ENV === "development") {
            console.warn(`[CinematicHero] Failed to load frame: ${img.src}`);
          }
        };
      }
    };

    const firstImage = new Image();
    firstImage.src = getFramePath(0);
    firstImage.onload = () => {
      if (isDisposed) return;
      imagesRef.current[0] = firstImage;
      loadedRef.current[0] = true;
      updateCanvasSize();
      requestRender();
      loadRemainingFrames();
    };
    firstImage.onerror = () => {
      console.warn(`[CinematicHero] Failed to load initial frame: ${firstImage.src}`);
    };

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
          scrub: 0.5,
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
    };
  }, [totalFrames, getFramePath, scrollDistance]);

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black select-none"
      style={{ minHeight: "100vh" }}
    >
      <div
        ref={heroRef}
        className="relative w-full h-screen overflow-hidden bg-black flex items-center justify-center"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block pointer-events-none object-cover"
          style={{
            filter: "blur(1.5px) contrast(1.05) brightness(0.95)",
            transform: "translateZ(0) scale(1.01)",
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
      </div>
    </div>
  );
}
