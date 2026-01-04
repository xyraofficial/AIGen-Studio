
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

interface AuthContextType {
  session: any | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Track the user ID to prevent redundant fetches
  const currentUserId = useRef<string | null>(null);

  const fetchProfile = async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create one silently
        const defaultUsername = email?.split('@')[0] || 'User';
        const baseProfile = {
            id: userId,
            username: defaultUsername,
            role: 'user',
            avatar_url: null,
        };

        // 1. Attempt with Email
        if (email) {
            const { data: withEmailData, error: withEmailError } = await supabase
                .from('profiles')
                .insert([{ ...baseProfile, email }])
                .select()
                .single();
            
            if (!withEmailError) {
                setProfile({ ...withEmailData, email });
                return;
            }
        }

        // 2. Retry without Email (Fallback)
        const { data: noEmailData } = await supabase
            .from('profiles')
            .insert([baseProfile])
            .select()
            .single();
        
        if (noEmailData) {
            setProfile({ ...noEmailData, email });
        }

      } else if (data) {
        // Profile exists. 
        // Sync email silently if needed
        if (email && data.email !== email) {
             supabase.from('profiles').update({ email }).eq('id', userId).then(() => {});
        }

        const safeUsername = data.username || email?.split('@')[0] || 'User';
        
        setProfile({ 
            ...data, 
            username: safeUsername,
            email: email || data.email 
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    // 1. Initial Session Check (Instant)
    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await (supabase.auth as any).getSession();
        
        if (mounted) {
          if (initialSession) {
             setSession(initialSession);
             currentUserId.current = initialSession.user.id;
             // Background Fetch - Do NOT await this, let UI render immediately
             fetchProfile(initialSession.user.id, initialSession.user.email);
          }
        }
      } catch (error) {
        console.error("Auth init error:", error);
      } finally {
        if (mounted) {
            // IMMEDIATE UNLOCK: No timeouts, no delays.
            setLoading(false);
        }
      }
    };

    initAuth();

    // 2. Listen for Auth Changes
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(async (event: string, newSession: any) => {
      if (!mounted) return;

      setSession(newSession);
      
      if (newSession) {
         // If user changed, or if we haven't fetched profile for this user yet
         if (currentUserId.current !== newSession.user.id) {
             currentUserId.current = newSession.user.id;
             // Background fetch only
             fetchProfile(newSession.user.id, newSession.user.email);
         }
      } else {
        setProfile(null);
        currentUserId.current = null;
      }
      
      // Ensure loading is false on any auth change to prevent getting stuck
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    // This is the "Important Sync" - explicit refreshes wait for data
    if (session) {
        await fetchProfile(session.user.id, session.user.email);
    }
  }

  const signOut = async () => {
    await (supabase.auth as any).signOut();
    setSession(null);
    setProfile(null);
    currentUserId.current = null;
  };

  return (
    <AuthContext.Provider value={{ 
        session, 
        profile, 
        loading, 
        isAdmin: profile?.role === 'admin',
        refreshProfile,
        signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
