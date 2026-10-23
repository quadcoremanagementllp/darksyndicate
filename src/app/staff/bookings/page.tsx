import { redirect } from 'next/navigation';

export default async function StaffBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const destination = tab === 'UPCOMING' ? 'online' : tab === 'COMPLETED' ? 'history' : 'in-session';
  redirect(`/staff/bookings/${destination}`);
}
