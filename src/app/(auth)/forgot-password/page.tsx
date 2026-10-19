'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from '@/validators/auth.schema';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

export default function ForgotPasswordPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || 'Something went wrong');
      }

      setIsSubmitted(true);
    } catch (error) {
      toast.error(
        'Request failed',
        error instanceof Error ? error.message : 'Please try again later'
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 gradient-bg">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-ds-primary/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative animate-fade-in-up">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-ds-surface/80 border border-ds-accent/40 shadow-glow mb-4 p-1">
            <Image
              src="/logo.png"
              alt="DARK SYNDICATE Logo"
              width={72}
              height={72}
              className="w-full h-full object-contain"
              priority
            />
          </Link>
          <h1 className="text-3xl font-heading font-extrabold text-ds-text tracking-wider">
            DARK <span className="gradient-text">SYNDICATE</span>
          </h1>
        </div>

        <div className="glass-strong rounded-2xl p-8 shadow-elevated">
          {isSubmitted ? (
            /* Success State */
            <div className="text-center space-y-4 animate-fade-in">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ds-success-bg">
                <CheckCircle className="w-8 h-8 text-ds-success" />
              </div>
              <h2 className="text-xl font-heading font-bold text-ds-text">
                Check your email
              </h2>
              <p className="text-sm text-ds-text-muted leading-relaxed">
                If an account with that email exists, we&apos;ve sent a password
                reset link. Please check your inbox and spam folder.
              </p>
              <Link href="/login">
                <Button variant="outline" fullWidth className="mt-4">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </Button>
              </Link>
            </div>
          ) : (
            /* Form State */
            <>
              <div className="text-center mb-6">
                <h2 className="text-xl font-heading font-bold text-ds-text">
                  Forgot your password?
                </h2>
                <p className="text-sm text-ds-text-muted mt-1">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-5"
                noValidate
              >
                <Input
                  {...register('email')}
                  label="Email Address"
                  type="email"
                  placeholder="you@example.com"
                  error={errors.email?.message}
                  icon={<Mail className="w-4 h-4" />}
                  autoComplete="email"
                  id="forgot-email"
                />

                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  fullWidth
                  size="md"
                  className="mt-3 h-11 sm:h-12 text-sm sm:text-base font-heading font-bold"
                  id="forgot-submit"
                >
                  Send Reset Link
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-ds-accent hover:text-ds-accent-hover transition-colors font-medium"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
