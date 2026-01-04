
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'signup' | 'reset';

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'signup') {
        const { error } = await (supabase.auth as any).signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage('Check your email for the confirmation link!');
      } else if (mode === 'login') {
        const { error } = await (supabase.auth as any).signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onClose();
      } else if (mode === 'reset') {
        const { error } = await (supabase.auth as any).resetPasswordForEmail(email);
        if (error) throw error;
        setMessage('Check your email for the password reset link.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative animate-fade-in">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
          <X size={20} />
        </button>

        <div className="p-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            {mode === 'login' && 'Welcome Back'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'reset' && 'Reset Password'}
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            {mode === 'login' && 'Enter your details to access your AI workspace.'}
            {mode === 'signup' && 'Join GenAI Studio to start building.'}
            {mode === 'reset' && 'Enter your email to receive recovery instructions.'}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-all shadow-lg hover:shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {mode === 'login' && 'Sign In'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'reset' && 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-2 text-center text-sm">
            {mode === 'login' ? (
              <>
                <p className="text-gray-500">
                  Don't have an account?{' '}
                  <button onClick={() => setMode('signup')} className="text-blue-400 hover:text-blue-300 transition-colors">Sign up</button>
                </p>
                <button onClick={() => setMode('reset')} className="text-gray-600 hover:text-gray-400 text-xs">Forgot password?</button>
              </>
            ) : mode === 'signup' ? (
              <p className="text-gray-500">
                Already have an account?{' '}
                <button onClick={() => setMode('login')} className="text-blue-400 hover:text-blue-300 transition-colors">Sign in</button>
              </p>
            ) : (
              <button onClick={() => setMode('login')} className="text-blue-400 hover:text-blue-300 transition-colors">Back to Login</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
