'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  UserCog,
  Plus,
  Search,
  Eye,
  EyeOff,
  Sparkles,
  KeyRound,
  Shield,
  Trash2,
  Power,
  CheckCircle2,
  Lock,
  Phone,
  Mail,
  User,
  UploadCloud,
  FileText,
  MapPin,
  CreditCard,
  Download,
  AlertCircle,
  X,
  FileCheck,
  Building,
  Clock,
  Calendar,
  Timer,
  History,
  Filter,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface StaffShiftItem {
  id: string;
  userId: string;
  staffName: string;
  staffEmail: string;
  staffRole: string;
  staffPhone: string;
  staffAvatar: string | null;
  dateFormatted: string;
  loginAt: string;
  loginTimeFormatted: string;
  logoutAt: string | null;
  logoutTimeFormatted: string;
  logoutDateFormatted: string | null;
  isActive: boolean;
  logoutReason: string;
  logoutReasonLabel: string;
  durationMinutes: number;
  durationFormatted: string;
  ipAddress: string;
}

interface ShiftSummary {
  totalWorkingMinutes: number;
  totalWorkingHoursFormatted: string;
  totalWorkingHoursDecimal: number;
  totalShifts: number;
  activeShifts: number;
  manualLogouts: number;
  systemInactivityLogouts: number;
}

