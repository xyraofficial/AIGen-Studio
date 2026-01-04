
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Loader2, Camera, Save, User, ShieldAlert } from 'lucide-react';
import { UserProfile } from '../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { profile, refreshProfile, session } = useAuth();
  
  // Memoize effective profile to prevent object reference instability during renders
  const effectiveProfile = useMemo(() => {
      if (profile) return profile;
      
      if (session?.user) {
         // Fallback profile if DB data isn't loaded yet
         const fallback: UserProfile = {
            id: session.user.id,
            username: session.user.email?.split('@')[0] || 'User',
            role: 'user',
            avatar_url: null,
            email: session.user.email
         };
         return fallback;
      }
      return null;
  }, [profile, session]);
  
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen && effectiveProfile) {
        setImageError(false);
        setErrorMessage(null);
        setUsername(effectiveProfile.username || effectiveProfile.email?.split('@')[0] || '');
    }
  }, [isOpen, effectiveProfile?.id, effectiveProfile?.username, effectiveProfile?.email]);

  if (!isOpen || !effectiveProfile) return null;

  const handleUpdate = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // 1. Update Core Profile (Username)
      // We exclude 'email' from this main call to ensure username updates work 
      // even if the 'email' column is missing in the database schema.
      const { error } = await supabase
        .from('profiles')
        .upsert({
            id: effectiveProfile.id,
            username,
            avatar_url: effectiveProfile.avatar_url // Preserve existing avatar
        })
        .select();

      if (error) throw error;

      // 2. Attempt to Sync Email (Best Effort)
      // We try this separately. If it fails (e.g. column missing), we just log it
      // so the user experience isn't broken.
      if (effectiveProfile.email) {
          const { error: emailError } = await supabase
            .from('profiles')
            .update({ email: effectiveProfile.email })
            .eq('id', effectiveProfile.id);
          
          if (emailError) {
              console.warn("Note: Email sync skipped (Database column might be missing):", emailError.message);
          }
      }

      await refreshProfile();
      onClose();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setErrorMessage(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setErrorMessage(null);
      setUploading(true);
      
      if (!event.target.files || event.target.files.length === 0) {
        setUploading(false);
        return;
      }

      const file = event.target.files[0];
      
      // Basic validation
      if (file.size > 5 * 1024 * 1024) {
          throw new Error("File is too large. Max size is 5MB.");
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${effectiveProfile.id}/${fileName}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
          console.error("Supabase Storage Upload Error:", uploadError);
          
          // Safe error message extraction
          const rawMsg = (uploadError as any).message || (uploadError as any).error_description || JSON.stringify(uploadError);

          if (rawMsg.includes("Bucket not found") || (uploadError as any).statusCode === '404') {
              throw new Error("Storage bucket 'avatars' is missing. Please create a public bucket named 'avatars' in your Supabase dashboard.");
          }
          
          if (rawMsg.includes("row-level security") || rawMsg.includes("violates row-level security")) {
               throw new Error("Permission denied. Please add 'INSERT' & 'SELECT' Policies for Authenticated Users to the 'avatars' bucket.");
          }
          
          if (rawMsg.includes("EntityTooLarge") || rawMsg.includes("too large")) {
              throw new Error("Image too large. Please upload a smaller file.");
          }

          throw new Error(typeof rawMsg === 'string' ? rawMsg : "Upload failed.");
      }

      // 2. Get Public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      // 3. Update Profile in DB (Safely)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', effectiveProfile.id);

      if (updateError) throw updateError;
      
      // 4. Sync UI
      await refreshProfile();
      setImageError(false);
      
    } catch (error: any) {
      console.error("Upload error details:", error);
      // Ensure errorMessage is always a string
      const displayMsg = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error));
      setErrorMessage(displayMsg.replace(/^Error:\s*/, ''));
    } finally {
      setUploading(false);
      if (event.target) event.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#161b22] border border-gray-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
          <X size={20} />
        </button>

        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-6">Edit Profile</h2>

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-red-400 text-xs">
              <ShieldAlert size={14} className="shrink-0 mt-0.5" />
              <span className="flex-1 break-words">{errorMessage}</span>
            </div>
          )}

          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-800 border-2 border-gray-700 flex items-center justify-center relative">
                {effectiveProfile.avatar_url && !imageError ? (
                  <img 
                    src={effectiveProfile.avatar_url} 
                    alt="Avatar" 
                    className="w-full h-full object-cover" 
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800">
                    <User size={32} className="text-gray-500" />
                  </div>
                )}
                
                {uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                        <Loader2 size={24} className="text-white animate-spin" />
                    </div>
                )}
              </div>
              
              <label className={`absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full ${uploading ? 'pointer-events-none' : ''}`}>
                <Camera size={24} className="text-white" />
                <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={uploadAvatar}
                    disabled={uploading}
                />
              </label>
            </div>
            <div className="text-center">
                <div className="text-sm font-medium text-gray-200">{effectiveProfile.email}</div>
                <div className="text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full inline-block mt-1 uppercase tracking-wide border border-blue-400/20">{effectiveProfile.role}</div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#0d1117] border border-gray-700 rounded-lg py-2 px-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none text-sm"
              />
            </div>

            <button
              onClick={handleUpdate}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
