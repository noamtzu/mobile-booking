import type { User } from '@booking/shared';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken, setUnauthorizedHandler } from './api';
import { tokenStorage } from './storage';

const TOKEN_KEY = 'booking.session.token';

export type Session = { token: string; user: User };

export interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  session: Session | null;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [session, setSession] = useState<Session | null>(null);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setSession(null);
    setStatus('signedOut');
    queryClient.clear();
    await tokenStorage.remove(TOKEN_KEY);
  }, [queryClient]);

  const signIn = useCallback(async (next: Session) => {
    setAuthToken(next.token);
    await tokenStorage.set(TOKEN_KEY, next.token);
    setSession(next);
    setStatus('signedIn');
  }, []);

  // Restore the session on launch; /auth/me confirms the token is still valid.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await tokenStorage.get(TOKEN_KEY);
      if (!token) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      setAuthToken(token);
      try {
        const user = await api.me();
        if (!cancelled) {
          setSession({ token, user });
          setStatus('signedIn');
        }
      } catch {
        if (!cancelled) await signOut();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signOut]);

  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const value = useMemo(() => ({ status, session, signIn, signOut }), [status, session, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
