'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  User,
  Lock,
  Save,
  CheckCircle,
  AlertCircle,
  Shield,
  Phone,
  MapPin,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';

interface ProfileFormData {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  dateOfBirth: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfileSettingsPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const {
    register: regProfile,
    handleSubmit: handleProfileSubmit,
    reset: resetProfile,
    formState: { errors: profileErrors },
  } = useForm<ProfileFormData>({
    mode: 'onTouched',
  });

  const {
    register: regPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    watch: watchPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormData>({
    mode: 'onTouched',
  });

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/customer/profile');
        const json = await res.json();
        if (json.success && json.data) {
          resetProfile({
            firstName: json.data.firstName || '',
            lastName: json.data.lastName || '',
            phone: json.data.phone || '',
            address: json.data.profile?.address || '',
            dateOfBirth: json.data.profile?.dateOfBirth ? json.data.profile.dateOfBirth.split('T')[0] : '',
          });
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    }
    fetchProfile();
  }, [resetProfile]);

  const onUpdateProfile = async (data: ProfileFormData) => {
    setProfileSaving(true);
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to update profile');
      }

      toast('Profile details updated successfully', 'success');
      await refreshUser();
    } catch (err: any) {
      toast(err.message || 'Error updating profile', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const onUpdatePassword = async (data: PasswordFormData) => {
    setPasswordSaving(true);
    try {
      const res = await fetch('/api/customer/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to change password');
      }

      toast('Password changed successfully!', 'success');
      resetPassword();
    } catch (err: any) {
      toast(err.message || 'Error changing password', 'error');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-ds-text uppercase">
          PROFILE & <span className="gradient-text">SECURITY SETTINGS</span>
        </h2>
        <p className="text-xs text-ds-text-muted mt-0.5">
          Update your gamer identity, contact info, and manage account security.
        </p>
      </div>

      {/* ─── Profile Information Card ────────────────────────────── */}
      <Card glass className="p-6 sm:p-8 border-ds-border space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-ds-border/60">
          <div className="w-10 h-10 rounded-xl bg-ds-accent/15 border border-ds-accent/30 flex items-center justify-center text-ds-ice">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-lg text-ds-text">
              Personal Information
            </h3>
            <p className="text-xs text-ds-text-muted">
              Used for booking confirmations and check-in validation.
            </p>
          </div>
        </div>

        <form onSubmit={handleProfileSubmit(onUpdateProfile)} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="First Name *"
              placeholder="e.g. Hariharan"
              {...regProfile('firstName', {
                required: 'First name is required',
                minLength: { value: 2, message: 'First name must be at least 2 characters' },
              })}
              error={profileErrors.firstName?.message}
            />

            <Input
              label="Last Name"
              placeholder="e.g. Sankar"
              {...regProfile('lastName')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-heading font-bold uppercase tracking-wider text-ds-text mb-1.5">
                Registered Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full h-11 px-3.5 rounded-lg bg-ds-dark/40 border border-ds-border text-sm text-ds-text-dim cursor-not-allowed opacity-80"
              />
              <span className="text-[10px] text-ds-text-dim mt-1 block">
                Email cannot be changed directly for security reasons.
              </span>
            </div>

            <Input
              label="Phone Number"
              placeholder="e.g. 9876543210"
              {...regProfile('phone', {
                pattern: {
                  value: /^(\+91[\-\s]?)?[6-9]\d{9}$/,
                  message: 'Must be a valid 10-digit Indian phone number (starts with 6-9)',
                },
              })}
              error={profileErrors.phone?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="City / Address"
              placeholder="e.g. Chennai, Tamil Nadu"
              {...regProfile('address')}
            />

            <Input
              label="Date of Birth"
              type="date"
              {...regProfile('dateOfBirth')}
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="accent"
              disabled={profileSaving}
              className="text-xs px-6"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {profileSaving ? 'Saving Changes...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </Card>

      {/* ─── Security & Password Card ────────────────────────────── */}
      <Card glass className="p-6 sm:p-8 border-ds-border space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-ds-border/60">
          <div className="w-10 h-10 rounded-xl bg-ds-primary/20 border border-ds-primary/40 flex items-center justify-center text-ds-accent">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-lg text-ds-text">
              Account Security & Password
            </h3>
            <p className="text-xs text-ds-text-muted">
              Ensure your password is at least 8 characters with numbers and capital letters.
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordSubmit(onUpdatePassword)} className="space-y-4 max-w-lg">
          <Input
            label="Current Password *"
            type="password"
            placeholder="••••••••"
            {...regPassword('currentPassword', { required: 'Current password is required' })}
            error={passwordErrors.currentPassword?.message}
          />

          <Input
            label="New Password *"
            type="password"
            placeholder="••••••••"
            {...regPassword('newPassword', {
              required: 'New password is required',
              minLength: { value: 8, message: 'Must be at least 8 characters' },
            })}
            error={passwordErrors.newPassword?.message}
          />

          <Input
            label="Confirm New Password *"
            type="password"
            placeholder="••••••••"
            {...regPassword('confirmPassword', {
              required: 'Please confirm your new password',
              validate: (val) => val === watchPassword('newPassword') || 'Passwords do not match',
            })}
            error={passwordErrors.confirmPassword?.message}
          />

          <div className="pt-2">
            <Button
              type="submit"
              variant="secondary"
              disabled={passwordSaving}
              className="text-xs px-6"
            >
              <Lock className="w-4 h-4 mr-1.5" />
              {passwordSaving ? 'Updating Password...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
