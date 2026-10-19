'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetForm() {
  const token = useSearchParams().get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const result = await response.json();
      setMessage(response.ok ? 'Password updated. You can now sign in.' : result.error?.message || 'Reset failed. Request a new link.');
    } catch {
      setMessage('Reset failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-ds-darker px-4 text-ds-text">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-ds-border bg-ds-surface p-8">
        <h1 className="text-2xl font-heading font-bold">Reset your password</h1>
        {!token && <p className="text-red-400">This reset link is invalid. Request a new one.</p>}
        <label className="block space-y-2">New password
          <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-ds-border bg-ds-dark p-3" />
        </label>
        <label className="block space-y-2">Confirm password
          <input type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-lg border border-ds-border bg-ds-dark p-3" />
        </label>
        {message && <p role="status">{message}</p>}
        <button disabled={submitting || !token} className="w-full rounded-lg bg-ds-accent p-3 font-bold disabled:opacity-50">Set password</button>
        <Link href="/login" className="block text-center text-ds-accent">Back to sign in</Link>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>;
}
