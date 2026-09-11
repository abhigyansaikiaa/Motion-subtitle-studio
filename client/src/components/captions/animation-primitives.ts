export function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

export function generateAnimationState(
  animationName: string,
  raw: number,
  eased: number,
  invEased: number,
  amplitude: number,
  index: number,
  compositionWidth: number = 1080,
  compositionHeight: number = 1920
) {
  let scaleX = 1, scaleY = 1;
  let translateY = 0, translateX = 0;
  let blur = 0;
  let rotation = 0;

  switch (animationName) {
    case 'fade-up':
      translateY = invEased * 28 * amplitude;
      break;
    case 'fade-down':
      translateY = invEased * -28 * amplitude;
      break;
    case 'pop':
      scaleX = 0.5 + 0.5 * easeOutBack(raw);
      scaleY = scaleX;
      break;
    case 'scale':
      scaleX = raw < 1 ? eased : 1;
      scaleY = scaleX;
      break;
    case 'slide-up':
      translateY = invEased * 60 * amplitude;
      break;
    case 'slide-down':
      translateY = invEased * -60 * amplitude;
      break;
    case 'slide-left':
      translateX = invEased * 60 * amplitude;
      break;
    case 'slide-right':
      translateX = invEased * -60 * amplitude;
      break;
    case 'bounce':
      translateY = invEased * 50 * amplitude;
      scaleX = easeOutBack(raw);
      scaleY = scaleX;
      break;
    case 'blur-in':
      blur = invEased * 12;
      break;
    case 'elastic':
      scaleX = easeOutBack(raw);
      scaleY = scaleX;
      break;
    case 'reveal':
      translateY = invEased * 20 * amplitude;
      break;
      
    // New editorial/kinetic animations
    case 'rise':
      translateY = invEased * 15 * amplitude;
      break;
    case 'soft-reveal':
      // Opacity only, handled by base opacity
      break;
    case 'focus-in':
      blur = invEased * 20;
      scaleX = 1 + (invEased * 0.1);
      scaleY = scaleX;
      break;
    case 'pop-in':
      scaleX = raw === 0 ? 0 : easeOutBack(raw) * 1.15;
      scaleX = scaleX > 1 ? 1 + (scaleX - 1) * 0.5 : scaleX; // damp
      scaleY = scaleX;
      break;
    case 'punch-in':
      scaleX = eased;
      scaleY = scaleX;
      break;
    case 'zoom-in':
      scaleX = 0.3 + (0.7 * easeOutBack(raw));
      scaleY = scaleX;
      break;
    case 'stagger':
    case 'cascade':
      translateY = invEased * 20 * amplitude;
      break;
    case 'flip-in':
      scaleY = Math.max(0.01, eased); // cheap flip simulation
      break;
    case 'elastic-rise':
      translateY = invEased * 40 * amplitude;
      translateY = raw < 1 ? translateY - (Math.sin(raw * Math.PI) * 10 * amplitude) : 0;
      break;
    case 'snap-in':
      scaleX = eased < 0.9 ? 1.1 : 1.0;
      scaleY = scaleX;
      break;
    case 'spring-up':
      translateY = invEased * 80 * amplitude;
      break;
    case 'stretch-in':
      scaleX = 1 + (invEased * 0.2);
      break;
    case 'glitch':
      // deterministic pseudo-random offset
      translateX = raw < 1 ? (Math.sin(raw * 50 + index) * 10 * invEased) : 0;
      break;
    case 'motion-blur':
      translateX = invEased * -30 * amplitude;
      blur = invEased * 10;
      break;
    case 'shutter':
      scaleY = Math.max(0.05, eased);
      break;
    case 'mask-reveal':
      translateX = invEased * 20 * amplitude;
      scaleX = Math.max(0.1, eased); // simulates a growing mask
      break;
    case 'collision-left':
      // Move in from the left, scaled by composition width
      translateX = invEased * -0.4 * compositionWidth;
      break;
    case 'collision-right':
      // Move in from the right, scaled by composition width
      translateX = invEased * 0.4 * compositionWidth;
      break;
    case 'slide-from-top':
      translateY = invEased * -0.4 * compositionHeight;
      break;
    case 'slide-from-left':
      translateX = invEased * -0.4 * compositionWidth;
      break;

    // ── MOGRT-DERIVED ANIMATIONS ──────────────────────────────────────────────
    // Spinning Butter: per-word rotateZ 180°→0° + scale 0.4→1 with overshoot
    case 'spin-in':
      scaleX = 0.4 + 0.6 * easeOutBack(raw);
      scaleY = scaleX;
      rotation = (1 - eased) * 180;
      blur = invEased * 4;
      break;

    // Smooth Slide Left: whole segment slides in from right (positive X → 0)
    case 'slide-from-right':
      translateX = invEased * 0.5 * compositionWidth;
      break;

    // Sliding Bottom To Up: segment slides up from below (positive Y → 0)
    case 'slide-from-bottom':
      translateY = invEased * 0.5 * compositionHeight;
      break;

    // Sliding Right To Left: segment enters from far right, stops at center
    case 'slide-right-to-left':
      translateX = invEased * 0.6 * compositionWidth;
      break;

    case 'word-rise':
      // Gentle rise from below — used by serif+sans-serif hero words
      translateY = invEased * 22 * amplitude;
      scaleX = 0.92 + 0.08 * eased;
      scaleY = scaleX;
      break;
    case 'scale-fade':
      // Scale in from 85% with opacity — used by multi-position templates
      scaleX = 0.85 + 0.15 * eased;
      scaleY = scaleX;
      break;
    case 'fade':
    case 'none':
    default:
      break;
  }

  return { scaleX, scaleY, translateY, translateX, blur, rotation };
}
