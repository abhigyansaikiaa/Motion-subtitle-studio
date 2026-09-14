import React, { useEffect, useRef, useState, useCallback } from 'react';

// ──────────────────────────────────────────────────────────────────────────────
// Mini Snake + Dot game that plays during rendering wait
// Arrow keys / WASD to steer. Collect the glowing dot. Don't hit yourself.
// ──────────────────────────────────────────────────────────────────────────────

const CELL = 16;
const COLS = 22;
const ROWS = 18;
const W = COLS * CELL;
const H = ROWS * CELL;
const TICK_MS = 120;

type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Pos = { x: number; y: number };

function randomCell(exclude: Pos[]): Pos {
  while (true) {
    const p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    if (!exclude.some(e => e.x === p.x && e.y === p.y)) return p;
  }
}

export function RenderSnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({
    snake: [{ x: 5, y: 9 }, { x: 4, y: 9 }, { x: 3, y: 9 }] as Pos[],
    dir: 'RIGHT' as Dir,
    nextDir: 'RIGHT' as Dir,
    dot: { x: 15, y: 9 } as Pos,
    score: 0,
    dead: false,
    flash: 0,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
    dotPulse: 0,
  });
  const [score, setScore] = useState(0);
  const [dead, setDead] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef = useRef<number>(0);

  const reset = useCallback(() => {
    const s = state.current;
    s.snake = [{ x: 5, y: 9 }, { x: 4, y: 9 }, { x: 3, y: 9 }];
    s.dir = 'RIGHT';
    s.nextDir = 'RIGHT';
    s.dot = randomCell(s.snake);
    s.score = 0;
    s.dead = false;
    s.flash = 0;
    s.particles = [];
    setScore(0);
    setDead(false);
  }, []);

  // Draw loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const s = state.current;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL); ctx.stroke();
    }

    // Particles
    s.particles = s.particles.filter(p => p.life > 0);
    for (const p of s.particles) {
      ctx.globalAlpha = p.life / 1;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.9;
      p.vy *= 0.9;
      p.life -= 0.04;
    }
    ctx.globalAlpha = 1;

    // Dot with glow pulse
    s.dotPulse = (s.dotPulse + 0.07) % (Math.PI * 2);
    const pulse = 0.6 + 0.4 * Math.sin(s.dotPulse);
    const dx = s.dot.x * CELL + CELL / 2;
    const dy = s.dot.y * CELL + CELL / 2;
    const dotR = (CELL / 2 - 2) * pulse;

    ctx.save();
    ctx.shadowColor = '#a78bfa';
    ctx.shadowBlur = 18 * pulse;
    const grad = ctx.createRadialGradient(dx, dy, 0, dx, dy, dotR);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.5, '#c4b5fd');
    grad.addColorStop(1, '#7c3aed');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Snake
    const len = s.snake.length;
    for (let i = 0; i < len; i++) {
      const seg = s.snake[i];
      const t = i / len;
      const isHead = i === 0;

      ctx.save();
      if (isHead) {
        ctx.shadowColor = s.dead ? '#ef4444' : '#34d399';
        ctx.shadowBlur = 12;
      }
      const r = 255, g = isHead ? 212 : Math.floor(52 + (1 - t) * 160), b = isHead ? 0 : Math.floor(99 + (1 - t) * 80);
      ctx.fillStyle = s.dead ? '#ef4444' : `rgb(${isHead ? '52,211,153' : `${r - i * 4},${g},${b - i * 3}`})`;
      
      const pad = isHead ? 1 : 2;
      const radius = isHead ? 5 : 3;
      const x = seg.x * CELL + pad;
      const y = seg.y * CELL + pad;
      const size = CELL - pad * 2;

      ctx.beginPath();
      ctx.roundRect(x, y, size, size, radius);
      ctx.fill();
      ctx.restore();
    }

    // Flash overlay on eat
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(167,139,250,${s.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
      s.flash -= 0.06;
    }

    animRef.current = requestAnimationFrame(draw);
  }, []);

  // Tick
  const tick = useCallback(() => {
    const s = state.current;
    if (s.dead) return;

    s.dir = s.nextDir;
    const head = s.snake[0];
    const newHead: Pos = {
      x: (head.x + (s.dir === 'RIGHT' ? 1 : s.dir === 'LEFT' ? -1 : 0) + COLS) % COLS,
      y: (head.y + (s.dir === 'DOWN' ? 1 : s.dir === 'UP' ? -1 : 0) + ROWS) % ROWS,
    };

    // Self collision
    if (s.snake.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
      s.dead = true;
      setDead(true);
      return;
    }

    s.snake.unshift(newHead);

    if (newHead.x === s.dot.x && newHead.y === s.dot.y) {
      s.score += 1;
      setScore(s.score);
      s.flash = 1;
      s.dot = randomCell(s.snake);

      // Burst particles
      const cx = newHead.x * CELL + CELL / 2;
      const cy = newHead.y * CELL + CELL / 2;
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2;
        const speed = 1.5 + Math.random() * 2;
        s.particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color: ['#a78bfa', '#c4b5fd', '#7c3aed', '#fff', '#34d399'][i % 5],
        });
      }
    } else {
      s.snake.pop();
    }
  }, []);

  useEffect(() => {
    reset();
    animRef.current = requestAnimationFrame(draw);
    tickRef.current = setInterval(tick, TICK_MS);

    const onKey = (e: KeyboardEvent) => {
      const s = state.current;
      if (s.dead) { reset(); return; }
      const map: Record<string, Dir> = {
        ArrowUp: 'UP', w: 'UP', W: 'UP',
        ArrowDown: 'DOWN', s: 'DOWN', S: 'DOWN',
        ArrowLeft: 'LEFT', a: 'LEFT', A: 'LEFT',
        ArrowRight: 'RIGHT', d: 'RIGHT', D: 'RIGHT',
      };
      const newDir = map[e.key];
      if (!newDir) return;
      // Prevent 180-degree turns
      const opposite: Record<Dir, Dir> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
      if (newDir !== opposite[s.dir]) {
        s.nextDir = newDir;
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (tickRef.current) clearInterval(tickRef.current);
      cancelAnimationFrame(animRef.current);
    };
  }, [reset, draw, tick]);

  // Touch / swipe support
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    const s = state.current;
    if (s.dead) { reset(); return; }
    const opposite: Record<Dir, Dir> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
    let newDir: Dir | null = null;
    if (Math.abs(dx) > Math.abs(dy)) {
      newDir = dx > 0 ? 'RIGHT' : 'LEFT';
    } else {
      newDir = dy > 0 ? 'DOWN' : 'UP';
    }
    if (newDir && newDir !== opposite[s.dir]) s.nextDir = newDir;
    touchStart.current = null;
  };

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div className="flex items-center justify-between w-full px-1">
        <span className="text-xs text-white/40 font-mono tracking-widest uppercase">Snake</span>
        <span className="text-xs font-mono text-violet-300">
          Score: <span className="text-white font-bold">{score}</span>
        </span>
      </div>

      <div className="relative" style={{ width: W, height: H }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="rounded-xl border border-white/10"
          style={{ display: 'block' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />

        {dead && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          >
            <span className="text-red-400 font-bold text-base">Game Over!</span>
            <span className="text-white/60 text-xs">Score: {score}</span>
            <span className="text-white/40 text-[10px] mt-1">Press any key or tap to restart</span>
          </div>
        )}
      </div>

      <p className="text-white/25 text-[10px] tracking-wide">Arrow keys / WASD to steer · Tap to swipe</p>
    </div>
  );
}
