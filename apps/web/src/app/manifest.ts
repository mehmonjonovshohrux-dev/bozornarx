import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BozorNarx',
    short_name: 'BozorNarx',
    description: 'Bozor narxlari — bir joyda',
    lang: 'uz',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    background_color: '#fbf7ee',
    theme_color: '#047857',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
