import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { apiSuccess, handleApiError, ConflictError, ValidationError, NotFoundError, ForbiddenError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';

const createStaffSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional().default(''),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Please enter a valid 10-digit phone number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['STAFF', 'ADMIN']).optional().default('STAFF'),
  address: z.string().optional().default(''),
  aadhaarNumber: z.string().optional().default(''),
  aadhaarDocumentUrl: z.string().optional().default(''),
  emergencyContact: z.string().optional().default(''),
  dateOfBirth: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

// ─── GET /api/admin/staff ───────────────────────────────────────────────────
export async function GET() {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN');
    const staffMembers = await prisma.user.findMany({
      where: {
        role: { in: ['STAFF', 'ADMIN', 'SUPER_ADMIN'] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        staffProfile: {
          select: {
            address: true,
            aadhaarNumber: true,
            aadhaarDocumentUrl: true,
            emergencyContact: true,
            dateOfBirth: true,
            joiningDate: true,
            notes: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess(
      staffMembers.map((s) => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`.trim(),
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        phone: s.phone || '—',
        role: s.role,
        status: s.status,
        lastLoginAt: s.lastLoginAt,
        createdAt: s.createdAt,
        address: s.staffProfile?.address || '',
        aadhaarNumber: s.staffProfile?.aadhaarNumber || '',
        aadhaarDocumentUrl: s.staffProfile?.aadhaarDocumentUrl || '',
        emergencyContact: s.staffProfile?.emergencyContact || '',
        dateOfBirth: s.staffProfile?.dateOfBirth ? s.staffProfile.dateOfBirth.toISOString().split('T')[0] : '',
        joiningDate: s.staffProfile?.joiningDate || s.createdAt,
        notes: s.staffProfile?.notes || '',
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// ─── POST /api/admin/staff (Onboard Staff with KYC & Address) ────────────────
export async function POST(req: NextRequest) {
  try {
    const adminSession = await requireRole('ADMIN', 'SUPER_ADMIN');
    const body = await req.json();
    const data = createStaffSchema.parse(body);

    const requestedRole = data.role === 'ADMIN' ? 'ADMIN' : 'STAFF';
    if (requestedRole === 'ADMIN' && adminSession.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Only Super Admin can onboard Administrator accounts');
    }

    const cleanEmail = data.email.toLowerCase().trim();
    const cleanPhone = data.phone.trim();

    // Check for existing email
    const existingEmail = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });
    if (existingEmail) {
      throw new ConflictError(`An account with email '${cleanEmail}' already exists`);
    }

    // Check for existing phone
    if (cleanPhone) {
      const existingPhone = await prisma.user.findFirst({
        where: { phone: cleanPhone },
      });
      if (existingPhone) {
        throw new ConflictError(
          `Phone number '${cleanPhone}' is already registered to ${existingPhone.firstName} ${existingPhone.lastName}`
        );
      }
    }

    const passwordHash = await hashPassword(data.password);

    const newStaff = await prisma.user.create({
      data: {
        firstName: data.firstName.trim(),
        lastName: (data.lastName || '').trim(),
        email: cleanEmail,
        phone: cleanPhone,
        passwordHash,
        role: requestedRole,
        status: 'ACTIVE',
        staffProfile: {
          create: {
            address: data.address?.trim() || null,
            aadhaarNumber: data.aadhaarNumber?.trim() || null,
            aadhaarDocumentUrl: data.aadhaarDocumentUrl || null,
            emergencyContact: data.emergencyContact?.trim() || null,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            joiningDate: new Date(),
            notes: data.notes?.trim() || null,
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        staffProfile: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminSession.userId,
        action: 'CREATE',
        entityType: 'User',
        entityId: newStaff.id,
        newValue: {
          name: `${newStaff.firstName} ${newStaff.lastName}`.trim(),
          email: newStaff.email,
          role: newStaff.role,
        },
      },
    }).catch(() => {});

    return apiSuccess(
      {
        id: newStaff.id,
        name: `${newStaff.firstName} ${newStaff.lastName}`.trim(),
        firstName: newStaff.firstName,
        lastName: newStaff.lastName,
        email: newStaff.email,
        phone: newStaff.phone,
        role: newStaff.role,
        status: newStaff.status,
        createdAt: newStaff.createdAt,
        address: newStaff.staffProfile?.address || '',
        aadhaarNumber: newStaff.staffProfile?.aadhaarNumber || '',
        aadhaarDocumentUrl: newStaff.staffProfile?.aadhaarDocumentUrl || '',
        emergencyContact: newStaff.staffProfile?.emergencyContact || '',
        joiningDate: newStaff.staffProfile?.joiningDate || newStaff.createdAt,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// ─── PATCH /api/admin/staff (Update Profile / Address / Aadhaar / Password / Role) ───
export async function PATCH(req: NextRequest) {
  try {
    const adminSession = await requireRole('ADMIN', 'SUPER_ADMIN');
    const body = await req.json();
    const {
      id,
      status,
      role,
      password,
      firstName,
      lastName,
      phone,
      address,
      aadhaarNumber,
      aadhaarDocumentUrl,
      emergencyContact,
      notes,
    } = body;

    if (!id) {
      throw new ValidationError('Staff user ID is required');
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundError('Staff account not found');
    }

    const isSuperAdmin = adminSession.role === 'SUPER_ADMIN';

    // Prevent regular ADMIN from modifying another ADMIN or SUPER_ADMIN account
    if (!isSuperAdmin && (target.role === 'ADMIN' || target.role === 'SUPER_ADMIN') && target.id !== adminSession.userId) {
      throw new ForbiddenError('Only Super Admin can modify Administrator accounts');
    }

    if (target.role === 'SUPER_ADMIN' && status && status !== 'ACTIVE') {
      throw new ValidationError('Cannot deactivate a Super Admin account');
    }

    // 1. Update User basic record
    const userUpdateData: any = {};
    if (status && ['ACTIVE', 'DEACTIVATED', 'BLOCKED'].includes(status)) {
      userUpdateData.status = status;
    }
    // Only Super Admin can change account roles (promote/demote)
    if (role && ['STAFF', 'ADMIN'].includes(role)) {
      if (!isSuperAdmin) {
        throw new ForbiddenError('Only Super Admin can change staff role permissions');
      }
      userUpdateData.role = role;
    }
    if (password && password.length >= 6) {
      userUpdateData.passwordHash = await hashPassword(password);
    }
    if (firstName) userUpdateData.firstName = firstName.trim();
    if (lastName !== undefined) userUpdateData.lastName = lastName.trim();
    if (phone) userUpdateData.phone = phone.trim();

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id },
        data: userUpdateData,
      });
    }

    // 2. Upsert StaffProfile for address, Aadhaar & emergency contact
    const hasProfileUpdates =
      address !== undefined ||
      aadhaarNumber !== undefined ||
      aadhaarDocumentUrl !== undefined ||
      emergencyContact !== undefined ||
      notes !== undefined;

    if (hasProfileUpdates) {
      await prisma.staffProfile.upsert({
        where: { userId: id },
        create: {
          userId: id,
          address: address || null,
          aadhaarNumber: aadhaarNumber || null,
          aadhaarDocumentUrl: aadhaarDocumentUrl || null,
          emergencyContact: emergencyContact || null,
          notes: notes || null,
        },
        update: {
          ...(address !== undefined ? { address } : {}),
          ...(aadhaarNumber !== undefined ? { aadhaarNumber } : {}),
          ...(aadhaarDocumentUrl !== undefined ? { aadhaarDocumentUrl } : {}),
          ...(emergencyContact !== undefined ? { emergencyContact } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
      });
    }

    // Fetch updated user with profile
    const updated = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        staffProfile: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminSession.userId,
        action: status && status !== target.status ? 'STATUS_CHANGE' : 'UPDATE',
        entityType: 'User',
        entityId: id,
        oldValue: {
          name: `${target.firstName} ${target.lastName}`.trim(),
          role: target.role,
          status: target.status,
        },
        newValue: {
          name: `${updated?.firstName} ${updated?.lastName}`.trim(),
          role: updated?.role,
          status: updated?.status,
          passwordReset: Boolean(password && password.length >= 6),
        },
      },
    }).catch(() => {});

    return apiSuccess({
      message: 'Staff account updated successfully',
      staff: {
        id: updated?.id,
        name: `${updated?.firstName} ${updated?.lastName}`.trim(),
        firstName: updated?.firstName,
        lastName: updated?.lastName,
        email: updated?.email,
        phone: updated?.phone || '—',
        role: updated?.role,
        status: updated?.status,
        lastLoginAt: updated?.lastLoginAt,
        createdAt: updated?.createdAt,
        address: updated?.staffProfile?.address || '',
        aadhaarNumber: updated?.staffProfile?.aadhaarNumber || '',
        aadhaarDocumentUrl: updated?.staffProfile?.aadhaarDocumentUrl || '',
        emergencyContact: updated?.staffProfile?.emergencyContact || '',
        notes: updated?.staffProfile?.notes || '',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ─── DELETE /api/admin/staff ────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const adminSession = await requireRole('ADMIN', 'SUPER_ADMIN');
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      throw new ValidationError('Staff user ID is required');
    }

    if (id === adminSession.userId) {
      throw new ValidationError('You cannot delete your own account');
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundError('Staff member not found');
    }

    if (target.role === 'SUPER_ADMIN') {
      throw new ValidationError('Cannot delete a Super Admin account');
    }

    if (adminSession.role !== 'SUPER_ADMIN' && target.role === 'ADMIN') {
      throw new ForbiddenError('Only Super Admin can delete or deactivate Administrator accounts');
    }

    try {
      await prisma.user.delete({ where: { id } });
      await prisma.auditLog.create({
        data: {
          userId: adminSession.userId,
          action: 'DELETE',
          entityType: 'User',
          entityId: id,
          oldValue: { name: `${target.firstName} ${target.lastName}`.trim(), email: target.email, role: target.role },
        },
      }).catch(() => {});
      return apiSuccess({
        message: `Staff account for ${target.firstName} ${target.lastName} deleted successfully`,
      });
    } catch {
      await prisma.user.update({
        where: { id },
        data: { status: 'DEACTIVATED' },
      });
      await prisma.auditLog.create({
        data: {
          userId: adminSession.userId,
          action: 'STATUS_CHANGE',
          entityType: 'User',
          entityId: id,
          oldValue: { status: target.status },
          newValue: { status: 'DEACTIVATED', note: 'Deactivated instead of deleted due to session records' },
        },
      }).catch(() => {});
      return apiSuccess({
        message: `Staff account has existing session records and was deactivated`,
      });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