interface StaffMember {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  role: 'STAFF' | 'ADMIN' | 'SUPER_ADMIN';
  status: 'ACTIVE' | 'DEACTIVATED' | 'BLOCKED';
  address?: string;
  aadhaarNumber?: string;
  aadhaarDocumentUrl?: string;
  emergencyContact?: string;
  dateOfBirth?: string;
  joiningDate?: string;
  notes?: string;
  lastLoginAt?: string;
  createdAt: string;
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);
  const [dossierModalOpen, setDossierModalOpen] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingStaff, setDeletingStaff] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DEACTIVATED'>('ALL');

  // Onboarding Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'STAFF' | 'ADMIN'>('STAFF');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [address, setAddress] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarDocumentUrl, setAadhaarDocumentUrl] = useState('');
  const [aadhaarFileName, setAadhaarFileName] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Dossier Edit State
  const [editRole, setEditRole] = useState<'STAFF' | 'ADMIN' | 'SUPER_ADMIN'>('STAFF');
  const [editAddress, setEditAddress] = useState('');
  const [editAadhaarNumber, setEditAadhaarNumber] = useState('');
  const [editAadhaarDoc, setEditAadhaarDoc] = useState('');
  const [editEmergencyContact, setEditEmergencyContact] = useState('');
  const [savingDossier, setSavingDossier] = useState(false);

  // Password Reset State
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'roster' | 'shifts'>('roster');

  // Shift Logs & Measurement State
  const [shifts, setShifts] = useState<StaffShiftItem[]>([]);
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary>({
    totalWorkingMinutes: 0,
    totalWorkingHoursFormatted: '0h 0m',
    totalWorkingHoursDecimal: 0,
    totalShifts: 0,
    activeShifts: 0,
    manualLogouts: 0,
    systemInactivityLogouts: 0,
  });
  const [shiftStaffList, setShiftStaffList] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState('ALL');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/staff');
      const json = await res.json();
      if (json.success && json.data) {
        setStaff(json.data || []);
      }
    } catch {
      toast.error('Failed to load staff roster');
    } finally {
      setLoading(false);
    }
  };

  const loadShifts = async () => {
    setLoadingShifts(true);
    try {
      const params = new URLSearchParams();
      if (selectedStaffFilter !== 'ALL') params.append('staffId', selectedStaffFilter);
      if (dateRangeFilter !== 'ALL') params.append('dateRange', dateRangeFilter);
      if (dateRangeFilter === 'CUSTOM') {
        if (customDateFrom) params.append('dateFrom', customDateFrom);
        if (customDateTo) params.append('dateTo', customDateTo);
      }

      const res = await fetch(`/api/admin/staff/shifts?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setShifts(json.data.shifts || []);
        if (json.data.summary) setShiftSummary(json.data.summary);
        if (json.data.staffMembers) setShiftStaffList(json.data.staffMembers);
      }
    } catch {
      toast.error('Failed to load staff shifts and logs');
    } finally {
      setLoadingShifts(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  useEffect(() => {
    if (activeTab === 'shifts') {
      loadShifts();
    }
  }, [activeTab, selectedStaffFilter, dateRangeFilter]);

  const handleExportShiftsCSV = () => {
    if (shifts.length === 0) {
      toast.error('No shift records to export');
      return;
    }
    const headers =
      'Team Member,Email,Role,Date (IST),Login Time (IST),Logout Time (IST),Status / Reason,Duration Formatted,Duration Minutes,IP Address\n';
    const rows = shifts
      .map(
        (s) =>
          `"${s.staffName}","${s.staffEmail}","${s.staffRole}","${s.dateFormatted}","${s.loginTimeFormatted}","${s.logoutTimeFormatted}","${s.logoutReasonLabel}","${s.durationFormatted}","${s.durationMinutes}","${s.ipAddress}"`
      )
      .join('\n');

    const summaryFooter = `\n"SUMMARY","Total Working Hours: ${shiftSummary.totalWorkingHoursFormatted}","Total Shifts: ${shiftSummary.totalShifts}","Active Shifts: ${shiftSummary.activeShifts}","System Inactivity Logouts: ${shiftSummary.systemInactivityLogouts}","Manual Logouts: ${shiftSummary.manualLogouts}"\n`;

    const blob = new Blob([headers + rows + summaryFooter], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `staff_shifts_and_hours_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Staff shift logs exported to CSV');
  };

  // Quick Password Generator
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
    setShowPassword(true);
  };

  // Handle Aadhaar File Selection (Base64)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 6 * 1024 * 1024) {
      toast.error('File size must be under 6MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (isEdit) {
        setEditAadhaarDoc(base64);
        toast.success(`Aadhaar document selected (${file.name})`);
      } else {
        setAadhaarDocumentUrl(base64);
        setAadhaarFileName(file.name);
        toast.success(`Aadhaar document uploaded (${file.name})`);
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
    };
    reader.readAsDataURL(file);
  };

  // Format Aadhaar Input (XXXX XXXX XXXX)
  const handleAadhaarChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 12);
    const formatted = clean.replace(/(\d{4})(?=\d)/g, '$1 ');
    setAadhaarNumber(formatted);
  };

  // Onboard Staff Submission
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || firstName.trim().length < 2) {
      toast.error('First name must be at least 2 characters');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      toast.error('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    if (!password || password.length < 6) {
      toast.error('Temporary password must be at least 6 characters');
      return;
    }

    if (aadhaarNumber.trim()) {
      const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');
      if (cleanAadhaar.length !== 12) {
        toast.error('Aadhaar number must be exactly 12 digits');
        return;
      }
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: cleanPhone,
          role,
          password,
          address: address.trim(),
          aadhaarNumber: aadhaarNumber.trim(),
          aadhaarDocumentUrl,
          emergencyContact: emergencyContact.trim(),
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Staff account for ${firstName} created successfully!`);
        setOnboardModalOpen(false);
        // Reset form
        setFirstName('');
        setLastName('');
        setEmail('');
        setPhone('');
        setRole('STAFF');
        setPassword('');
        setAddress('');
        setAadhaarNumber('');
        setAadhaarDocumentUrl('');
        setAadhaarFileName('');
        setEmergencyContact('');
        loadStaff();
      } else {
        toast.error(json.error?.message || 'Failed to onboard staff member');
      }
    } catch {
      toast.error('Network error while creating staff account');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Dossier Modal
  const openDossier = (member: StaffMember) => {
    setSelectedStaff(member);
    setEditRole(member.role);
    setEditAddress(member.address || '');
    setEditAadhaarNumber(member.aadhaarNumber || '');
    setEditAadhaarDoc(member.aadhaarDocumentUrl || '');
    setEditEmergencyContact(member.emergencyContact || '');
    setDossierModalOpen(true);
  };

  // Save Updated Dossier (Address, Role & Aadhaar)
  const handleSaveDossier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    setSavingDossier(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedStaff.id,
          role: selectedStaff.role !== 'SUPER_ADMIN' ? editRole : undefined,
          address: editAddress,
          aadhaarNumber: editAadhaarNumber,
          aadhaarDocumentUrl: editAadhaarDoc,
          emergencyContact: editEmergencyContact,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Updated information for ${selectedStaff.name}!`);
        loadStaff();
        setDossierModalOpen(false);
      } else {
        toast.error(json.error?.message || 'Failed to update staff dossier');
      }
    } catch {
      toast.error('Network error saving staff information');
    } finally {
      setSavingDossier(false);
    }
  };

  // Toggle Staff Status (ACTIVE <-> DEACTIVATED)
  const handleToggleStatus = async (member: StaffMember) => {
    const newStatus = member.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          status: newStatus,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(
          `${member.name} is now ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`
        );
        loadStaff();
      } else {
        toast.error(json.error?.message || 'Could not update staff status');
      }
    } catch {
      toast.error('Failed to change status');
    }
  };

  // Reset Staff Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !newPassword) return;

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    setResetting(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedStaff.id,
          password: newPassword,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Password updated for ${selectedStaff.name}!`);
        setResetPasswordModalOpen(false);
        setNewPassword('');
        setSelectedStaff(null);
      } else {
        toast.error(json.error?.message || 'Failed to update password');
      }
    } catch {
      toast.error('Network error updating password');
    } finally {
      setResetting(false);
    }
  };

  // Delete Staff Account
  const handleDeleteStaff = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!deleteTarget || !deletePassword || deletingStaff) return;
    setDeletingStaff(true);
    try {
      const res = await fetch(`/api/admin/staff?id=${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.data?.message || 'Staff account permanently deleted');
        setDeleteTarget(null);
        setDeletePassword('');
        await loadStaff();
      } else {
        toast.error(json.error?.message || 'Failed to delete staff member');
      }
    } catch {
      toast.error('Network error deleting staff');
    } finally {
      setDeletingStaff(false);
    }
  };

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staff.filter((s) => {
      const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
      const query = search.toLowerCase();
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.phone.toLowerCase().includes(query) ||
        (s.address && s.address.toLowerCase().includes(query)) ||
        (s.aadhaarNumber && s.aadhaarNumber.includes(query));

      return matchesStatus && matchesSearch;
    });
  }, [staff, statusFilter, search]);

  const activeCount = useMemo(() => staff.filter((s) => s.status === 'ACTIVE').length, [staff]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-black uppercase text-ds-text flex items-center gap-2.5">
            <UserCog className="w-6 h-6 text-ds-accent" />
            <span>Staff & Operator Accounts</span>
          </h1>
          <p className="text-xs text-ds-text-muted mt-0.5">
            Manage floor operators, KYC identification (Aadhaar & Address), and arena shift access.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'roster' ? (
            <>
              <Button variant="accent" size="sm" onClick={() => setOnboardModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Onboard Staff</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="accent"
                size="sm"
                onClick={handleExportShiftsCSV}
                className="shadow-lg shadow-ds-accent/20"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                <span>Export CSV</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-ds-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-heading font-bold uppercase transition-all ${
            activeTab === 'roster'
              ? 'bg-ds-accent text-white shadow-lg shadow-ds-accent/20 border border-ds-accent'
              : 'bg-ds-surface/60 text-ds-text-dim hover:text-white border border-ds-border'
          }`}
        >
          <UserCog className="w-4 h-4" />
          <span>Staff Accounts & KYC ({staff.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('shifts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-heading font-bold uppercase transition-all ${
            activeTab === 'shifts'
              ? 'bg-ds-accent text-white shadow-lg shadow-ds-accent/20 border border-ds-accent'
              : 'bg-ds-surface/60 text-ds-text-dim hover:text-white border border-ds-border'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Shift Logs & Working Hours</span>
          {shiftSummary.activeShifts > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          )}
        </button>
      </div>

      {activeTab === 'roster' && (
        <>
          {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-ds-surface/50 p-4 rounded-2xl border border-ds-border">
        {/* Status Filters */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-ds-text-dim mr-1">
            Status:
          </span>
          <div className="flex gap-1 bg-ds-dark p-1 rounded-xl border border-ds-border text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-heading font-bold uppercase transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-ds-accent text-white shadow-sm'
                  : 'text-ds-text-dim hover:text-white'
              }`}
            >
              All ({staff.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1 rounded-lg font-heading font-bold uppercase transition-all ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-emerald-400/80 hover:text-emerald-300'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('DEACTIVATED')}
              className={`px-3 py-1 rounded-lg font-heading font-bold uppercase transition-all ${
                statusFilter === 'DEACTIVATED'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-rose-400/80 hover:text-rose-300'
              }`}
            >
              Deactivated ({staff.length - activeCount})
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Input
            placeholder="Search name, phone, email, Aadhaar, address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs py-1.5 pl-8 w-full sm:w-80"
          />
          <Search className="w-3.5 h-3.5 text-ds-text-dim absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Staff Table Card */}
      <Card glass className="border-ds-border overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs text-ds-text-dim animate-pulse">
            Loading staff accounts and KYC records...
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-16 text-center text-xs text-ds-text-dim space-y-2">
            <UserCog className="w-8 h-8 text-ds-text-dim mx-auto opacity-50" />
            <p>No staff accounts found matching your search.</p>
            <Button variant="outline" size="sm" onClick={() => setOnboardModalOpen(true)} className="text-xs mt-2">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Onboard First Staff Member
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ds-dark/80 text-ds-text-dim uppercase text-[10px] font-mono border-b border-ds-border">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Operator Name</th>
                  <th className="py-3.5 px-4 font-semibold">Contact Details</th>
                  <th className="py-3.5 px-4 font-semibold">Residential Address</th>
                  <th className="py-3.5 px-4 font-semibold">Aadhaar Card / KYC</th>
                  <th className="py-3.5 px-4 font-semibold">Account Status</th>
                  <th className="py-3.5 px-4 font-semibold">Last Login</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border/40 font-body">
                {filteredStaff.map((s) => {
                  const isSuperAdmin = s.role === 'SUPER_ADMIN';
                  const isActive = s.status === 'ACTIVE';
                  const hasAadhaarDoc = Boolean(s.aadhaarDocumentUrl);
                  const hasAadhaarNum = Boolean(s.aadhaarNumber);

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-ds-surface/50 transition-colors group"
                    >
                      {/* Operator Name & Role */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-heading font-bold text-xs shrink-0 ${
                              isSuperAdmin
                                ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                                : 'bg-ds-accent/20 border border-ds-accent/40 text-ds-ice'
                            }`}
                          >
                            {s.name[0] || 'S'}
                          </div>
                          <div>
                            <div className="font-heading font-bold text-ds-text text-sm leading-tight flex items-center gap-1.5">
                              <span>{s.name}</span>
                            </div>
                            <span
                              className={`text-[9px] font-mono font-semibold uppercase ${
                                isSuperAdmin
                                  ? 'text-purple-400'
                                  : s.role === 'ADMIN'
                                  ? 'text-amber-400'
                                  : 'text-cyan-400'
                              }`}
                            >
                              {isSuperAdmin
                                ? 'Super Admin'
                                : s.role === 'ADMIN'
                                ? 'Administrator'
                                : 'Floor Operator'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact Details */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <div className="text-ds-text leading-tight">{s.phone}</div>
                        <div className="text-[11px] text-ds-text-dim truncate max-w-[170px]">
                          {s.email}
                        </div>
                      </td>

                      {/* Residential Address */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        {s.address ? (
                          <div className="flex items-start gap-1.5 text-ds-text-muted text-[11px] leading-snug line-clamp-2">
                            <MapPin className="w-3 h-3 text-ds-accent shrink-0 mt-0.5" />
                            <span className="truncate">{s.address}</span>
                          </div>
                        ) : (
                          <span className="text-ds-text-dim text-[11px] italic">Address not provided</span>
                        )}
                      </td>

                      {/* Aadhaar Card / KYC Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {hasAadhaarNum ? (
                            <div className="font-mono text-xs text-ds-text flex items-center gap-1.5">
                              <CreditCard className="w-3 h-3 text-cyan-400" />
                              <span>{s.aadhaarNumber}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-mono text-ds-text-dim italic block">
                              No Aadhaar No.
                            </span>
                          )}

                          {hasAadhaarDoc ? (
                            <button
                              type="button"
                              onClick={() => openDossier(s)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all"
                            >
                              <FileCheck className="w-3 h-3 text-emerald-400" />
                              <span>Aadhaar Doc Uploaded</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openDossier(s)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
                            >
                              <AlertCircle className="w-3 h-3 text-amber-400" />
                              <span>KYC Pending Upload</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                            }`}
                          />
                          <span>{s.status}</span>
                        </span>
                      </td>

                      {/* Last Login */}
                      <td className="py-3.5 px-4 text-ds-text-dim font-mono text-[11px] whitespace-nowrap">
                        {s.lastLoginAt
                          ? new Date(s.lastLoginAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Never'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Full Dossier Button */}
                          <button
                            type="button"
                            onClick={() => openDossier(s)}
                            className="p-1.5 rounded-lg border border-ds-border text-ds-text-dim hover:text-ds-ice hover:border-ds-accent/40 hover:bg-ds-accent/10 transition-all"
                            title="View Staff Dossier & Aadhaar Card"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick View Shifts & Hours Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStaffFilter(s.id);
                              setActiveTab('shifts');
                            }}
                            className="p-1.5 rounded-lg border border-ds-border text-ds-text-dim hover:text-amber-400 hover:border-amber-500/40 hover:bg-amber-500/10 transition-all"
                            title="View Shift Logs & Working Hours"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active / Deactivate Button */}
                          {!isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(s)}
                              className={`p-1.5 rounded-lg border text-xs font-mono transition-all ${
                                isActive
                                  ? 'border-ds-border text-ds-text-dim hover:text-amber-400 hover:border-amber-500/40 hover:bg-amber-500/10'
                                  : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                              }`}
                              title={isActive ? 'Deactivate Account' : 'Activate Account'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Reset Password Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStaff(s);
                              setNewPassword('');
                              setResetPasswordModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-ds-border text-ds-text-dim hover:text-ds-ice hover:border-ds-accent/40 hover:bg-ds-accent/10 transition-all"
                            title="Reset Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Account Button */}
                          {!isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTarget(s);
                                setDeletePassword('');
                              }}
                              className="p-1.5 rounded-lg border border-ds-border text-ds-text-dim hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10 transition-all"
                              title="Delete Staff Member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
        </>
      )}

      {activeTab === 'shifts' && (
        <div className="space-y-6">
          {/* Top KPI Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Card 1: Total Working Hours */}
            <Card
              glass
              className="p-4 border-ds-accent/40 bg-gradient-to-br from-ds-accent/10 via-ds-surface/60 to-transparent relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-ds-text-dim">
                  Total Working Hours
                </span>
                <Clock className="w-4 h-4 text-ds-accent" />
              </div>
              <div className="text-2xl font-heading font-black text-ds-ice mt-2 tracking-tight">
                {shiftSummary.totalWorkingHoursFormatted}
              </div>
              <span className="text-[10px] font-mono text-ds-text-dim block mt-0.5">
                {shiftSummary.totalWorkingHoursDecimal} decimal hours
              </span>
            </Card>

            {/* Card 2: Total Recorded Shifts */}
            <Card glass className="p-4 border-ds-border bg-ds-surface/40">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-ds-text-dim">
                  Total Shifts
                </span>
                <Calendar className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-heading font-black text-ds-text mt-2">
                {shiftSummary.totalShifts}
              </div>
              <span className="text-[10px] font-mono text-ds-text-dim block mt-0.5">
                Clock-in sessions
              </span>
            </Card>

            {/* Card 3: Active Operators Now */}
            <Card glass className="p-4 border-emerald-500/30 bg-emerald-500/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                  Active Now
                </span>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              </div>
              <div className="text-2xl font-heading font-black text-emerald-400 mt-2">
                {shiftSummary.activeShifts}
              </div>
              <span className="text-[10px] font-mono text-ds-text-dim block mt-0.5">
                On duty right now
              </span>
            </Card>

            {/* Card 4: System Inactivity Logouts */}
            <Card glass className="p-4 border-amber-500/30 bg-amber-500/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                  System 1h Inactive
                </span>
                <AlertCircle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-heading font-black text-amber-300 mt-2">
                {shiftSummary.systemInactivityLogouts}
              </div>
              <span className="text-[10px] font-mono text-amber-400/80 block mt-0.5">
                Auto-logout by system
              </span>
            </Card>

            {/* Card 5: Manual Logouts */}
            <Card glass className="p-4 border-cyan-500/30 bg-cyan-500/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                  Manual Logouts
                </span>
                <Power className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-heading font-black text-cyan-300 mt-2">
                {shiftSummary.manualLogouts}
              </div>
              <span className="text-[10px] font-mono text-ds-text-dim block mt-0.5">
                Staff clicked sign out
              </span>
            </Card>
          </div>

          {/* Shifts Filter Toolbar */}
          <div className="flex flex-col gap-3 bg-ds-surface/50 p-4 rounded-2xl border border-ds-border">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Operator Filter */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-ds-text-dim">
                  Staff / Admin:
                </span>
                <select
                  value={selectedStaffFilter}
                  onChange={(e) => setSelectedStaffFilter(e.target.value)}
                  className="bg-ds-dark border border-ds-border rounded-xl px-3 py-1.5 text-xs text-ds-text font-mono focus:border-ds-accent focus:outline-none"
                >
                  <option value="ALL">All Staff & Admins ({shiftStaffList.length})</option>
                  {shiftStaffList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range Presets */}
              <div className="flex items-center gap-1 bg-ds-dark p-1 rounded-xl border border-ds-border text-xs overflow-x-auto whitespace-nowrap min-w-0">
                {(
                  [
                    { id: 'ALL', label: 'All Time' },
                    { id: 'TODAY', label: 'Today' },
                    { id: 'YESTERDAY', label: 'Yesterday' },
                    { id: '7DAYS', label: 'Last 7 Days' },
                    { id: '30DAYS', label: 'Last 30 Days' },
                    { id: 'CUSTOM', label: 'Custom' },
                  ] as const
                ).map((range) => (
                  <button
                    key={range.id}
                    type="button"
                    onClick={() => setDateRangeFilter(range.id)}
                    className={`px-2.5 py-1 rounded-lg font-heading font-bold uppercase transition-all shrink-0 ${
                      dateRangeFilter === range.id
                        ? 'bg-ds-accent text-white shadow-sm'
                        : 'text-ds-text-dim hover:text-white'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Pickers if CUSTOM selected */}
            {dateRangeFilter === 'CUSTOM' && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-ds-border/60">
                <span className="text-[10px] font-mono uppercase tracking-wider text-ds-text-dim">
                  Date Range:
                </span>
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="bg-ds-dark border border-ds-border rounded-xl px-2.5 py-1 text-xs text-ds-text font-mono"
                />
                <span className="text-ds-text-dim text-xs">to</span>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="bg-ds-dark border border-ds-border rounded-xl px-2.5 py-1 text-xs text-ds-text font-mono"
                />
                <Button variant="ghost" size="sm" onClick={loadShifts} className="text-xs">
                  Apply Filter
                </Button>
              </div>
            )}
          </div>

          {/* Shifts & Hours Table */}
          <Card glass className="border-ds-border overflow-hidden p-0">
            {loadingShifts ? (
              <div className="p-16 text-center text-xs text-ds-text-dim animate-pulse">
                Loading team attendance logs and calculating hours...
              </div>
            ) : shifts.length === 0 ? (
              <div className="p-16 text-center text-xs text-ds-text-dim space-y-2">
                <Clock className="w-8 h-8 text-ds-text-dim mx-auto opacity-50" />
                <p>No shift records found for the selected criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-ds-dark/80 text-ds-text-dim uppercase text-[10px] font-mono border-b border-ds-border">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">Date (IST)</th>
                      <th className="py-3.5 px-4 font-semibold">Team Member</th>
                      <th className="py-3.5 px-4 font-semibold">Login Time (IST)</th>
                      <th className="py-3.5 px-4 font-semibold">Logout Time (IST)</th>
                      <th className="py-3.5 px-4 font-semibold">Status / Logout Reason</th>
                      <th className="py-3.5 px-4 font-semibold">Working Duration</th>
                      <th className="py-3.5 px-4 font-semibold">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ds-border/40 font-body">
                    {shifts.map((s) => (
                      <tr key={s.id} className="hover:bg-ds-surface/50 transition-colors group">
                        {/* Date (IST) */}
                        <td className="py-3.5 px-4 font-mono text-xs font-semibold text-ds-ice whitespace-nowrap">
                          {s.dateFormatted}
                        </td>

                        {/* Staff Member */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-ds-accent/20 border border-ds-accent/40 flex items-center justify-center font-heading font-bold text-xs text-ds-ice shrink-0">
                              {s.staffName[0] || 'S'}
                            </div>
                            <div>
                              <div className="font-heading font-bold text-ds-text text-sm leading-tight flex items-center gap-1.5">
                                <span>{s.staffName}</span>
                              </div>
                              <div className="text-[10px] text-ds-text-dim font-mono">
                                <span className="text-cyan-400 font-semibold">{s.staffRole}</span> •{' '}
                                {s.staffEmail}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Login Time (IST) */}
                        <td className="py-3.5 px-4 font-mono text-xs text-emerald-400 font-semibold whitespace-nowrap">
                          {s.loginTimeFormatted}
                        </td>

                        {/* Logout Time (IST) */}
                        <td className="py-3.5 px-4 font-mono text-xs whitespace-nowrap">
                          {s.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Active Now</span>
                            </span>
                          ) : (
                            <span className="text-ds-text">
                              {s.logoutTimeFormatted}
                              {s.logoutDateFormatted && s.logoutDateFormatted !== s.dateFormatted && (
                                <span className="block text-[10px] text-ds-text-dim">{s.logoutDateFormatted} IST</span>
                              )}
                            </span>
                          )}
                        </td>

                        {/* Status / Logout Reason */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {s.isActive ? (
                            <Badge variant="success" size="sm">
                              Active Shift
                            </Badge>
                          ) : s.logoutReason === 'SYSTEM_INACTIVE' ? (
                            <div className="flex flex-col gap-0.5">
                              <Badge
                                variant="warning"
                                size="sm"
                                className="bg-amber-500/20 text-amber-300 border-amber-500/40 inline-flex items-center gap-1"
                              >
                                <AlertCircle className="w-3 h-3" />
                                <span>LOGOUT (SYSTEM_TIMEOUT)</span>
                              </Badge>
                              <span className="text-[10px] text-amber-400 font-semibold font-mono">
                                Logout by system due to inactivity
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <Badge variant="default" size="sm">
                                LOGOUT (MANUAL)
                              </Badge>
                              <span className="text-[10px] text-ds-text-dim font-mono">
                                Manual logout
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Working Duration */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {s.isActive ? (
                            <span className="font-mono font-bold text-emerald-400 text-xs px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                              {s.durationFormatted} (live)
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-ds-text text-xs bg-ds-surface px-2 py-0.5 rounded border border-ds-border">
                              {s.durationFormatted}
                            </span>
                          )}
                        </td>

                        {/* IP Address */}
                        <td className="py-3.5 px-4 font-mono text-[11px] text-ds-text-dim whitespace-nowrap">
                          {s.ipAddress}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </Card>
        </div>
      )}

      {/* ─── ONBOARD STAFF MODAL (WITH ADDRESS & AADHAAR CARD UPLOAD) ──────────── */}
      <Modal
        isOpen={onboardModalOpen}
        onClose={() => setOnboardModalOpen(false)}
        title="Onboard New Staff Member"
        description="Register a new floor operator with residential address and Aadhaar KYC identification."
        size="xl"
      >
        <form onSubmit={handleCreateStaff} className="space-y-4 pt-1">
          {/* SECTION 1: Personal & Contact */}
          <div className="space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-ds-accent font-bold block border-b border-ds-border/60 pb-1">
              1. Personal & Contact Information
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                  First Name <span className="text-rose-400">*</span>
                </label>
                <Input
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="text-xs py-2 bg-ds-dark border-ds-border"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                  Last Name
                </label>
                <Input
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="text-xs py-2 bg-ds-dark border-ds-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                  Email Address <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-xs py-2 bg-ds-dark border-ds-border"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                  Primary Mobile Phone <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="tel"
                  placeholder="Primary mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="text-xs py-2 bg-ds-dark border-ds-border font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                  Account Role <span className="text-rose-400">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'STAFF' | 'ADMIN')}
                  className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2 text-xs text-ds-text font-mono focus:outline-none focus:border-ds-accent"
                >
                  <option value="STAFF">Floor Operator (STAFF)</option>
                  <option value="ADMIN">Administrator (ADMIN)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                  Emergency Contact / Alternate Phone
                </label>
                <Input
                  type="tel"
                  placeholder="Emergency contact number"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  className="text-xs py-2 bg-ds-dark border-ds-border font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                  Temporary Login Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Temporary password (minimum 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="text-xs py-2 pr-16 bg-ds-dark border-ds-border font-mono"
                  />
                  <div className="absolute right-2 top-2 flex items-center gap-1 text-ds-text-dim">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 hover:text-ds-ice"
                      title={showPassword ? 'Hide' : 'Show'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="p-1 text-ds-accent hover:text-ds-ice"
                      title="Generate Secure Password"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Address & Aadhaar Identification */}
          <div className="space-y-3 pt-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-ds-accent font-bold block border-b border-ds-border/60 pb-1">
              2. Residential Address & KYC Verification
            </span>

            {/* Address */}
            <div className="space-y-1">
              <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                Full Residential Address
              </label>
              <textarea
                rows={2}
                placeholder="Full residential address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-ds-dark border border-ds-border text-xs text-ds-text focus:outline-none focus:border-ds-accent transition-colors"
              />
            </div>

            {/* Aadhaar Number & Upload Area */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <div className="space-y-1">
                <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                  Aadhaar Card Number
                </label>
                <Input
                  placeholder="12-digit Aadhaar card number"
                  value={aadhaarNumber}
                  onChange={(e) => handleAadhaarChange(e.target.value)}
                  className="text-xs py-2 bg-ds-dark border-ds-border font-mono tracking-widest"
                />
                <span className="text-[10px] font-mono text-ds-text-dim block">
                  Government issued 12-digit UIDAI identity
                </span>
              </div>

              {/* Aadhaar Document Upload */}
              <div className="space-y-1">
                <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                  Aadhaar Card Document / Photo
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileUpload(e, false)}
                  accept="image/*,application/pdf"
                  className="hidden"
                />

                {aadhaarDocumentUrl ? (
                  <div className="p-2.5 rounded-xl bg-ds-surface border border-emerald-500/40 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {aadhaarDocumentUrl.startsWith('data:image') ? (
                        <img
                          src={aadhaarDocumentUrl}
                          alt="Aadhaar Preview"
                          className="w-10 h-10 object-cover rounded-lg border border-ds-border shrink-0"
                        />
                      ) : (
                        <FileText className="w-8 h-8 text-ds-ice shrink-0" />
                      )}
                      <div className="min-w-0 truncate">
                        <p className="text-xs font-heading font-bold text-emerald-400 truncate">
                          {aadhaarFileName || 'Aadhaar Attached'}
                        </p>
                        <span className="text-[10px] font-mono text-ds-text-dim">Ready to save</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setAadhaarDocumentUrl('');
                        setAadhaarFileName('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-1 rounded-lg text-ds-text-dim hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 rounded-xl border border-dashed border-ds-border hover:border-ds-accent/60 bg-ds-dark/60 hover:bg-ds-surface/40 transition-all cursor-pointer text-center group"
                  >
                    <UploadCloud className="w-5 h-5 text-ds-text-dim group-hover:text-ds-accent mx-auto mb-1 transition-colors" />
                    <span className="text-xs font-heading font-bold text-ds-text group-hover:text-ds-ice block">
                      Upload Aadhaar Card
                    </span>
                    <span className="text-[10px] font-mono text-ds-text-dim">
                      Supports JPG, PNG, or PDF up to 6MB
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-ds-border/60 sticky bottom-0 bg-ds-surface/95 backdrop-blur-md -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => setOnboardModalOpen(false)}
              disabled={submitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button variant="accent" type="submit" disabled={submitting} className="text-xs font-heading font-bold uppercase">
              {submitting ? 'Creating Staff Account...' : 'Create Staff Account'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── STAFF DOSSIER MODAL (FULL PROFILE & AADHAAR CARD VIEWER) ─────────── */}
      <Modal
        isOpen={dossierModalOpen}
        onClose={() => {
          setDossierModalOpen(false);
          setSelectedStaff(null);
        }}
        title={`Staff Dossier: ${selectedStaff?.name || 'Operator'}`}
        description="Comprehensive personal records, residential address, and Aadhaar card verification."
        size="xl"
      >
        {selectedStaff && (
          <form onSubmit={handleSaveDossier} className="space-y-4 pt-1">
            {/* Header Identity Badge */}
            <div className="p-4 rounded-xl bg-ds-surface/60 border border-ds-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-ds-accent/20 border border-ds-accent/40 text-ds-ice flex items-center justify-center font-heading font-black text-lg">
                  {selectedStaff.name[0] || 'S'}
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-ds-text">{selectedStaff.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-ds-text-dim">{selectedStaff.email}</span>
                    <span className="text-ds-border">•</span>
                    <span className="text-xs font-mono text-ds-accent">{selectedStaff.phone}</span>
                  </div>
                </div>
              </div>

              <div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                    selectedStaff.status === 'ACTIVE'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      selectedStaff.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                    }`}
                  />
                  <span>{selectedStaff.status}</span>
                </span>
              </div>
            </div>

            {/* Editable Role, Address & Emergency Contact */}
            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-ds-accent font-bold block border-b border-ds-border/60 pb-1">
                Role, Residential Address & Emergency Contact
              </span>

              {selectedStaff.role !== 'SUPER_ADMIN' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim flex items-center gap-1">
                    <Shield className="w-3 h-3 text-ds-accent" />
                    <span>Account Role</span>
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as 'STAFF' | 'ADMIN')}
                    className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2 text-xs text-ds-text font-mono focus:outline-none focus:border-ds-accent"
                  >
                    <option value="STAFF">Floor Operator (STAFF)</option>
                    <option value="ADMIN">Administrator (ADMIN)</option>
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-ds-accent" />
                  <span>Residential Address</span>
                </label>
                <textarea
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Enter complete residential address"
                  className="w-full px-3 py-2 rounded-xl bg-ds-dark border border-ds-border text-xs text-ds-text focus:outline-none focus:border-ds-accent transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                    Emergency Contact Number
                  </label>
                  <Input
                    type="tel"
                    value={editEmergencyContact}
                    onChange={(e) => setEditEmergencyContact(e.target.value)}
                    placeholder="+91 98400 12345"
                    className="text-xs py-2 bg-ds-dark border-ds-border font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-ds-accent" />
                    <span>Aadhaar Card Number</span>
                  </label>
                  <Input
                    value={editAadhaarNumber}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '').slice(0, 12);
                      const formatted = clean.replace(/(\d{4})(?=\d)/g, '$1 ');
                      setEditAadhaarNumber(formatted);
                    }}
                    placeholder="XXXX XXXX XXXX"
                    className="text-xs py-2 bg-ds-dark border-ds-border font-mono tracking-widest"
                  />
                </div>
              </div>
            </div>

            {/* Aadhaar Card Document Preview / Viewer */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-ds-border/60 pb-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-ds-accent font-bold">
                  Government Aadhaar Card Document
                </span>

                <input
                  type="file"
                  ref={editFileInputRef}
                  onChange={(e) => handleFileUpload(e, true)}
                  accept="image/*,application/pdf"
                  className="hidden"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => editFileInputRef.current?.click()}
                  className="text-xs py-1 h-7 border-ds-border"
                >
                  <UploadCloud className="w-3.5 h-3.5 mr-1 text-ds-accent" />
                  <span>{editAadhaarDoc ? 'Replace Document' : 'Upload Aadhaar Card'}</span>
                </Button>
              </div>

              {editAadhaarDoc ? (
                <div className="p-3 rounded-xl bg-ds-dark border border-ds-border space-y-2">
                  {editAadhaarDoc.startsWith('data:image') ? (
                    <div className="space-y-2">
                      <div className="relative rounded-lg overflow-hidden border border-ds-border max-h-72 bg-black/60 flex items-center justify-center">
                        <img
                          src={editAadhaarDoc}
                          alt="Aadhaar Card"
                          className="max-h-72 w-auto object-contain hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Aadhaar Document Verified on File</span>
                        </span>
                        <a
                          href={editAadhaarDoc}
                          download={`Aadhaar_${selectedStaff.name.replace(/\s+/g, '_')}.png`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-ds-surface border border-ds-border text-[11px] font-heading font-bold text-ds-ice hover:bg-ds-accent/20 transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download Image</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center space-y-2">
                      <FileText className="w-10 h-10 text-ds-ice mx-auto" />
                      <p className="text-xs font-heading font-bold text-ds-text">PDF Document Attached</p>
                      <a
                        href={editAadhaarDoc}
                        download={`Aadhaar_${selectedStaff.name.replace(/\s+/g, '_')}.pdf`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ds-surface border border-ds-border text-xs font-heading font-bold text-ds-ice hover:bg-ds-accent/20 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PDF Document</span>
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => editFileInputRef.current?.click()}
                  className="p-8 rounded-xl border-2 border-dashed border-ds-border hover:border-ds-accent/60 bg-ds-dark/40 hover:bg-ds-surface/30 transition-all cursor-pointer text-center group"
                >
                  <AlertCircle className="w-7 h-7 text-amber-400 mx-auto mb-1.5 opacity-80" />
                  <p className="text-xs font-heading font-bold text-ds-text group-hover:text-ds-ice">
                    No Aadhaar Card Uploaded
                  </p>
                  <span className="text-[11px] text-ds-text-dim block mt-0.5">
                    Click to upload front-side photo or scan copy (JPG, PNG, or PDF)
                  </span>
                </div>
              )}
            </div>

            {/* Dossier Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-ds-border/60 sticky bottom-0 bg-ds-surface/95 backdrop-blur-md -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => setDossierModalOpen(false)}
                disabled={savingDossier}
                className="text-xs"
              >
                Close
              </Button>
              <Button variant="accent" type="submit" disabled={savingDossier} className="text-xs font-heading font-bold uppercase">
                {savingDossier ? 'Saving Changes...' : 'Save Updated Records'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ─── RESET PASSWORD MODAL ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={resetPasswordModalOpen}
        onClose={() => {
          setResetPasswordModalOpen(false);
          setSelectedStaff(null);
        }}
        title={`Reset Password for ${selectedStaff?.name || 'Staff'}`}
        description="Assign a new temporary password for this operator account."
      >
        <form onSubmit={handleResetPassword} className="space-y-4 pt-1">
          <div className="space-y-1">
            <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim">
              New Password <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Input
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Enter at least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="text-xs py-2 pr-10 bg-ds-dark border-ds-border font-mono"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-2.5 text-ds-text-dim hover:text-ds-ice transition-colors"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-ds-border/60">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setResetPasswordModalOpen(false);
                setSelectedStaff(null);
              }}
              disabled={resetting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button variant="accent" type="submit" disabled={resetting} className="text-xs">
              {resetting ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (!deletingStaff) {
            setDeleteTarget(null);
            setDeletePassword('');
          }
        }}
        title={`Delete ${deleteTarget?.name || 'staff account'}?`}
        description="This permanently removes the account. Historical bookings and payments remain in the ledger."
        size="sm"
      >
        <form onSubmit={handleDeleteStaff} className="space-y-4 pt-2">
          <Input
            label="Your admin password"
            type="password"
            autoComplete="current-password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            required
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={deletingStaff}
              onClick={() => { setDeleteTarget(null); setDeletePassword(''); }}
            >Cancel</Button>
            <Button type="submit" variant="danger" disabled={!deletePassword || deletingStaff}>
              {deletingStaff ? 'Deleting...' : 'Delete permanently'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
