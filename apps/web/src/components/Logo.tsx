'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * BozorNarx mark: an emerald market basket holding a tomato, a potato and a leaf.
 * Colours are the brand tokens (Emerald, Fresh Green, Warm Orange).
 * `animated` plays the "items drop into the basket" intro used by the splash screen.
 */
export function BasketMark({ size = 40, animated = false, tone = 'color' }: { size?: number; animated?: boolean; tone?: 'color' | 'light' }) {
  const reduce = useReducedMotion();
  const play = animated && !reduce;
  const body = tone === 'light' ? '#fbf7ee' : '#047857';
  const weave = tone === 'light' ? '#047857' : '#ffffff';

  const drop = (delay: number) =>
    play
      ? { initial: { y: -70, opacity: 0, scale: 0.85 }, animate: { y: 0, opacity: 1, scale: 1 }, transition: { type: 'spring' as const, stiffness: 260, damping: 15, delay } }
      : {};

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="BozorNarx logotipi">
      <motion.path
        d="M32 54 C32 20 88 20 88 54"
        fill="none"
        stroke={body}
        strokeWidth="7"
        strokeLinecap="round"
        {...(play ? { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.5, ease: 'easeOut' as const } } : {})}
      />
      <motion.g {...drop(0.45)}>
        <ellipse cx="76" cy="47" rx="15" ry="11" fill="#d6a85c" />
        <circle cx="79" cy="44" r="1.6" fill="#b88a3e" />
        <circle cx="72" cy="50" r="1.4" fill="#b88a3e" />
      </motion.g>
      <motion.g {...drop(0.6)}>
        <circle cx="42" cy="46" r="14" fill="#f97316" />
        <path d="M42 33 l-6 4 M42 33 l6 4 M42 33 v-4" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" />
      </motion.g>
      <motion.g {...drop(0.75)}>
        <path d="M60 46 C49 36 51 22 63 19 C72 28 70 39 60 46Z" fill="#22c55e" />
        <path d="M60 44 C60 36 62 29 63 24" stroke="#16a34a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </motion.g>
      <motion.g {...(play ? { initial: { scale: 0.9, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { duration: 0.35 }, style: { transformOrigin: '60px 80px' } } : {})}>
        <path d="M16 54 H104 L93 101 Q92 107 86 107 H34 Q28 107 27 101 Z" fill={body} />
        <path d="M44 62 V99 M60 62 V99 M76 62 V99 M22 74 H98 M25 88 H95" stroke={weave} strokeOpacity="0.32" strokeWidth="2.4" strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}

export function Wordmark({ className = '', light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      <span className={light ? 'text-white' : 'text-brand-700'}>Bozor</span>
      <span className="text-accent-500">Narx</span>
    </span>
  );
}

export function Brand({ size = 36, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BasketMark size={size} />
      <Wordmark className="text-[22px]" light={light} />
    </span>
  );
}
