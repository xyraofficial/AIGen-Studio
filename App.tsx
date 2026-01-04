
import React, { useState, useEffect } from 'react';
import { MessageSquare, Hammer, LayoutGrid, BarChart3, Shield, LogOut, Settings, User } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import BuilderInterface from './components/BuilderInterface';
import ModelSelector from './components/ModelSelector';
import AnalyticsPanel from './components/AnalyticsPanel';
import LoginPage from './components/LoginPage'; // Imported LoginPage
import LoadingScreen from './components/LoadingScreen'; // Imported LoadingScreen
import ProfileModal from './components/ProfileModal';
import AdminPanel from './components/AdminPanel';
import { AppMode } from './types';
import { DEFAULT_MODEL } from './constants';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const AppContent: React.FC = () => {
  const { session, profile, loading: authLoading, isAdmin, signOut } = useAuth();
  const [activeMode, setActiveMode] = useState<AppMode>(AppMode.CHAT);
  const [selectedModelId, setSelectedModelId] = useState<string>(DEFAULT_MODEL);
  
  // Modals
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  // Global State for Analytics
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);

  // Mock metrics
  const [metrics, setMetrics] = useState({
    latency: null as number | null,
    tokenCount: 1240,
    tps: 0,
    totalExchanges: 4
  });
  
  // Reset avatar error when profile changes
  useEffect(() => {
    setAvatarError(false);
  }, [profile?.avatar_url]);

  useEffect(() => {
    let interval: any;
    if (isGenerating) {
        interval = setInterval(() => {
            setMetrics(m => ({
                ...m,
                tps: Math.floor(Math.random() * (65 - 35) + 35),
                tokenCount: m.tokenCount + 4
            }));
        }, 100);
    } else {
        setMetrics(m => ({ ...m, tps: 0 }));
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  // --- AUTH GATING FLOW ---
  // 1. Loading State
  if (authLoading) {
      return <LoadingScreen />;
  }

  // 2. Not Authenticated -> Login Page
  if (!session) {
      return <LoginPage />;
  }

  // 3. Authenticated -> Main App
  return (
    <div className="h-[100dvh] bg-[#06090f] text-white font-sans flex flex-col overflow-hidden selection:bg-purple-500/30 animate-fade-in">
      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
      {isAdmin && <AdminPanel isOpen={showAdminPanel} onClose={() => setShowAdminPanel(false)} />}

      {/* Header */}
      <header className="h-16 border-b border-gray-800 bg-[#0d1117] shrink-0 z-50 shadow-sm relative">
        <div className="max-w-[1920px] mx-auto px-4 lg:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <LayoutGrid size={20} className="text-white" />
            </div>
            <div>
                <h1 className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
                GenAI Studio
                </h1>
                <div className="text-[10px] text-gray-500 font-mono tracking-widest uppercase leading-none">Powered by Gemini</div>
            </div>
          </div>

          <div className="flex items-center gap-4 lg:gap-6">
             <div className="hidden md:block h-5 w-px bg-gray-800"></div>
             <ModelSelector 
                selectedModelId={selectedModelId} 
                onSelectModel={setSelectedModelId} 
             />
             
             {/* User Section - Always present now since we gate login */}
             <div className="relative">
                <button 
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 hover:bg-gray-800 rounded-full pl-1 pr-3 py-1 transition-colors border border-transparent hover:border-gray-700"
                >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 p-[1px]">
                        <div className="w-full h-full rounded-full bg-[#0d1117] overflow-hidden flex items-center justify-center">
                            {profile?.avatar_url && !avatarError ? (
                                <img 
                                    src={profile.avatar_url} 
                                    alt="Profile" 
                                    className="w-full h-full object-cover" 
                                    onError={() => setAvatarError(true)}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">
                                    {profile?.username?.[0]?.toUpperCase() || <User size={14} />}
                                </div>
                            )}
                        </div>
                    </div>
                    <span className="text-xs font-medium text-gray-300 hidden sm:block max-w-[80px] truncate">{profile?.username}</span>
                </button>

                {showUserMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div>
                        <div className="absolute right-0 top-full mt-2 w-48 bg-[#161b22] border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden py-1 animate-fade-in">
                            <div className="px-4 py-3 border-b border-gray-700/50">
                                <p className="text-sm font-semibold text-white truncate">{profile?.username}</p>
                                <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                                {isAdmin && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded mt-1 inline-block">ADMIN</span>}
                            </div>
                            <button onClick={() => { setShowProfileModal(true); setShowUserMenu(false); }} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-[#30363d] flex items-center gap-2">
                                <Settings size={14} /> Settings
                            </button>
                            {isAdmin && (
                                <button onClick={() => { setShowAdminPanel(true); setShowUserMenu(false); }} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-[#30363d] flex items-center gap-2">
                                    <Shield size={14} /> Admin Panel
                                </button>
                            )}
                            <div className="border-t border-gray-700/50 my-1"></div>
                            <button onClick={() => { signOut(); setShowUserMenu(false); }} className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-[#30363d] flex items-center gap-2">
                                <LogOut size={14} /> Sign Out
                            </button>
                        </div>
                    </>
                )}
             </div>

             {/* Desktop Analytics Toggle */}
             <button 
                onClick={() => setShowAnalytics(!showAnalytics)}
                className={`hidden xl:flex items-center gap-2 px-3 py-2 rounded-md border transition-all ${
                    showAnalytics 
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
                    : 'bg-[#161b22] border-gray-700 text-gray-400 hover:text-white'
                }`}
                title="Toggle Neural Analytics"
             >
                <BarChart3 size={16} />
             </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1920px] mx-auto w-full p-2 md:p-4 lg:p-6 flex gap-6 overflow-hidden">
        
        {/* Left/Center Column: Interaction Area */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 h-full">
            
            {/* Mode Switcher Tabs */}
            <div className="flex p-1 bg-[#161b22] rounded-lg border border-gray-800 w-full md:w-fit shrink-0">
                <button
                    onClick={() => setActiveMode(AppMode.CHAT)}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-md text-sm font-medium transition-all ${
                        activeMode === AppMode.CHAT
                        ? 'bg-[#21262d] text-white border border-gray-700 shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-[#21262d]/50'
                    }`}
                >
                    <MessageSquare size={16} />
                    AI Chat
                </button>
                <button
                    onClick={() => setActiveMode(AppMode.BUILDER)}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-md text-sm font-medium transition-all ${
                        activeMode === AppMode.BUILDER
                        ? 'bg-[#21262d] text-white border border-gray-700 shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-[#21262d]/50'
                    }`}
                >
                    <Hammer size={16} />
                    Script Builder
                </button>
            </div>

            {/* View Container */}
            <div className="flex-1 min-h-0 relative bg-[#0d1117] rounded-xl border border-gray-800 shadow-xl overflow-hidden">
                <div className={`h-full w-full ${activeMode === AppMode.CHAT ? 'block' : 'hidden'}`}>
                    <ChatInterface 
                        modelId={selectedModelId} 
                        onStateChange={setIsGenerating}
                    />
                </div>
                <div className={`h-full w-full ${activeMode === AppMode.BUILDER ? 'block' : 'hidden'}`}>
                    <BuilderInterface 
                        modelId={selectedModelId} 
                        onStateChange={setIsGenerating}
                    />
                </div>
            </div>
        </div>

        {/* Right Column: Analytics Panel (Desktop Only) */}
        <div className={`hidden xl:flex flex-col w-[320px] shrink-0 transition-all duration-300 ${showAnalytics ? 'translate-x-0 opacity-100' : 'translate-x-[20px] opacity-0 w-0 overflow-hidden'}`}>
            <div className="h-full rounded-xl border border-gray-800 bg-[#0d1117] overflow-hidden shadow-xl">
                 <AnalyticsPanel isGenerating={isGenerating} metrics={metrics} />
            </div>
        </div>

      </main>
    </div>
  );
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
};

export default App;
