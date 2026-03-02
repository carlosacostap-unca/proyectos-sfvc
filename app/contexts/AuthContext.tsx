'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthModel | null>(pb.authStore.model);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const checkUserRole = async (model: AuthModel) => {
    if (!model) return false;
    
    // Check if user is active
    // We access the properties directly from the model record
    // Only for 'users' collection (skip for superusers/admins)
    if (model.collectionName === 'users') {
        if (model.active === false) { // Explicit check for false
          console.warn('User is inactive, redirecting to login...');
          pb.authStore.clear();
          setUser(null);
          setIsAdmin(false);
          router.push('/login?error=inactive');
          return false;
        }

        // Ensure emailVisibility is true for the user
        if (!model.emailVisibility) {
          try {
            await pb.collection('users').update(model.id, { emailVisibility: true });
          } catch (err) {
            console.warn('Could not update emailVisibility.', err);
          }
        }
        
        setIsAdmin(!!model.isAdmin);
    } else if (model.collectionName === '_superusers') {
        // Superusers are always admins and don't have 'active'/'emailVisibility' fields in 'users' collection
        setIsAdmin(true);
    }
    
    return true;
  };

  const revalidateSession = async () => {
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
    } catch (err: any) {
      // Only clear auth if it's explicitly an auth error (401/403)
      if (err.status === 401 || err.status === 403) {
          console.warn('Session expired during revalidation:', err);
          pb.authStore.clear();
      } else {
          console.warn('Revalidation skipped due to network/other error:', err);
          // Keep the local session for offline capability or retry later
      }
    }
  };

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
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      // Create a unique requestKey for this auth attempt to prevent cancellations
      const requestKey = `auth_${Date.now()}`;
      const authData = await pb.collection('users').authWithOAuth2({ 
        provider: 'google',
        requestKey 
      });
      const model = authData.record;
      
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
    } catch (error: any) {
      console.error('Login error:', error);
      pb.authStore.clear();
      return { success: false, error: error.message };
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
