
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

        const { data: noEmailData } = await supabase
            .from('profiles')
            .insert([baseProfile])
            .select()
            .single();
        
        if (noEmailData) {
            setProfile({ ...noEmailData, email });
        }

      } else if (data) {
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
    
    // Safety fallback: If supabase takes too long, just unlock the app.
    // This prevents "Syncing Profile" from getting stuck forever.
    const safetyTimer = setTimeout(() => {
        if (mounted && loading) {
            console.warn("Auth initialization timed out, forcing unlock.");
            setLoading(false);
        }
    }, 2000);

    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await (supabase.auth as any).getSession();
        
        if (mounted) {
          if (initialSession) {
             setSession(initialSession);
             currentUserId.current = initialSession.user.id;
             // Non-blocking fetch
             fetchProfile(initialSession.user.id, initialSession.user.email);
          }
        }
      } catch (error) {
        console.error("Auth init error:", error);
      } finally {
        if (mounted) {
            setLoading(false);
            clearTimeout(safetyTimer);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(async (event: string, newSession: any) => {
      if (!mounted) return;

      setSession(newSession);
      
      if (newSession) {
         if (currentUserId.current !== newSession.user.id) {
             currentUserId.current = newSession.user.id;
             fetchProfile(newSession.user.id, newSession.user.email);
         }
      } else {
        setProfile(null);
        currentUserId.current = null;
      }
      
      setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
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
