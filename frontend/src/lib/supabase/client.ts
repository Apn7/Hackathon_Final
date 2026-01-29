import { createBrowserClient } from '@supabase/ssr';
import type { Database, UserProfile } from '../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createSPAClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

/**
 * Get user profile from database
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createSPAClient();
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string) {
  const supabase = createSPAClient();
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Fetch user profile
  if (data.user) {
    const profile = await getUserProfile(data.user.id);
    return { user: data.user, profile };
  }

  return { user: data.user, profile: null };
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(email: string, password: string, fullName?: string) {
  const supabase = createSPAClient();
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) throw error;

  return data;
}

/**
 * Sign out
 */
export async function signOut() {
  const supabase = createSPAClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get current session and profile
 */
export async function getCurrentUser() {
  const supabase = createSPAClient();
  
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) {
    return { user: null, profile: null };
  }

  const profile = await getUserProfile(session.user.id);

  return { user: session.user, profile };
}