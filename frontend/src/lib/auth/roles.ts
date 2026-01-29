import { UserProfile, UserRole } from '../types';
import { User } from '@supabase/supabase-js';


/**
 * Check if user has admin role
 */
export function isAdmin(profile: UserProfile | null | undefined): boolean {
  return profile?.role === 'admin';
}

/**
 * Check if user has student role
 */
export function isStudent(profile: UserProfile | null | undefined): boolean {
  return profile?.role === 'student';
}

/**
 * Check if user has required role
 */
export function hasRole(
  profile: UserProfile | null | undefined,
  requiredRole: UserRole
): boolean {
  return profile?.role === requiredRole;
}

/**
 * Get user's role or return null if profile doesn't exist
 */
export function getUserRole(profile: UserProfile | null | undefined): UserRole | null {
  return profile?.role || null;
}

/**
 * Get redirect path based on user role
 */
export function getRoleBasedRedirect(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/app/admin';
    case 'student':
      return '/app';
    default:
      return '/app';
  }
}
