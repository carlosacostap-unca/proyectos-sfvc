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
    if (model.active === false) { // Explicit check for false, assuming default might be true or undefined
      console.warn('User is inactive, redirecting to login...');
      pb.authStore.clear();
      setUser(null);
      setIsAdmin(false);
      router.push('/login?error=inactive');
      return false;
    }

    // Ensure emailVisibility is true for the user
    // This handles both new logins and session restorations
    if (!model.emailVisibility) {
      try {
        await pb.collection('users').update(model.id, { emailVisibility: true });
        // The update will trigger a store change, which calls this function again with the updated model
      } catch (err) {
        console.warn('Could not update emailVisibility. Ensure API Rules allow users to update their own record.', err);
      }
    }
    
    setIsAdmin(!!model.isAdmin);
    return true;
  };

  useEffect(() => {
    const initAuth = async () => {
      const model = pb.authStore.model;
      setUser(model);
      
      if (model) {
        await checkUserRole(model);
      }
      
      setLoading(false);
    };

    initAuth();

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
