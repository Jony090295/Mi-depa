import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** True while the user arrived from a password-reset email and hasn't set a new password yet. */
  isRecovery: boolean;
  clearRecovery: () => void;
}

/**
 * Supabase puts the recovery token in the URL fragment. Read it synchronously so
 * the app never flashes the main UI before the reset screen takes over.
 */
function hashIsRecovery(): boolean {
  if (typeof window === 'undefined') return false;
  return /(^|[#&])type=recovery(&|$)/.test(window.location.hash);
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(hashIsRecovery);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const clearRecovery = () => {
    setIsRecovery(false);
    // Drop the token from the URL so a refresh doesn't reopen the reset screen
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  return { session, user: session?.user ?? null, loading, isRecovery, clearRecovery };
}
