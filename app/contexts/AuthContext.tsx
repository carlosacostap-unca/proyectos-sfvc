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

  const checkUserRole = async (email: string) => {
    try {
      const result = await pb.collection('whitelist').getFirstListItem(`email = "${email}"`);
      
      if (!result.active) {
        console.warn('User is inactive, redirecting to login...');
        pb.authStore.clear();
        setUser(null);
        setIsAdmin(false);
        router.push('/login?error=inactive');
        return false;
      }
      
      setIsAdmin(!!result.isAdmin);
      return true;
    } catch (error: any) {
      // Ignore 404 errors (user not in whitelist)
      if (error.status !== 404) {
        console.error('Error checking user role:', error);
      }
      
      return false;
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const model = pb.authStore.model;
      setUser(model);
      
      if (model?.email) {
        const isValid = await checkUserRole(model.email);
        if (!isValid) {
          pb.authStore.clear();
          setUser(null);
          setIsAdmin(false);
        }
      }
      
      setLoading(false);
    };

    initAuth();

    // Subscribe to auth changes
    const unsubscribe = pb.authStore.onChange(async (token, model) => {
      setUser(model);
      if (model?.email) {
        await checkUserRole(model.email);
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const authData = await pb.collection('users').authWithOAuth2({ provider: 'google' });
      
      const email = authData.record?.email || authData.meta?.email;
      
      // Verify against whitelist collection in PocketBase
      try {
        const result = await pb.collection('whitelist').getFirstListItem(`email = "${email}"`);
        
        if (!result.active) {
          // Clear auth state immediately
          pb.authStore.clear();
          setUser(null);
          setIsAdmin(false);
          return { success: false, error: 'inactive' };
        }

        setIsAdmin(!!result.isAdmin);
        return { success: true };
      } catch (err: any) {
        // Ignore 404 errors (user not in whitelist)
        if (err.status !== 404) {
          console.error('Whitelist check failed:', err);
        }

        pb.authStore.clear();
        setIsAdmin(false);
        setUser(null); // Ensure user is cleared if whitelist check fails

        if (err.message === 'User is inactive') {
          return { success: false, error: 'inactive' };
        }

        return { success: false, error: 'access_denied' };
      }
    } catch (error: any) {
      console.error('Google login failed:', error);
      return { success: false, error: error.message || 'unknown' };
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
