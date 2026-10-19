// ─── TypeScript Types for Auth ──────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'STAFF' | 'CUSTOMER';
  status: 'ACTIVE' | 'BLOCKED' | 'DEACTIVATED';
  phone?: string | null;
  avatarUrl?: string | null;
}

export interface SessionUser {
  userId: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, portal?: 'player' | 'admin' | 'staff') => Promise<AuthUser>;
  register: (data: RegisterData) => Promise<void>;
  logout: (reason?: 'MANUAL' | 'SYSTEM_INACTIVE') => Promise<void>;
  refreshUser: () => Promise<void>;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
}

export interface LoginResponse {
  data: {
    user: AuthUser;
  };
}

export interface ApiErrorResponse {
  error: {
    message: string;
    code: string;
    details?: Record<string, string[]>;
  };
}
