import { useEffect, useRef } from 'react';

const COLORS = ['#BDF26D', '#ABA6FF', '#F4D98B', '#7FD8F0', '#F3F3F6'];

/** One short burst of confetti drawn on a canvas; removes itself when the pieces settle. */
export function Confetti({ pieces = 90 }: { pieces?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || document.documentElement.classList.contains('reduce-motion')) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    const parts = Array.from({ length: pieces }, (_, i) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      const speed = 7 + Math.random() * 9;
      return { x: w / 2 + (Math.random() - 0.5) * 60, y: h * 0.42, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, size: 5 + Math.random() * 6, color: COLORS[i % COLORS.length], round: i % 3 === 0 };
    });
    let raf = 0;
    let frame = 0;
    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.vy += 0.28;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, 1 - frame / 110);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (frame < 115) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pieces]);
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
