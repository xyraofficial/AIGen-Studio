
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
  
  // Track if we are still in the initialization phase to prevent blocking sync on refresh
  const isInitializing = useRef(true);
  // Track the user ID we initialized with to prevent duplicate "login" events for the same user
  const initialUserId = useRef<string | null>(null);

  const fetchProfile = async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create one.
        const defaultUsername = email?.split('@')[0] || 'User';
        const baseProfile = {
            id: userId,
            username: defaultUsername,
            role: 'user',
            avatar_url: null,
        };

        // STRATEGY: Try inserting WITH email first. 
        // If it fails (likely because column doesn't exist), retry WITHOUT email.
        
        let createdUser = null;

        // 1. Attempt with Email
        if (email) {
            const { data: withEmailData, error: withEmailError } = await supabase
                .from('profiles')
                .insert([{ ...baseProfile, email }])
                .select()
                .single();
            
            if (!withEmailError) {
                createdUser = withEmailData;
            }
        }

        // 2. Retry without Email if first attempt failed or was skipped
        if (!createdUser) {
             const { data: noEmailData, error: noEmailError } = await supabase
                .from('profiles')
                .insert([baseProfile])
                .select()
                .single();
            
             if (noEmailError) {
                 console.error("Critical: Failed to create profile", noEmailError);
             } else {
                 createdUser = noEmailData;
             }
        }

        if (createdUser) {
            setProfile({ ...createdUser, email }); // Keep email in local state regardless
        }

      } else if (data) {
        // Profile exists. 
        // Attempt to sync email if it's missing in DB but available in session.
        if (email && data.email !== email) {
             supabase.from('profiles')
                .update({ email })
                .eq('id', userId)
                .then(({ error }) => {
                    if (error) { /* Ignore benign error */ }
                });
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

    // 1. Initial Session Check (Non-blocking for instant start)
    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await (supabase.auth as any).getSession();
        
        if (mounted) {
          if (initialSession) {
             setSession(initialSession);
             initialUserId.current = initialSession.user.id;
             // Fire and forget profile fetch
             fetchProfile(initialSession.user.id, initialSession.user.email);
          }
        }
      } catch (error) {
        console.error("Auth init error:", error);
      } finally {
        if (mounted) {
            setLoading(false);
            // Extended initialization window to account for slow devices/network
            // and delayed auth state events
            setTimeout(() => {
                isInitializing.current = false;
            }, 2500);
        }
      }
    };

    initAuth();

    // 2. Listen for Auth Changes (Explicit Login Flow)
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(async (event: string, newSession: any) => {
      if (!mounted) return;

      setSession(newSession);
      
      if (newSession) {
        const isSameUser = initialUserId.current === newSession.user.id;
        
        // "Login/Signup > Sync > Home" Logic:
        // Only block UI if:
        // 1. It is a SIGNED_IN event
        // 2. We are not initializing (page refresh)
        // 3. It is a DIFFERENT user than initialized (to avoid race conditions)
        
        const isExplicitLogin = event === 'SIGNED_IN' && !isInitializing.current && !isSameUser;

        if (isExplicitLogin) {
             setLoading(true); 
             
             // Update initialUserId to current to prevent subsequent triggers
             initialUserId.current = newSession.user.id;

             // Add a safety timeout so user never gets stuck on sync screen
             const safetyTimer = setTimeout(() => {
                 if (mounted && loading) setLoading(false);
             }, 8000); 

             await fetchProfile(newSession.user.id, newSession.user.email); 
             
             clearTimeout(safetyTimer);
             if (mounted) setLoading(false); 
        } else {
             // For refresh or token updates, just sync in background
             // Don't re-fetch if we just did it in initAuth for the same user
             if (!isInitializing.current || !isSameUser) {
                fetchProfile(newSession.user.id, newSession.user.email);
             }
        }
      } else {
        setProfile(null);
        setLoading(false);
        initialUserId.current = null;
      }
    });

    return () => {
      mounted = false;
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
    initialUserId.current = null;
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
