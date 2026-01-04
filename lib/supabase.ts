
import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://ytnsfgdiqktetpfmuool.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bnNmZ2RpcWt0ZXRwZm11b29sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MTkwNTcsImV4cCI6MjA4MzA5NTA1N30.2NoZw4zorHw6pvCfg_8rGvDRL07QD2if2_X_yCJn5FQ';
export const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bnNmZ2RpcWt0ZXRwZm11b29sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzUxOTA1NywiZXhwIjoyMDgzMDk1MDU3fQ.pLnFaV9yRY4Ex6W196HCoE2jjJYzjJs2A2BKm0pWovM';

// Main client for user authentication and standard RLS interactions
// We set a specific storage key to prevent conflicts with other instances or defaults
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'genai-studio-auth'
  }
});

// Admin client using Service Role Key
// Completely disabled persistence and session URL detection to avoid conflicts with the main client
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});
