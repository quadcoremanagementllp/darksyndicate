import { type ClassValue, clsx } from 'clsx';

// ─── Class Name Utility ─────────────────────────────────────────────────────
// Lightweight alternative to clsx + twMerge for combining class names
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

// ─── Currency Formatting ────────────────────────────────────────────────────
/**
 * Format paise amount to INR display string.
 * @param paise - Amount in paise (integer)
 * @returns Formatted string like "₹1,299.00"
 */
export function formatCurrency(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Convert rupees to paise (integer). Avoids floating-point issues.
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Convert paise to rupees (for display only — not for calculations).
 */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

// ─── Date/Time Formatting ───────────────────────────────────────────────────
export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Format a UTC Date to IST display string safely.
 */
export function formatDateIST(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!(d instanceof Date) || isNaN(d.getTime())) {
    return String(date);
  }
  return d.toLocaleString('en-IN', {
    timeZone: IST_TIMEZONE,
    ...options,
  });
}

/**
 * Safely format a booking date (ISO string, Date object, or YYYY-MM-DD string) to IST display.
 * Example: "Fri, Oct 2, 2026" or "Oct 2, 2026"
 */
export function formatBookingDate(
  date: Date | string | null | undefined,
  includeWeekday = true
): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (d instanceof Date && !isNaN(d.getTime())) {
    return d.toLocaleDateString('en-US', {
      timeZone: IST_TIMEZONE,
      ...(includeWeekday ? { weekday: 'short' } : {}),
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return String(date);
}

/**
 * Safely format a booking time (ISO timestamp, HH:mm string, or Date object) to IST display.
 * Example: "6:00 PM"
 */
export function formatBookingTime(time: Date | string | null | undefined): string {
  if (!time) return '';
  if (typeof time === 'string') {
    // Check if it's already a plain time string (e.g., "18:00" or "18:00:00")
    const plainMatch = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (plainMatch) {
      const hours = parseInt(plainMatch[1], 10);
      const minutes = parseInt(plainMatch[2], 10);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      const mStr = minutes.toString().padStart(2, '0');
      return `${h12}:${mStr} ${ampm}`;
    }
  }
  const d = typeof time === 'string' ? new Date(time) : time;
  if (d instanceof Date && !isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-US', {
      timeZone: IST_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  return String(time);
}

/**
 * Format a date for display: "02 Oct 2026"
 */
export function formatDate(date: Date | string | null | undefined): string {
  return formatBookingDate(date, false);
}

/**
 * Format time for display: "6:00 PM"
 */
export function formatTime(date: Date | string | null | undefined): string {
  return formatBookingTime(date);
}

/**
 * Format datetime: "02 Oct 2026, 6:00 PM"
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!(d instanceof Date) || isNaN(d.getTime())) {
    return String(date);
  }
  return formatDateIST(date, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ─── String Utilities ───────────────────────────────────────────────────────

/**
 * Generate a human-readable booking reference.
 * Format: DS-YYYYMMDD-XXXX (e.g., DS-20260923-A7K9)
 */
export function generateBookingRef(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `DS-${dateStr}-${suffix}`;
}

/**
 * Slugify a string for URL use.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncate text with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// ─── Timing Utilities ───────────────────────────────────────────────────────

/**
 * Calculate remaining session time in seconds from DB timestamps.
 */
export function calculateRemainingSeconds(
  scheduledEndAt: Date,
  totalPausedSeconds: number = 0,
  pausedAt?: Date | null
): number {
  const now = new Date();
  const end = new Date(scheduledEndAt);

  // If currently paused, add time since pause started
  let currentPauseDuration = 0;
  if (pausedAt) {
    currentPauseDuration = Math.floor(
      (now.getTime() - new Date(pausedAt).getTime()) / 1000
    );
  }

  const adjustedEnd = new Date(
    end.getTime() + (totalPausedSeconds + currentPauseDuration) * 1000
  );
  const remaining = Math.floor((adjustedEnd.getTime() - now.getTime()) / 1000);

  return Math.max(0, remaining);
}

/**
 * Format seconds to "Xh Ym Zs" display.
 */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

// ─── Validation Helpers ─────────────────────────────────────────────────────

/**
 * Validate Indian phone number format.
 */
export function isValidIndianPhone(phone: string): boolean {
  return /^(\+91[\-\s]?)?[6-9]\d{9}$/.test(phone.replace(/\s/g, ''));
}

/**
 * Sanitize phone to +91XXXXXXXXXX format.
 */
export function sanitizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+91')) return cleaned;
  if (cleaned.startsWith('91') && cleaned.length === 12) return '+' + cleaned;
  if (cleaned.length === 10) return '+91' + cleaned;
  return cleaned;
}
