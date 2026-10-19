// ─── Application Constants ──────────────────────────────────────────────────

export const APP_NAME = 'DARK SYNDICATE GAMING WORLD';
export const APP_SHORT_NAME = 'DARK SYNDICATE';
export const APP_TAGLINE = 'ENTER THE GAME. OWN THE NIGHT.';
export const APP_TIMEZONE = 'Asia/Kolkata';
export const APP_CURRENCY = 'INR';
export const APP_CURRENCY_SYMBOL = '₹';

// ─── Auth Constants ─────────────────────────────────────────────────────────

export const AUTH_COOKIE_NAME = 'ds_session';
export const AUTH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
export const BCRYPT_ROUNDS = 12;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// ─── Rate Limiting ──────────────────────────────────────────────────────────

export const RATE_LIMIT = {
  LOGIN: {
    maxAttempts: 20,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  REGISTER: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  API: {
    maxAttempts: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  PASSWORD_RESET: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
};

// ─── Booking Constants ──────────────────────────────────────────────────────

export const BOOKING = {
  MIN_DURATION_MINUTES: 30,
  MAX_DURATION_MINUTES: 480, // 8 hours
  ADVANCE_BOOKING_DAYS: 30,
  SESSION_GRACE_MINUTES: 5,
  DEFAULT_DURATIONS: [30, 60, 90, 120, 180, 240], // in minutes
};

// ─── Pagination ─────────────────────────────────────────────────────────────

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};

// ─── Booking Statuses (Display Labels) ──────────────────────────────────────

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked In',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
  PAYMENT_FAILED: 'Payment Failed',
};

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  CHECKED_IN: 'info',
  IN_PROGRESS: 'success',
  COMPLETED: 'default',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
  PAYMENT_FAILED: 'danger',
};

// ─── Station Types (Display Labels) ─────────────────────────────────────────

export const STATION_TYPE_LABELS: Record<string, string> = {
  PS5: 'PS5 Gaming',
  POOL_TABLE: 'Pool Table',
  PC: 'PC Gaming',
  VR: 'VR Experience',
  OTHER: 'Other',
};

export const STATION_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Available',
  OCCUPIED: 'Occupied',
  MAINTENANCE: 'Under Maintenance',
  DEACTIVATED: 'Deactivated',
};

// ─── Payment Methods ────────────────────────────────────────────────────────

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  RAZORPAY: 'Razorpay',
  CASHFREE: 'Cashfree',
  CASH: 'Cash',
  UPI: 'UPI',
  OTHER: 'Other',
};

// ─── Nav Links ──────────────────────────────────────────────────────────────

export const PUBLIC_NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Passes', href: '/membership' },
  { label: 'Book Now', href: '/booking' },
  { label: 'Contact', href: '/contact' },
];

export const ADMIN_NAV_LINKS = [
  { label: 'Dashboard', href: '/admin', icon: 'LayoutDashboard' },
  { label: 'Bookings', href: '/admin/bookings', icon: 'CalendarCheck' },
  { label: 'Stations', href: '/admin/stations', icon: 'Gamepad2' },
  { label: 'Sessions', href: '/admin/sessions', icon: 'Timer' },
  { label: 'Customers', href: '/admin/customers', icon: 'Users' },
  { label: 'Pricing', href: '/admin/pricing', icon: 'IndianRupee' },
  { label: 'Payments', href: '/admin/payments', icon: 'CreditCard' },
  { label: 'Staff', href: '/admin/staff', icon: 'UserCog' },
  { label: 'Reports', href: '/admin/reports', icon: 'BarChart3' },
  { label: 'Content', href: '/admin/content', icon: 'FileText' },
  { label: 'Settings', href: '/admin/settings', icon: 'Settings' },
];

export const STAFF_NAV_LINKS = [
  { label: 'Dashboard', href: '/staff', icon: 'LayoutDashboard' },
  { label: 'Bookings', href: '/staff/bookings', icon: 'CalendarCheck' },
  { label: 'Sessions', href: '/staff/sessions', icon: 'Timer' },
  { label: 'Check In', href: '/staff/checkin', icon: 'QrCode' },
];
