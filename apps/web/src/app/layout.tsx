import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { SplashGate } from '@/components/SplashGate';
import { PwaClient } from '@/components/PwaClient';
import { AppLock } from '@/components/AppLock';
import { BackGuard } from '@/components/BackGuard';

export const metadata: Metadata = {
  title: { default: 'BozorNarx — Bozor narxlari bir joyda', template: '%s · BozorNarx' },
  description: 'Mahalliy bozor narxlarini kuzating, taqqoslang va xavfsiz savdo qiling.',
  manifest: '/manifest.webmanifest',
  applicationName: 'BozorNarx',
  appleWebApp: { capable: true, title: 'BozorNarx', statusBarStyle: 'default' },
  icons: { icon: [{ url: '/icons/icon-192.png', sizes: '192x192' }], apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = { themeColor: '#047857', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz">
      <body>
        <div id="bn-boot" aria-hidden="true" />
        <AuthProvider>
          {children}
          <SplashGate />
          <PwaClient />
          <BackGuard />
          <AppLock />
        </AuthProvider>
      </body>
    </html>
  );
}
