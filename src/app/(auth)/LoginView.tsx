'use client';

import React, { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  UserRound,
  User,
  Phone,
  Shield,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from '@/validators/auth.schema';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

interface LoginViewProps {
  defaultTab?: 'signin' | 'signup';
}

function LoginContent({ defaultTab = 'signin' }: LoginViewProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { user, login, register: authRegister } = useAuth();
  const searchParams = useSearchParams();
  const portalParam = searchParams.get('portal');
  const tabParam = searchParams.get('tab');
  const redirectParam = searchParams.get('redirect');
  const errorParam = searchParams.get('error');
  const reasonParam = searchParams.get('reason');

  const portal = portalParam === 'admin' || portalParam === 'staff' ? portalParam : 'player';

  // If user is already authenticated with the required portal role, auto-redirect
  React.useEffect(() => {
    if (!user) return;
    if (portal === 'admin' && ['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      window.location.href = redirectParam || '/admin';
    } else if (portal === 'staff' && ['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(user.role)) {
      window.location.href = redirectParam || '/staff';
    } else if (portal === 'player' && !errorParam) {
      window.location.href = redirectParam || '/account';
    }
  }, [user, portal, redirectParam, errorParam]);

  // Initialize active tab from prop, query parameter, or default to signin
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(() => {
    if (portal !== 'player') return 'signin';
    if (tabParam === 'signup' || tabParam === 'register') return 'signup';
    if (defaultTab === 'signup') return 'signup';
    return 'signin';
  });

  const toast = useToast();

  const portalDetails = {
    player: {
      title: activeTab === 'signin' ? 'Sign In' : 'Create Account',
      subtitle:
        activeTab === 'signin'
          ? 'Sign in to manage your bookings, passes, and game time.'
          : 'Create your gamer account to book stations and activate passes.',
      destination: redirectParam || '/account',
      icon: activeTab === 'signin' ? UserRound : Sparkles,
    },
    admin: {
      title: 'Sign In to Admin Portal',
      subtitle: 'Secure access to operations, payments, and reporting.',
      destination: '/admin',
      icon: ShieldCheck,
    },
    staff: {
      title: 'Sign In to Staff Portal',
      subtitle: 'Secure access to live stations and today’s bookings.',
      destination: '/staff',
      icon: ShieldCheck,
    },
  }[portal];
  const PortalIcon = portalDetails.icon;

  // ─── Sign In Form ──────────────────────────────────────────────────────────
  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors, isSubmitting: isLoginSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  const onLoginSubmit = async (data: LoginInput) => {
    try {
      const loggedInUser = await login(data.email, data.password, portal);
      toast.success('Welcome back!', 'You have been logged in successfully.');

      try {
        localStorage.setItem('ds_staff_last_active', String(Date.now()));
      } catch {}

      if (redirectParam) {
        window.location.href = redirectParam;
      } else if (loggedInUser?.role && ['SUPER_ADMIN', 'ADMIN'].includes(loggedInUser.role)) {
        window.location.href = '/admin';
      } else if (loggedInUser?.role === 'STAFF') {
        window.location.href = '/staff';
      } else {
        window.location.href = '/account';
      }
    } catch (error) {
      toast.error(
        'Login failed',
        error instanceof Error ? error.message : 'Invalid credentials'
      );
    }
  };

  // ─── Create Account Form ───────────────────────────────────────────────────
  const {
    register: registerSignUp,
    handleSubmit: handleSignUpSubmit,
    formState: { errors: signUpErrors, isSubmitting: isSignUpSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSignUpSubmit = async (data: RegisterInput) => {
    try {
      await authRegister(data);
      toast.success(
        'Account created successfully!',
        'Welcome to Dark Syndicate Gaming World.'
      );

      // Redirect user to original target (e.g. /membership) or /account
      window.location.href = redirectParam || '/account';
    } catch (error) {
      toast.error(
        'Registration failed',
        error instanceof Error ? error.message : 'Something went wrong while creating your account'
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 gradient-bg py-8 sm:py-12 pb-20 sm:pb-12">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-ds-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-ds-accent/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative animate-fade-in-up space-y-6">
        {/* Logo / Brand */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-ds-surface/80 border border-ds-accent/40 shadow-glow mb-4 p-1"
          >
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
          <div className="mt-2 inline-flex items-center gap-2 text-ds-text-muted font-body text-sm px-2">
            <PortalIcon className="w-4 h-4 text-ds-accent shrink-0" />
            <span>{portalDetails.subtitle}</span>
          </div>
        </div>

        {/* Access Denied Warning */}
        {errorParam === 'access' && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-center text-xs text-rose-300 font-semibold shadow-glow-sm">
            ⚠️ Access Denied: You need {portal === 'admin' ? 'Administrator' : portal === 'staff' ? 'Staff' : 'Player'} authorization to access that area. Please sign in with an authorized account.
          </div>
        )}

        {/* Inactivity Logout Notice */}
        {reasonParam === 'inactive' && (
          <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-center text-xs text-amber-300 font-semibold shadow-glow-sm">
            ⏳ Session Expired: You were automatically logged out after 1 hour of inactivity in the staff portal. Please sign in again.
          </div>
        )}

        {/* Existing Session Alert for wrong portal */}
        {user && (
          (portal === 'admin' && !['SUPER_ADMIN', 'ADMIN'].includes(user.role)) ||
          (portal === 'staff' && !['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(user.role))
        ) && (
          <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-center text-xs text-amber-300 font-medium">
            Currently logged in as <strong>{user.firstName} {user.lastName}</strong> ({user.role}). Sign in with an authorized {portal} account to continue.
          </div>
        )}

        {/* Redirect Context Banner (e.g. from /membership) */}
        {redirectParam?.includes('membership') && (
          <div className="p-3 rounded-xl bg-ds-accent/15 border border-ds-accent/40 text-center text-xs text-ds-ice font-semibold shadow-glow-sm">
            🎟️ {activeTab === 'signup' ? 'Create your gamer account' : 'Sign in'} to activate your Dark Syndicate Pass!
          </div>
        )}

        {/* Auth Card */}
        <div className="glass-strong rounded-2xl p-5 sm:p-8 shadow-elevated">
          {/* Tab Switcher for Player Portal */}
          {portal === 'player' && (
            <div className="grid grid-cols-2 p-1 bg-ds-dark/90 rounded-xl border border-ds-border mb-6 shadow-inner">
              <button
                type="button"
                onClick={() => setActiveTab('signin')}
                className={`py-2.5 text-xs font-heading font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'signin'
                    ? 'bg-ds-primary text-white shadow-glow border border-blue-500/50'
                    : 'text-ds-text-muted hover:text-ds-text hover:bg-ds-surface/40'
                }`}
              >
                <UserRound className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('signup')}
                className={`py-2.5 text-xs font-heading font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'signup'
                    ? 'bg-gradient-to-r from-ds-accent to-cyan-500 text-white shadow-glow border border-cyan-400/50'
                    : 'text-ds-text-muted hover:text-ds-text hover:bg-ds-surface/40'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create Account</span>
              </button>
            </div>
          )}

          {/* ────────────────── SIGN IN TAB ────────────────── */}
          {activeTab === 'signin' ? (
            <form onSubmit={handleLoginSubmit(onLoginSubmit)} className="space-y-4" noValidate>
              <Input
                {...registerLogin('email')}
                label="Email Address"
                type="email"
                placeholder="you@example.com"
                error={loginErrors.email?.message}
                icon={<Mail className="w-4 h-4" />}
                autoComplete="email"
                id="login-email"
              />

              <Input
                {...registerLogin('password')}
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                error={loginErrors.password?.message}
                icon={<Lock className="w-4 h-4" />}
                autoComplete="current-password"
                id="login-password"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="hover:text-ds-text transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              <div className="flex items-center justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs text-ds-accent hover:text-ds-accent-hover transition-colors font-medium"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                isLoading={isLoginSubmitting}
                fullWidth
                size="md"
                className="mt-3 h-11 sm:h-12 text-sm sm:text-base font-heading font-bold"
                id="login-submit"
              >
                {portalDetails.title}
              </Button>

              {portal === 'player' && (
                <div className="mt-4 pt-3 border-t border-ds-border/60 text-center">
                  <p className="text-xs text-ds-text-muted">
                    New player?{' '}
                    <button
                      type="button"
                      onClick={() => setActiveTab('signup')}
                      className="text-ds-accent hover:text-ds-accent-hover transition-colors font-bold underline"
                    >
                      Create your free account
                    </button>
                  </p>
                </div>
              )}
            </form>
          ) : (
            /* ────────────────── CREATE ACCOUNT TAB ────────────────── */
            <form onSubmit={handleSignUpSubmit(onSignUpSubmit)} className="space-y-3.5" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  {...registerSignUp('firstName')}
                  label="First Name"
                  type="text"
                  placeholder="First name"
                  error={signUpErrors.firstName?.message}
                  icon={<User className="w-4 h-4" />}
                  autoComplete="given-name"
                  id="register-first-name"
                />
                <Input
                  {...registerSignUp('lastName')}
                  label="Last Name"
                  type="text"
                  placeholder="Last name"
                  error={signUpErrors.lastName?.message}
                  autoComplete="family-name"
                  id="register-last-name"
                />
              </div>

              <Input
                {...registerSignUp('email')}
                label="Email Address"
                type="email"
                placeholder="you@example.com"
                error={signUpErrors.email?.message}
                icon={<Mail className="w-4 h-4" />}
                autoComplete="email"
                id="register-email"
              />

              <Input
                {...registerSignUp('phone')}
                label="Phone Number"
                type="tel"
                placeholder="+91 9876543210"
                error={signUpErrors.phone?.message}
                icon={<Phone className="w-4 h-4" />}
                hint="Optional — for pass & booking confirmations"
                autoComplete="tel"
                id="register-phone"
              />

              <Input
                {...registerSignUp('password')}
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                error={signUpErrors.password?.message}
                icon={<Lock className="w-4 h-4" />}
                autoComplete="new-password"
                id="register-password"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="hover:text-ds-text transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              <Input
                {...registerSignUp('confirmPassword')}
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter password"
                error={signUpErrors.confirmPassword?.message}
                icon={<Shield className="w-4 h-4" />}
                autoComplete="new-password"
                id="register-confirm-password"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="hover:text-ds-text transition-colors"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              <Button
                type="submit"
                isLoading={isSignUpSubmitting}
                fullWidth
                size="md"
                variant="accent"
                className="mt-4 h-11 sm:h-12 text-sm sm:text-base font-heading font-bold whitespace-nowrap"
                id="register-submit"
              >
                <span>Create Account & Continue</span>
                <ArrowRight className="w-4 h-4 ml-1.5 shrink-0" />
              </Button>

              <div className="mt-4 pt-3 border-t border-ds-border/60 text-center">
                <p className="text-xs text-ds-text-muted">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('signin')}
                    className="text-ds-accent hover:text-ds-accent-hover transition-colors font-bold underline"
                  >
                    Sign in here
                  </button>
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-ds-text-dim">
          © {new Date().getFullYear()} Dark Syndicate Gaming World. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export function LoginView({ defaultTab = 'signin' }: LoginViewProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-ds-darker flex items-center justify-center text-ds-ice">
          <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent defaultTab={defaultTab} />
    </Suspense>
  );
}
