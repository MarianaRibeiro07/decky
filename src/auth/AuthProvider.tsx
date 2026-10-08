import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  /** true até a sessão salva no aparelho ser lida. */
  loading: boolean;
  userId: string | null;
  displayName: string;
}

const AuthContext = createContext<AuthState>({ session: null, loading: true, userId: null, displayName: '' });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const user = session?.user;
  const value: AuthState = {
    session,
    loading,
    userId: user?.id ?? null,
    displayName: (user?.user_metadata?.display_name as string | undefined) ?? user?.email?.split('@')[0] ?? '',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

/** Retorna 'confirm_email' quando o projeto exige confirmar o e-mail antes de entrar. */
export async function signUp(email: string, password: string, displayName: string): Promise<'signed_in' | 'confirm_email'> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { display_name: displayName.trim() } },
  });
  if (error) throw error;
  return data.session ? 'signed_in' : 'confirm_email';
}

export async function signOut() {
  await supabase.auth.signOut();
}
