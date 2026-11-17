/* eslint-disable @next/next/no-img-element */
'use client';
import { useState } from 'react';

/** Profile picture with a safe fallback to initials (also used while the picture loads or if it fails). */
export function Avatar({ url, name, size = 40, className = '' }: { url?: string | null; name: string; size?: number; className?: string }) {
  const [bad, setBad] = useState(false);
  const initials = name.split(' ').map((x) => x[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  const box = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (url && !bad) return <img src={url} alt="" width={size} height={size} style={box} className={`shrink-0 rounded-full object-cover ${className}`} onError={() => setBad(true)} decoding="async" />;
  return <span style={box} className={`grid shrink-0 place-items-center rounded-full bg-brand-700 font-bold text-white ${className}`} aria-hidden>{initials}</span>;
}
