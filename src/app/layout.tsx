import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider } from '@/hooks/useAuth';
import { MobileBottomBar } from '@/components/layout/MobileBottomBar';
import { PwaInstaller } from '@/components/pwa/PwaInstaller';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0A111C',
};

const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://darksyndicate.in';
const appBaseUrl = rawAppUrl.startsWith('http://') || rawAppUrl.startsWith('https://')
  ? rawAppUrl
  : `https://${rawAppUrl}`;

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl),
  title: {
    default: 'DARK SYNDICATE GAMING WORLD',
    template: '%s | DARK SYNDICATE',
  },
  description:
    'Premium gaming zone experience — PS5 gaming, pool tables, and more. Book your session and own the night at Dark Syndicate Gaming World.',
  keywords: [
    'gaming zone',
    'PS5 gaming',
    'pool table',
    'esports',
    'gaming cafe',
    'book gaming session',
    'dark syndicate',
  ],
  authors: [{ name: 'Dark Syndicate Gaming World' }],
  openGraph: {
    title: 'DARK SYNDICATE GAMING WORLD',
    description:
      'Premium gaming zone — PS5, pool tables, and more. Enter the game. Own the night.',
    type: 'website',
    locale: 'en_IN',
    siteName: 'Dark Syndicate Gaming World',
    images: [
      {
        url: '/logo-1024.png',
        width: 1024,
        height: 1024,
        alt: 'Dark Syndicate Gaming World',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'DARK SYNDICATE GAMING WORLD',
    description: 'Premium gaming zone — PS5, pool tables, and more.',
    images: ['/logo-1024.png'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Dark Syndicate',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <AuthProvider>
          <ToastProvider>
            {children}
            <MobileBottomBar />
            <PwaInstaller />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
