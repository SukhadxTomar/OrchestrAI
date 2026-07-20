import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * The living background: aurora gradient mesh + drifting particles +
 * a cursor-tracking light source + film-grain noise. Pure transform/opacity
 * animation and a single low-cost canvas — no layout thrash.
 */
export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <AuroraMesh />
      <ParticleField />
      <CursorGlow />
      <Noise />
      {/* Vignette keeps focus centered */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(5,5,8,0.7)_100%)]" />
    </div>
  );
}

function AuroraMesh() {
  return (
    <div className="absolute inset-0">
      <motion.div
        animate={{ x: ["-8%", "6%", "-8%"], y: ["-6%", "8%", "-6%"], rotate: [0, 12, 0] }}
        transition={{ duration: 38, repeat: Infinity, ease: "easeInOut" }}
        className="gpu absolute left-[8%] top-[-12%] h-[55vmax] w-[55vmax] rounded-full opacity-[0.13]"
        style={{ background: "radial-gradient(circle, #7c6bff 0%, transparent 62%)" }}
      />
      <motion.div
        animate={{ x: ["6%", "-8%", "6%"], y: ["8%", "-5%", "8%"] }}
        transition={{ duration: 46, repeat: Infinity, ease: "easeInOut" }}
        className="gpu absolute right-[-8%] top-[22%] h-[48vmax] w-[48vmax] rounded-full opacity-[0.09]"
        style={{ background: "radial-gradient(circle, #4cc9f0 0%, transparent 60%)" }}
      />
      <motion.div
        animate={{ x: ["-4%", "7%", "-4%"], y: ["4%", "-7%", "4%"] }}
        transition={{ duration: 52, repeat: Infinity, ease: "easeInOut" }}
        className="gpu absolute bottom-[-18%] left-[28%] h-[50vmax] w-[50vmax] rounded-full opacity-[0.07]"
        style={{ background: "radial-gradient(circle, #b06bff 0%, transparent 60%)" }}
      />
    </div>
  );
}

function CursorGlow() {
  const x = useMotionValue(-400);
  const y = useMotionValue(-400);
  const sx = useSpring(x, { stiffness: 45, damping: 18 });
  const sy = useSpring(y, { stiffness: 45, damping: 18 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      x.set(e.clientX - 300);
      y.set(e.clientY - 300);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [x, y]);

  return (
    <motion.div
      style={{ x: sx, y: sy }}
      className="gpu absolute h-[600px] w-[600px] rounded-full opacity-[0.055]"
    >
      <div
        className="h-full w-full rounded-full"
        style={{ background: "radial-gradient(circle, #9d8fff 0%, transparent 65%)" }}
      />
    </motion.div>
  );
}

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const N = Math.min(70, Math.floor((w * h) / 26000));
    const dots = Array.from({ length: N }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.6 + Math.random() * 1.3,
      vx: (Math.random() - 0.5) * 0.12,
      vy: -0.05 - Math.random() * 0.14,
      a: 0.12 + Math.random() * 0.3,
      tw: Math.random() * Math.PI * 2,
    }));

    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    const tick = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.y < -8) { d.y = h + 8; d.x = Math.random() * w; }
        if (d.x < -8) d.x = w + 8;
        if (d.x > w + 8) d.x = -8;
        const alpha = d.a * (0.6 + 0.4 * Math.sin(t / 1400 + d.tw));
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(157, 143, 255, ${alpha})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    if (!media.matches) raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0" />;
}

function Noise() {
  // Inline SVG feTurbulence — free film grain, no asset.
  return (
    <div
      className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}
