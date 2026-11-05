import type { Metadata } from 'next';
import StaffLayoutClient from './StaffLayoutClient';

export const metadata: Metadata = {
  title: 'Dark Syndicate Staff Portal',
  manifest: '/manifest-staff.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DS Staff',
  },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffLayoutClient>{children}</StaffLayoutClient>;
}
