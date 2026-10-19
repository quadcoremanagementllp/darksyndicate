import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Digital Check-in Pass',
  description: 'Verified check-in pass for Dark Syndicate Gaming World. Scan QR code at the arena desk for instant access.',
  openGraph: {
    title: '🎮 DARK SYNDICATE · Digital Check-in Pass',
    description: 'Verified check-in pass for Dark Syndicate Gaming World. Scan QR code at the arena desk for instant access.',
    type: 'website',
    siteName: 'Dark Syndicate Gaming World',
    images: [
      {
        url: '/logo-1024.png',
        width: 1024,
        height: 1024,
        alt: 'Dark Syndicate Gaming Pass',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: '🎮 DARK SYNDICATE · Digital Check-in Pass',
    description: 'Verified check-in pass for Dark Syndicate Gaming World. Scan QR code at the arena desk.',
    images: ['/logo-1024.png'],
  },
};

export default function ConfirmationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
