import { useEffect, useRef, useState } from "react";

export default function ScrollVideo() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [images, setImages] = useState([]);
  const frameCount = 150;

  useEffect(() => {
    const loadedImages = [];
    let loadedCount = 0;

    for (let i = 1; i <= frameCount; i++) {
      const img = new Image();
      const paddedIndex = i.toString().padStart(3, "0");
      img.src = `/frames/ezgif-frame-${paddedIndex}.jpg`;
      img.onload = () => {
        loadedCount++;
        if (loadedCount === 1 && canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d");
          ctx.drawImage(
            img,
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height,
          );
        }
      };
      loadedImages.push(img);
    }
    setImages(loadedImages);
  }, []);

  useEffect(() => {
    if (images.length === 0) return;

    let animationFrameId;

    const handleScroll = () => {
      if (!containerRef.current || !canvasRef.current) return;

      // The distance the sticky container is below the top of the viewport
      const rect = containerRef.current.getBoundingClientRect();

      // Calculate how much we can scroll inside the container itself
      // We subtract windows height so progress becomes exactly 1 when the container finishes
      const maxScroll = rect.height - window.innerHeight;

      // Since it's sticky, we want to measure how far the TOP of the container has been pushed above the viewport
      const scrolled = -rect.top;

      // When scrolled <= 0, we haven't reached the component. Progress is 0.
      // When scrolled >= maxScroll, we have passed the scrolling portion. Progress is 1.
      const scrollProgress = Math.max(0, Math.min(1, scrolled / maxScroll));

      // Map progress to frame
      const frameIndex = Math.floor(scrollProgress * (frameCount - 1));

      animationFrameId = requestAnimationFrame(() => {
        const ctx = canvasRef.current.getContext("2d");
        const imgTarget = images[frameIndex];
        if (imgTarget && imgTarget.complete && imgTarget.naturalWidth > 0) {
          ctx.drawImage(
            imgTarget,
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height,
          );
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [images]);

  return (
    <div ref={containerRef} className="w-full h-[500vh] relative">
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden bg-[#050505] perspective-1000">
        {/* Background glow behind the frame */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/[0.02] rounded-full blur-[150px] pointer-events-none z-0"></div>

        {/* The boxed video frame with glow border */}
        <div className="relative z-10 w-full max-w-6xl aspect-[16/9] rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-white/10 mx-6 bg-black">
          <canvas
            ref={canvasRef}
            width={1920}
            height={1080}
            className="w-full h-full object-cover transition-opacity duration-300"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>

          <div className="absolute bottom-10 left-10 right-10 flex flex-col items-center justify-end text-center z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-5 py-2 backdrop-blur-md shadow-lg mb-8 group transition-all cursor-default">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
              <span className="text-xs font-semibold tracking-widest text-[#A1A1AA] uppercase">
                Keep scrolling to analyze
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
