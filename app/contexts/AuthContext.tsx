'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { pb } from '@/lib/pocketbase';
import { AuthModel } from 'pocketbase';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: AuthModel | null;
  isAdmin: boolean;
  loading: boolean;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

type AppAuthModel = AuthModel & {
  active?: boolean;
  emailVisibility?: boolean;
  isAdmin?: boolean;
};

type RequestError = {
  status?: number;
  message?: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthModel | null>(pb.authStore.model);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const lastRevalidationRef = useRef<number>(0);

  const checkUserRole = useCallback(async (model: AuthModel) => {
    if (!model) return false;
    const appModel = model as AppAuthModel;
    
    // Check if user is active
    // We access the properties directly from the model record
    // Only for 'users' collection (skip for superusers/admins)
    if (appModel.collectionName === 'users') {
        if (appModel.active === false) { // Explicit check for false
          console.warn('User is inactive, redirecting to login...');
          pb.authStore.clear();
          setUser(null);
          setIsAdmin(false);
          router.push('/login?error=inactive');
          return false;
        }

        // Ensure emailVisibility is true for the user
        if (!appModel.emailVisibility) {
          try {
            await pb.collection('users').update(appModel.id, { emailVisibility: true });
          } catch (err) {
            console.warn('Could not update emailVisibility.', err);
          }
        }
        
        setIsAdmin(!!appModel.isAdmin);
    } else if (appModel.collectionName === '_superusers') {
        // Superusers are always admins and don't have 'active'/'emailVisibility' fields in 'users' collection
        setIsAdmin(true);
    }
    
    return true;
  }, [router]);

  const revalidateSession = useCallback(async () => {
    // Prevent excessive revalidation (throttle to once every 5 seconds)
    const now = Date.now();
    if (now - lastRevalidationRef.current < 5000) {
        return;
    }
    lastRevalidationRef.current = now;

    // Check if the token is valid (not expired) locally first
    if (!pb.authStore.isValid) {
      pb.authStore.clear();
      return;
    }

    try {
      // Refresh the auth token to ensure it's valid on the server
      const model = pb.authStore.model;
      if (model?.collectionName === 'users') {
         await pb.collection('users').authRefresh();
      } else if (model?.collectionName === '_superusers') {
         await pb.collection('_superusers').authRefresh();
      }
      // Note: authRefresh updates the store, which triggers the onChange listener below
    } catch (err: unknown) {
      const error = err as RequestError;
      // Only clear auth if it's explicitly an auth error (401/403)
      if (error.status === 401 || error.status === 403) {
          console.log('Session expired during revalidation. Clearing auth store.');
          pb.authStore.clear();
      } else {
          console.warn('Revalidation skipped due to network/other error:', error.message);
          // Keep the local session for offline capability or retry later
      }
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      await revalidateSession();
      setLoading(false);
    };

    initAuth();

    // Revalidate session when user returns to the tab/window
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            revalidateSession();
        }
    };
    
    const handleFocus = () => {
        revalidateSession();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Subscribe to auth changes
    const unsubscribe = pb.authStore.onChange(async (token, model) => {
      setUser(model);
      if (model) {
        await checkUserRole(model);
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkUserRole, revalidateSession]);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      // Create a unique requestKey for this auth attempt to prevent cancellations
      const requestKey = `auth_${Date.now()}`;
      const authData = await pb.collection('users').authWithOAuth2({ 
        provider: 'google',
        requestKey 
      });
      const model = authData.record as AppAuthModel | null;
      
      if (!model) throw new Error('No user record found');

      // Check active status directly from user record
      if (model.active === false) {
        pb.authStore.clear();
        setUser(null);
        setIsAdmin(false);
        return { success: false, error: 'inactive' };
      }

      setIsAdmin(!!model.isAdmin);
      
      // Update user state
      setUser(model);
      
      return { success: true };
    } catch (error: unknown) {
      const authError = error as RequestError;
      console.error('Login error:', error);
      pb.authStore.clear();
      return { success: false, error: authError.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    pb.authStore.clear();
    setIsAdmin(false);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
