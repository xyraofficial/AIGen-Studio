import React, { useEffect, useState } from 'react';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getGlobalUsageStats, getActivityLogs, GLOBAL_LIMIT } from '../services/rateLimitService';
import { getKeyStatus } from '../services/geminiService';
import { X, Shield, Users, Activity, Search, Edit2, Trash2, Check, Loader2, AlertCircle, Database, Copy, Settings, Terminal, ShieldCheck, Zap, BarChart3, RefreshCw, Server, List, Key } from 'lucide-react';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'overview' | 'api_health' | 'live_logs';

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [refreshing, setRefreshing] = useState(false);

  // DATA STATES
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [keyStatus, setKeyStatus] = useState<any[]>([]);
  
  // STATS STATES
  const [totalLogs, setTotalLogs] = useState(0);
  const [globalUsage, setGlobalUsage] = useState(0);
  const [loading, setLoading] = useState(true);

  // EDIT STATE
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempRole, setTempRole] = useState<'user' | 'admin'>('user');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // UTILS
  const [showConfig, setShowConfig] = useState(false);
  const [missingEmailColumn, setMissingEmailColumn] = useState(false);

  useEffect(() => {
    if (isOpen) {
        fetchData();
        const interval = setInterval(refreshStats, 5000); // Faster refresh for monitoring
        return () => clearInterval(interval);
    }
  }, [isOpen]);

  const refreshStats = async () => {
      setRefreshing(true);
      
      // 1. Global Rate Limit
      const currentUsage = await getGlobalUsageStats();
      setGlobalUsage(currentUsage);
      
      // 2. Key Status
      setKeyStatus(getKeyStatus());

      // 3. Activity Logs (Only if on logs tab to save bandwidth)
      if (activeTab === 'live_logs') {
          const recentLogs = await getActivityLogs(50);
          setLogs(recentLogs);
      }

      setRefreshing(false);
  };

  const fetchData = async () => {
    setLoading(true);
    setMissingEmailColumn(false);

    // 1. Fetch Users
    const { data: profiles, error } = await supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false });
    if (profiles) {
        setUsers(profiles as UserProfile[]);
        // DB Health Check
        const { error: colError } = await supabase.from('profiles').select('email').limit(1);
        if (colError && colError.code === '42703') setMissingEmailColumn(true);
    }

    // 2. Fetch Total Activity Count (24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase.from('chat_logs').select('*', { count: 'exact', head: true }).gte('created_at', yesterday);
    setTotalLogs(count || 0);

    // 3. Initial Stats
    await refreshStats();
    
    setLoading(false);
  };

  // --- ACTIONS ---
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
        const { error } = await supabaseAdmin.from('profiles').update({ role: tempRole }).eq('id', userId);
        if (error) throw error;
        setUsers(users.map(u => u.id === userId ? { ...u, role: tempRole } : u));
        setEditingId(null);
    } catch (error: any) {
        alert(`Failed: ${error.message}`);
    } finally {
        setActionLoading(null);
    }
  };

  const executeDelete = async (userId: string) => {
      setActionLoading(userId);
      try {
         await (supabaseAdmin.auth as any).admin.deleteUser(userId);
         await supabaseAdmin.from('chat_logs').delete().eq('user_id', userId);
         await supabaseAdmin.from('profiles').delete().eq('id', userId);
         setUsers(users.filter(u => u.id !== userId));
         setConfirmDeleteId(null);
      } catch (error: any) {
          alert(`Failed: ${error.message}`);
      } finally {
          setActionLoading(null);
      }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("Copied!");
  };

  const usagePercentage = Math.min((globalUsage / GLOBAL_LIMIT) * 100, 100);
  const usageColor = usagePercentage > 80 ? 'bg-red-500' : usagePercentage > 50 ? 'bg-yellow-500' : 'bg-green-500';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-fade-in">
      
      {/* SQL Config Modal */}
      {showConfig && (
          <div className="absolute inset-0 z-[110] bg-black/90 flex items-center justify-center p-4">
              <div className="bg-[#0d1117] border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl">
                  <div className="p-4 border-b border-gray-800 flex justify-between">
                      <h3 className="font-bold text-gray-200 flex items-center gap-2"><Database size={16}/> Database Setup</h3>
                      <button onClick={() => setShowConfig(false)}><X size={20} className="text-gray-400" /></button>
                  </div>
                  <div className="p-4 bg-black/50">
                      <code className="text-xs text-green-400 font-mono">ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;</code>
                  </div>
              </div>
          </div>
      )}

      {/* Main Container */}
      <div className="bg-[#0d1117] border-t sm:border border-gray-700 rounded-t-xl sm:rounded-xl w-full sm:max-w-6xl h-[100dvh] sm:h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-gray-800 bg-[#161b22] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
                <Shield className="text-red-400" size={20} />
                <div>
                    <h2 className="text-lg font-bold text-gray-200 leading-none">Admin Command Center</h2>
                    <span className="text-[10px] text-gray-500 font-mono uppercase">Super Admin Access</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                 <button onClick={refreshStats} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
                    <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
                 </button>
                 <div className="w-px h-6 bg-gray-700 mx-2"></div>
                 <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"><X size={20} /></button>
            </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 bg-[#0d1117]">
            <button 
                onClick={() => setActiveTab('overview')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'overview' ? 'border-blue-500 text-blue-400 bg-[#161b22]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
                <Users size={14} /> User Database
            </button>
            <button 
                onClick={() => setActiveTab('api_health')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'api_health' ? 'border-purple-500 text-purple-400 bg-[#161b22]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
                <Server size={14} /> API Monitor
            </button>
            <button 
                onClick={() => setActiveTab('live_logs')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'live_logs' ? 'border-green-500 text-green-400 bg-[#161b22]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
                <List size={14} /> Live Traffic
            </button>
        </div>

        {/* TAB CONTENT AREA */}
        <div className="flex-1 overflow-hidden bg-[#0d1117] relative">
            
            {/* TAB 1: OVERVIEW (USERS) */}
            {activeTab === 'overview' && (
                <div className="h-full flex flex-col">
                     {/* Stats Bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b border-gray-800 bg-[#0d1117]">
                        <div className="bg-[#161b22] p-4 rounded-xl border border-gray-800 flex flex-col">
                            <span className="text-gray-500 text-[10px] font-bold uppercase mb-1 flex items-center gap-2"><Users size={12} /> Total Users</span>
                            <span className="text-2xl font-bold text-white">{users.length}</span>
                        </div>
                        <div className="bg-[#161b22] p-4 rounded-xl border border-gray-800 flex flex-col">
                            <span className="text-gray-500 text-[10px] font-bold uppercase mb-1 flex items-center gap-2"><Activity size={12} /> 24h Requests</span>
                            <span className="text-2xl font-bold text-blue-400">{totalLogs}</span>
                        </div>
                        <div className="bg-[#161b22] p-4 rounded-xl border border-gray-800 flex flex-col relative overflow-hidden">
                             <span className="text-gray-500 text-[10px] font-bold uppercase mb-1 flex items-center gap-2 z-10 relative"><Zap size={12} /> Global Load</span>
                             <span className="text-2xl font-bold text-white z-10 relative">{globalUsage} <span className="text-sm text-gray-500 font-normal">/ {GLOBAL_LIMIT} RPM</span></span>
                             <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-700">
                                 <div className={`h-full ${usageColor} transition-all duration-500`} style={{ width: `${usagePercentage}%` }}></div>
                             </div>
                        </div>
                        <div className="bg-[#161b22] p-4 rounded-xl border border-gray-800 flex flex-col">
                             <span className="text-gray-500 text-[10px] font-bold uppercase mb-1 flex items-center gap-2"><Database size={12} /> DB Status</span>
                             <div className="flex items-center gap-2 mt-1">
                                 <div className={`w-2 h-2 rounded-full ${missingEmailColumn ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                 <span className={`text-sm font-bold ${missingEmailColumn ? 'text-red-400' : 'text-green-400'}`}>{missingEmailColumn ? 'Schema Error' : 'Healthy'}</span>
                             </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-[#0f131a] text-gray-500 text-xs uppercase sticky top-0 z-10">
                                    <tr>
                                        <th className="py-3 px-4 font-semibold">User Identity</th>
                                        <th className="py-3 px-4 font-semibold">Access Level</th>
                                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/50">
                                    {loading ? (
                                        <tr><td colSpan={3} className="py-8 text-center text-gray-500"><Loader2 className="mx-auto animate-spin mb-2"/>Loading users...</td></tr>
                                    ) : users.map(u => (
                                        <tr key={u.id} className="hover:bg-[#1c2128] transition-colors group">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                                                        {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover"/> : u.username?.[0]}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-white">{u.username}</div>
                                                        <div className="text-xs text-gray-500 font-mono">{u.email || 'No email synced'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                {editingId === u.id ? (
                                                    <select value={tempRole} onChange={e => setTempRole(e.target.value as any)} className="bg-[#0d1117] border border-gray-700 text-xs rounded px-2 py-1 text-white">
                                                        <option value="user">User</option>
                                                        <option value="admin">Admin</option>
                                                    </select>
                                                ) : (
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${u.role === 'admin' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                                        {u.role}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {confirmDeleteId === u.id ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => executeDelete(u.id)} className="text-red-400 hover:text-red-300 bg-red-900/20 px-2 py-1 rounded text-xs">Confirm</button>
                                                        <button onClick={() => setConfirmDeleteId(null)} className="text-gray-400 hover:text-white px-2 py-1">Cancel</button>
                                                    </div>
                                                ) : editingId === u.id ? (
                                                     <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => saveRole(u.id)} className="text-green-400 hover:text-green-300"><Check size={16}/></button>
                                                        <button onClick={cancelEdit} className="text-gray-400 hover:text-white"><X size={16}/></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100">
                                                        <button onClick={() => startEdit(u)} className="p-1.5 hover:bg-gray-700 rounded text-blue-400"><Edit2 size={14}/></button>
                                                        <button onClick={() => setConfirmDeleteId(u.id)} className="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-red-400"><Trash2 size={14}/></button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: API MONITOR */}
            {activeTab === 'api_health' && (
                <div className="h-full overflow-y-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        {/* Summary Card */}
                        <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                <Server className="text-purple-400" /> Key Pool Architecture
                            </h3>
                            <p className="text-sm text-gray-400 mb-4">
                                The system utilizes a Round-Robin rotation strategy with {keyStatus.length} API keys. 
                                This distributes load to prevent single-key exhaustion and increases global RPM capacity.
                            </p>
                            <div className="flex gap-8">
                                <div>
                                    <div className="text-2xl font-bold text-white">{keyStatus.length * 15}</div>
                                    <div className="text-xs text-gray-500 uppercase font-bold">Est. Max RPM</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-green-400">{keyStatus.filter(k => k.status === 'operational').length}</div>
                                    <div className="text-xs text-gray-500 uppercase font-bold">Healthy Keys</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-yellow-400">{keyStatus.filter(k => k.status === 'limited').length}</div>
                                    <div className="text-xs text-gray-500 uppercase font-bold">Rate Limited</div>
                                </div>
                            </div>
                        </div>

                        {/* Individual Key Cards */}
                        {keyStatus.map((k) => (
                            <div key={k.index} className={`bg-[#161b22] border rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden transition-all ${k.status === 'operational' ? 'border-gray-800' : k.status === 'limited' ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-red-500/50'}`}>
                                <div className="flex justify-between items-start z-10">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-md ${k.status === 'operational' ? 'bg-green-500/10 text-green-400' : k.status === 'limited' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                                            <Key size={16} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-200">Key Slot #{k.index + 1}</div>
                                            <div className="text-xs font-mono text-gray-500">{k.key}</div>
                                        </div>
                                    </div>
                                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${k.status === 'operational' ? 'bg-green-500/10 text-green-400 border-green-500/20' : k.status === 'limited' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                        {k.status}
                                    </div>
                                </div>
                                
                                <div className="space-y-2 mt-2 z-10">
                                    <div className="flex justify-between text-xs text-gray-400">
                                        <span>Last Used:</span>
                                        <span className="text-gray-300">{k.lastUsed ? new Date(k.lastUsed).toLocaleTimeString() : 'Idle'}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-400">
                                        <span>Errors (Session):</span>
                                        <span className={k.errors > 0 ? "text-red-400" : "text-gray-300"}>{k.errors}</span>
                                    </div>
                                </div>

                                {/* Background Pulse for busy keys */}
                                {k.status === 'limited' && <div className="absolute inset-0 bg-yellow-500/5 animate-pulse z-0"></div>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 3: LIVE TRAFFIC LOGS */}
            {activeTab === 'live_logs' && (
                <div className="h-full flex flex-col">
                    <div className="p-4 bg-[#161b22] border-b border-gray-800 flex justify-between items-center">
                        <div className="text-sm text-gray-400">
                            Showing last <span className="text-white font-bold">50</span> requests. Refreshes automatically.
                        </div>
                        <button onClick={refreshStats} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded border border-gray-700">Force Refresh</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-0">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#0f131a] text-gray-500 text-xs uppercase sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="py-2 px-4 w-32">Time</th>
                                    <th className="py-2 px-4">User</th>
                                    <th className="py-2 px-4">Action</th>
                                    <th className="py-2 px-4 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50 font-mono text-xs">
                                {logs.length === 0 ? (
                                     <tr><td colSpan={4} className="py-12 text-center text-gray-500 italic">No recent traffic logs found.</td></tr>
                                ) : logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-[#1c2128]">
                                        <td className="py-2 px-4 text-gray-400">
                                            {new Date(log.created_at).toLocaleTimeString()}
                                        </td>
                                        <td className="py-2 px-4">
                                            <div className="text-blue-400">{log.user?.email || 'Unknown'}</div>
                                            <div className="text-[10px] text-gray-600">{log.user?.username}</div>
                                        </td>
                                        <td className="py-2 px-4 text-gray-300">
                                            CHAT_COMPLETION
                                        </td>
                                        <td className="py-2 px-4 text-right">
                                            <span className="text-green-400">SUCCESS</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default AdminPanel;