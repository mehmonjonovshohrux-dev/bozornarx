'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  /** change this number to replay the shake animation after a wrong code */
  errorTick?: number;
  hasError?: boolean;
  length?: number;
}

/** 6 separate digit boxes: auto-advance, backspace, arrow keys, paste, and SMS/email autofill (autocomplete=one-time-code). */
export function OtpInput({ value, onChange, onComplete, disabled, errorTick = 0, hasError, length = 6 }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  useEffect(() => {
    if (value.length === 0) refs.current[0]?.focus();
  }, [value.length, errorTick]);

  function commit(next: string, focusIndex?: number) {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (focusIndex !== undefined) refs.current[Math.min(focusIndex, length - 1)]?.focus();
    if (clean.length === length) onComplete?.(clean);
  }

  return (
    <motion.div
      key={errorTick}
      className={`flex justify-center gap-2 sm:gap-3 ${hasError ? 'animate-shake' : ''}`}
      role="group"
      aria-label="6 xonali tasdiqlash kodi"
    >
      {digits.map((d, i) => (
        <motion.input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={length}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`${i + 1}-raqam`}
          disabled={disabled}
          animate={d ? { scale: [1, 1.14, 1] } : { scale: 1 }}
          transition={{ duration: 0.18 }}
          className={`h-14 w-11 rounded-xl border bg-white text-center text-2xl font-bold text-brand-800 shadow-sm transition-colors sm:h-16 sm:w-14 ${
            hasError ? 'border-danger bg-red-50' : d ? 'border-brand-500 bg-brand-50' : 'border-cream-300'
          } focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:opacity-60`}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, '');
            if (typed.length > 1) return commit(value.slice(0, i) + typed, i + typed.length); // paste into a box
            const next = value.slice(0, i) + typed + value.slice(i + 1);
            commit(next.slice(0, length), typed ? i + 1 : i);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d && i > 0) {
              e.preventDefault();
              commit(value.slice(0, i - 1) + value.slice(i), i - 1);
            } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            commit(e.clipboardData.getData('text'), length - 1);
          }}
        />
      ))}
    </motion.div>
  );
}
