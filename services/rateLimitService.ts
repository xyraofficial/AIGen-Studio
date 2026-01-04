
import { supabase } from '../lib/supabase';
import { UserRole } from '../types';

// RATE LIMIT CONFIGURATION
// With 4 keys rotation, we can handle significantly more load.
// Single Gemini Free Key ~ 15 RPM. 
// 4 Keys ~ 60 RPM Global Capacity.

const TIME_WINDOW_MINUTES = 1; 

const GLOBAL_LIMIT = 60; // Max 60 requests per minute globally (Utilization of 4 keys)
export const USER_LIMIT = 20;   // Max 20 requests per minute per user (Comfortable chatting speed)

export const checkRateLimits = async (userId: string, role: UserRole): Promise<{ allowed: boolean; reason?: string }> => {
  const timeWindowStart = new Date(Date.now() - TIME_WINDOW_MINUTES * 60 * 1000).toISOString();

  // 1. Check Admin (Unlimited)
  if (role === 'admin') {
    return { allowed: true };
  }

  // 2. Check Global Limit (System Health)
  const { count: globalCount, error: globalError } = await supabase
    .from('chat_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', timeWindowStart);

  if (!globalError && (globalCount || 0) >= GLOBAL_LIMIT) {
    return { allowed: false, reason: `Server busy (High Traffic). Please try again in ${TIME_WINDOW_MINUTES} minute.` };
  }

  // 3. Check User Limit (Personal Quota)
  const { count: userCount, error: userError } = await supabase
    .from('chat_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', timeWindowStart);

  if (!userError && (userCount || 0) >= USER_LIMIT) {
    return { allowed: false, reason: `You're chatting too fast! Limit: ${USER_LIMIT} messages per minute.` };
  }

  return { allowed: true };
};

export const logRequest = async (userId: string) => {
  // Fire and forget log insertion
  supabase.from('chat_logs').insert([{ user_id: userId }]).then(({ error }) => {
      if (error) console.error("Failed to log request:", error);
  });
};

export const getUsageStats = async (userId: string) => {
    const timeWindowStart = new Date(Date.now() - TIME_WINDOW_MINUTES * 60 * 1000).toISOString();
    
    const { count } = await supabase
    .from('chat_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', timeWindowStart);

    return count || 0;
}
