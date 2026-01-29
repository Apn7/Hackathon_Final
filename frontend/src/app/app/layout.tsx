import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/supabase/client';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return <>{children}</>;
}