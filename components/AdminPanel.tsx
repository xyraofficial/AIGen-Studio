import React, { useEffect, useState } from 'react';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { X, Shield, Users, Activity, Search, Edit2, Trash2, Check, Loader2, AlertCircle, Database, Copy, Lock, Unlock, Settings, Terminal, ShieldCheck } from 'lucide-react';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
  const { session } = useAuth(); // Access current session
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempRole, setTempRole] = useState<'user' | 'admin'>('user');
  const [actionLoading, setActionLoading] = useState<string | null>(null); // Stores ID of item being processed
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Configuration Modal State
  const [showConfig, setShowConfig] = useState(false);

  // DB Health State
  const [missingEmailColumn, setMissingEmailColumn] = useState(false);

  useEffect(() => {
    if (isOpen) {
        fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    setMissingEmailColumn(false);

    // Fetch users
    const { data: profiles, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    
    if (error) {
        console.error("Error fetching profiles:", error);
    }

    if (profiles) {
        setUsers(profiles as UserProfile[]);
        
        // Health Check
        if (profiles.length > 0) {
            const { error: colError } = await supabase.from('profiles').select('email').limit(1);
            if (colError && colError.code === '42703') { // Undefined column error code in Postgres
                setMissingEmailColumn(true);
            }
        }
    }

    // Fetch total activity count (last 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
        .from('chat_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday);
    
    setTotalLogs(count || 0);
    setLoading(false);
  };

  const startEdit = (user: UserProfile) => {
    setEditingId(user.id);
    setTempRole(user.role);
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveRole = async (userId: string) => {
    setActionLoading(userId);
    try {
        // Use Admin Client to bypass RLS for role updates
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update({ role: tempRole })
            .eq('id', userId)
            .select();

        if (error) throw error;

        // If no data returned, something weird happened
        if (!data || data.length === 0) {
            alert("Update returned no data. Check database permissions.");
            return;
        }

        // Update local state
        setUsers(users.map(u => u.id === userId ? { ...u, role: tempRole } : u));
        setEditingId(null);
    } catch (error: any) {
        console.error("Error updating role:", error);
        alert(`Failed to update role: ${error.message}`);
    } finally {
        setActionLoading(null);
    }
  };

  // Step 1: Request Delete
  const requestDelete = (userId: string) => {
      setConfirmDeleteId(userId);
      setEditingId(null); // Close edit mode if open
  };

  const cancelDelete = () => {
      setConfirmDeleteId(null);
  };

  // Step 2: Execute Delete
  const executeDelete = async (userId: string) => {
      setActionLoading(userId);
      try {
         // --- SUPER ADMIN DELETE (FULL WIPE) ---
         // 1. Delete Auth User (This is what removes the login)
         const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
         
         if (authError) {
             console.error("Auth delete error:", authError);
             throw new Error(`Auth Delete Failed: ${authError.message}`);
         }

         // 2. Delete Data (Bypass RLS)
         // We do this just in case cascading didn't work, to be sure.
         await supabaseAdmin.from('chat_logs').delete().eq('user_id', userId);
         await supabaseAdmin.from('profiles').delete().eq('id', userId);

         // Success
         setUsers(users.filter(u => u.id !== userId));
         setConfirmDeleteId(null);

      } catch (error: any) {
          console.error("Error deleting user:", error);
          alert(`Failed to delete user: ${error.message}.`);
      } finally {
          setActionLoading(null);
      }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("Code copied to clipboard!");
  };

  const sqlContent = `-- 1. Enable Cascading Deletes
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey,
ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id)
    REFERENCES auth.users (id)
    ON DELETE CASCADE;`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-fade-in">
      
      {/* Configuration Modal Overlay */}
      {showConfig && (
          <div className="absolute inset-0 z-[110] bg-black/90 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-[#0d1117] border border-gray-700 rounded-xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl">
                  <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#161b22]">
                      <div className="flex items-center gap-2">
                          <Settings className="text-purple-400" size={20} />
                          <h3 className="font-bold text-gray-200">Backend Setup Guide</h3>
                      </div>
                      <button onClick={() => setShowConfig(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      <div>
                          <div className="flex items-center justify-between mb-2">
                             <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2"><Database size={14}/> SQL Setup</h4>
                             <button onClick={() => copyToClipboard(sqlContent)} className="text-xs flex items-center gap-1 text-gray-500 hover:text-white"><Copy size={12}/> Copy SQL</button>
                          </div>
                          <div className="bg-black/50 border border-gray-800 rounded-lg p-3 overflow-x-auto">
                              <pre className="text-[10px] sm:text-xs text-green-400 font-mono whitespace-pre">{sqlContent}</pre>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Main Admin Container */}
      <div className="bg-[#0d1117] border-t sm:border border-gray-700 rounded-t-xl sm:rounded-xl w-full sm:max-w-5xl h-[100dvh] sm:h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in relative">
        
        {/* Header */}
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800 bg-[#161b22] flex items-center justify-between shrink-0 z-30">
            <div className="flex items-center gap-3">
                <Shield className="text-red-400" size={20} />
                <h2 className="text-lg font-bold text-gray-200">Admin Panel</h2>
                <span className="flex items-center gap-1 text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20 font-mono uppercase">
                     <ShieldCheck size={10} /> Super Admin
                </span>
            </div>
            <div className="flex items-center gap-2">
                
                <button 
                    onClick={() => setShowConfig(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 text-xs font-medium transition-colors"
                >
                    <Settings size={14} />
                    <span className="hidden sm:inline">Backend</span>
                </button>
                <div className="w-px h-4 bg-gray-700 mx-1"></div>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"><X size={24} /></button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0d1117] relative">
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b border-gray-800 bg-[#0d1117]">
                <div className="bg-[#161b22] p-3 rounded-lg border border-gray-800">
                    <div className="text-gray-500 text-[10px] md:text-xs font-bold uppercase mb-1 flex items-center gap-2">
                        <Users size={12} /> Total Users
                    </div>
                    <div className="text-lg md:text-2xl font-bold text-white">{users.length}</div>
                </div>
                <div className="bg-[#161b22] p-3 rounded-lg border border-gray-800">
                    <div className="text-gray-500 text-[10px] md:text-xs font-bold uppercase mb-1 flex items-center gap-2">
                        <Activity size={12} /> 24h Requests
                    </div>
                    <div className="text-lg md:text-2xl font-bold text-blue-400">{totalLogs}</div>
                </div>
                 <div className="bg-[#161b22] p-3 rounded-lg border border-gray-800">
                    <div className="text-gray-500 text-[10px] md:text-xs font-bold uppercase mb-1">Global Limit</div>
                    <div className="text-lg md:text-2xl font-bold text-green-400">60 <span className="text-xs text-gray-500 font-normal">/ 10m</span></div>
                </div>
                 <div className="bg-[#161b22] p-3 rounded-lg border border-gray-800">
                    <div className="text-gray-500 text-[10px] md:text-xs font-bold uppercase mb-1">Mode</div>
                    <div className={`text-xs md:text-sm font-bold px-2 py-1 rounded inline-block whitespace-nowrap text-yellow-400 bg-yellow-900/20`}>
                        Super Admin
                    </div>
                </div>
            </div>

            {/* Content Body */}
            <div className="p-3 sm:p-6 pb-20 sm:pb-6">
                
                {/* Missing Column Warning */}
                {missingEmailColumn && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex flex-col sm:flex-row gap-4 animate-fade-in">
                        <div className="p-2 bg-red-500/20 rounded-full h-fit w-fit shrink-0">
                            <Database className="text-red-400" size={20} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-white mb-1">Missing Database Column: email</h3>
                            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                                The <code>email</code> column is missing from your <code>profiles</code> table. 
                                User emails cannot be saved or displayed until this is fixed.
                            </p>
                            <div className="bg-black/50 rounded-md border border-red-500/20 p-3 flex items-center justify-between gap-3 group">
                                <code className="text-[10px] sm:text-xs font-mono text-red-300 break-all">
                                    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
                                </code>
                                <button 
                                    onClick={() => copyToClipboard("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;")}
                                    className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
                                    title="Copy SQL"
                                >
                                    <Copy size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Search Bar */}
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="text-white font-semibold hidden sm:block">User Database</h3>
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                        <input type="text" placeholder="Search users..." className="bg-[#161b22] border border-gray-700 rounded-md py-2 pl-9 pr-3 text-xs text-gray-300 focus:border-blue-500 outline-none w-full sm:w-64" />
                    </div>
                </div>

                {/* Table - FIXED LAYOUT (Prevents overflow) */}
                <div className="border border-gray-800 rounded-lg overflow-hidden bg-[#161b22]">
                    <table className="w-full text-left border-collapse table-fixed">
                        {/* Sticky Header */}
                        <thead className="sticky top-0 z-20 shadow-md">
                            <tr className="border-b border-gray-800 bg-[#161b22] text-gray-500 text-xs uppercase shadow-sm">
                                {/* User takes remaining space */}
                                <th className="py-3 px-2 sm:px-4 font-medium bg-[#161b22] w-auto">User</th>
                                {/* Role fixed width */}
                                <th className="py-3 px-1 sm:px-4 font-medium bg-[#161b22] w-[75px] sm:w-[120px] text-center sm:text-left">Role</th>
                                {/* Hidden on mobile */}
                                <th className="py-3 px-4 font-medium bg-[#161b22] hidden md:table-cell w-[120px]">Joined</th>
                                {/* Action fixed width - Increased for delete confirm */}
                                <th className="py-3 px-2 sm:px-4 font-medium text-right bg-[#161b22] w-[120px]">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-gray-300 bg-[#0d1117]">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-gray-500">
                                        <Loader2 className="mx-auto animate-spin mb-2" size={24} />
                                        Loading users...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-gray-500">No users found.</td>
                                </tr>
                            ) : (
                                users.map(u => {
                                    const displayEmail = (u.id === session?.user.id ? session.user.email : u.email) || null;
                                    const isEditing = editingId === u.id;
                                    const isDeleting = confirmDeleteId === u.id;
                                    const isLoadingAction = actionLoading === u.id;

                                    return (
                                    <tr key={u.id} className="border-b border-gray-800/50 hover:bg-[#161b22]/50 transition-colors group">
                                        
                                        {/* USER INFO */}
                                        <td className="py-3 px-2 sm:px-4">
                                            <div className="flex items-center gap-2 sm:gap-3">
                                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-700 overflow-hidden shrink-0 border border-gray-600">
                                                    {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">{u.username?.[0]?.toUpperCase()}</div>}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium text-white truncate text-xs sm:text-sm">{u.username}</div>
                                                    
                                                    {displayEmail ? (
                                                        <div className="text-[10px] sm:text-xs text-gray-500 truncate select-all" title={displayEmail}>
                                                            {displayEmail}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col mt-0.5">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[10px] text-gray-600 italic">No email recorded</span>
                                                                {!missingEmailColumn && (
                                                                    <div className="group relative">
                                                                        <AlertCircle size={10} className="text-gray-700 cursor-help" />
                                                                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-48 bg-black border border-gray-700 p-2 rounded text-[10px] text-gray-300 hidden group-hover:block z-50">
                                                                            Email data missing. User might need to login again to sync.
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {missingEmailColumn && (
                                                                <span className="text-[9px] text-red-400/80 font-mono mt-0.5 flex items-center gap-1">
                                                                    <Terminal size={8} /> DB Schema Error
                                                                </span>
                                                            )}
                                                            <span className="text-[9px] text-gray-700 font-mono truncate" title={`UID: ${u.id}`}>ID: {u.id.substring(0,8)}...</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* ROLE */}
                                        <td className="py-3 px-1 sm:px-4 text-center sm:text-left">
                                            {isEditing ? (
                                                <select 
                                                    value={tempRole}
                                                    onChange={(e) => setTempRole(e.target.value as 'user' | 'admin')}
                                                    className="w-full bg-[#0d1117] border border-gray-700 text-white text-[10px] sm:text-xs rounded px-1 py-1 outline-none focus:border-blue-500"
                                                    disabled={isLoadingAction}
                                                >
                                                    <option value="user">User</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                            ) : (
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium border uppercase tracking-wider block w-fit sm:inline mx-auto sm:mx-0 ${u.role === 'admin' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                                    {u.role}
                                                </span>
                                            )}
                                        </td>

                                        {/* JOINED */}
                                        <td className="py-3 px-4 text-gray-500 font-mono text-xs hidden md:table-cell">
                                            {new Date().toLocaleDateString()}
                                        </td>

                                        {/* ACTION AREA */}
                                        <td className="py-3 px-2 sm:px-4 text-right">
                                            {isDeleting ? (
                                                // CONFIRMATION UI
                                                <div className="flex items-center justify-end gap-2 animate-fade-in">
                                                    <span className="text-[10px] font-bold hidden sm:inline text-red-400">
                                                        Wipe User?
                                                    </span>
                                                    <button 
                                                        onClick={() => executeDelete(u.id)}
                                                        disabled={isLoadingAction}
                                                        className={`p-1.5 rounded border transition-all bg-red-600 hover:bg-red-500 text-white border-red-500`}
                                                        title="Confirm Delete"
                                                    >
                                                        {isLoadingAction ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                    </button>
                                                    <button 
                                                        onClick={cancelDelete}
                                                        disabled={isLoadingAction}
                                                        className="p-1.5 bg-gray-800 text-gray-400 hover:text-white rounded border border-gray-700 transition-all"
                                                        title="Cancel"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : isEditing ? (
                                                // EDIT UI
                                                <div className="flex items-center justify-end gap-1 sm:gap-2">
                                                    <button 
                                                        onClick={() => saveRole(u.id)}
                                                        disabled={isLoadingAction}
                                                        className="p-1.5 text-green-400 hover:bg-green-400/10 rounded transition-all"
                                                    >
                                                        {isLoadingAction ? <Loader2 size={14} className="animate-spin"/> : <Check size={14} />}
                                                    </button>
                                                    <button 
                                                        onClick={cancelEdit}
                                                        disabled={isLoadingAction}
                                                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-all"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                // DEFAULT ACTION UI
                                                <div className="flex items-center justify-end gap-1 sm:gap-2">
                                                    <button 
                                                        onClick={() => startEdit(u)}
                                                        className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded opacity-60 hover:opacity-100 transition-all"
                                                        title="Edit Role"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    
                                                    {/* Delete Button Container with Tooltip info */}
                                                    <div className="relative group/tip">
                                                        <button 
                                                            onClick={() => requestDelete(u.id)}
                                                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded opacity-60 hover:opacity-100 transition-all"
                                                            title="Delete User"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )})
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;