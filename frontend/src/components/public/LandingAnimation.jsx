/**
 * Landing page background animation. The admin chooses the style and colour
 * (Admin -> Website colours); an empty colour follows the website's main colour.
 * Purely decorative: no pointer events, hidden from screen readers and
 * switched off for visitors who ask their phone for reduced motion.
 */
import { LeafShape } from './Decor';

export const ANIMATION_STYLES = [
  { id: 'leaves', name: 'Falling leaves', description: 'Leaves drifting down slowly' },
  { id: 'bubbles', name: 'Rising bubbles', description: 'Soft bubbles floating up' },
  { id: 'sparkles', name: 'Twinkling stars', description: 'Little stars that sparkle' },
];

export const DEFAULT_ANIMATION = { enabled: true, style: 'leaves', color: '' };

const HEX = /^#[0-9a-f]{6}$/i;

/** Saved settings.animation -> { enabled, style, color } with safe defaults */
export const resolveAnimation = (animation) => {
  const a = animation || {};
  return {
    enabled: a.enabled !== false,
    style: ANIMATION_STYLES.some((s) => s.id === a.style) ? a.style : DEFAULT_ANIMATION.style,
    color: typeof a.color === 'string' && HEX.test(a.color) ? a.color.toLowerCase() : '',
  };
};

// Fixed positions so the layout never jumps between renders.
// left/top in %, size in px, duration/delay in seconds (negative delay = already on screen)
const LEAVES = [
  { left: 3, size: 26, duration: 17, delay: -3 },
  { left: 14, size: 18, duration: 13, delay: -9 },
  { left: 26, size: 30, duration: 19, delay: -14 },
  { left: 39, size: 16, duration: 12, delay: -5 },
  { left: 52, size: 24, duration: 16, delay: -11 },
  { left: 63, size: 20, duration: 14, delay: -1 },
  { left: 74, size: 32, duration: 20, delay: -7 },
  { left: 85, size: 18, duration: 13, delay: -12 },
  { left: 93, size: 24, duration: 18, delay: -4 },
  { left: 46, size: 14, duration: 11, delay: -8 },
];

const BUBBLES = [
  { left: 5, size: 22, duration: 12, delay: -2 },
  { left: 13, size: 12, duration: 9, delay: -6 },
  { left: 22, size: 30, duration: 15, delay: -10 },
  { left: 33, size: 16, duration: 10, delay: -4 },
  { left: 44, size: 26, duration: 14, delay: -12 },
  { left: 55, size: 12, duration: 8, delay: -1 },
  { left: 64, size: 20, duration: 11, delay: -7 },
  { left: 73, size: 34, duration: 16, delay: -3 },
  { left: 83, size: 14, duration: 9, delay: -5 },
  { left: 92, size: 24, duration: 13, delay: -9 },
  { left: 28, size: 10, duration: 7, delay: -3 },
  { left: 68, size: 10, duration: 8, delay: -6 },
];

const SPARKLES = [
  { left: 6, top: 14, size: 18, delay: 0 },
  { left: 18, top: 62, size: 12, delay: -1.1 },
  { left: 29, top: 28, size: 22, delay: -2.3 },
  { left: 41, top: 80, size: 14, delay: -0.6 },
  { left: 50, top: 10, size: 12, delay: -1.8 },
  { left: 58, top: 48, size: 20, delay: -2.8 },
  { left: 69, top: 18, size: 14, delay: -0.3 },
  { left: 78, top: 70, size: 24, delay: -1.5 },
  { left: 88, top: 36, size: 16, delay: -2.1 },
  { left: 95, top: 84, size: 12, delay: -0.9 },
  { left: 12, top: 88, size: 16, delay: -2.6 },
  { left: 36, top: 52, size: 10, delay: -1.3 },
];

function Sparkle({ size }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" />
    </svg>
  );
}

/**
 * <LandingAnimation style="bubbles" color="#1d6fb8" />
 * compact: fewer, smaller shapes (for the admin preview box)
 */
export default function LandingAnimation({ style = 'leaves', color = '', compact = false, className = '' }) {
  const scale = compact ? 0.7 : 1;
  const pick = (list) => (compact ? list.filter((_, i) => i % 2 === 0) : list);

  return (
    <div
      className={`landing-anim pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={color ? { '--anim-color': color } : undefined}
      aria-hidden="true"
    >
      {/* Two soft glowing circles behind everything */}
      <span className="anim-glow -left-16 -top-16 size-72" />
      <span className="anim-glow -bottom-20 -right-10 size-80 [animation-delay:-3s]" />

      {style === 'leaves' &&
        pick(LEAVES).map((leaf) => (
          <span
            key={leaf.left}
            className="anim-track fall"
            style={{ left: `${leaf.left}%`, animationDuration: `${leaf.duration}s`, animationDelay: `${leaf.delay}s` }}
          >
            <span className="anim-leaf" style={{ animationDelay: `${leaf.delay / 3}s` }}>
              <LeafShape className="block" style={{ width: leaf.size * scale, height: leaf.size * scale }} />
            </span>
          </span>
        ))}

      {style === 'bubbles' &&
        pick(BUBBLES).map((bubble) => (
          <span
            key={bubble.left}
            className="anim-track rise"
            style={{ left: `${bubble.left}%`, animationDuration: `${bubble.duration}s`, animationDelay: `${bubble.delay}s` }}
          >
            <span className="anim-bubble" style={{ width: bubble.size * scale, height: bubble.size * scale, animationDelay: `${bubble.delay / 2}s` }} />
          </span>
        ))}

      {style === 'sparkles' &&
        pick(SPARKLES).map((sparkle) => (
          <span
            key={`${sparkle.left}-${sparkle.top}`}
            className="anim-sparkle"
            style={{ left: `${sparkle.left}%`, top: `${sparkle.top}%`, animationDelay: `${sparkle.delay}s` }}
          >
            <Sparkle size={sparkle.size * scale} />
          </span>
        ))}
    </div>
  );
}
