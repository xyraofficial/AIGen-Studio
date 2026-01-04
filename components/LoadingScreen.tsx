
import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#06090f] flex flex-col items-center justify-center text-white relative overflow-hidden">
        {/* Abstract Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,6px_100%] pointer-events-none opacity-20"></div>

        <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-[#0d1117] border border-gray-800 flex items-center justify-center shadow-2xl relative z-10">
                    <Loader2 size={32} className="text-blue-500 animate-spin" />
                </div>
                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse"></div>
            </div>
            
            <div className="flex flex-col items-center gap-2">
                <h2 className="text-lg font-bold tracking-widest uppercase text-gray-200">Initializing Studio</h2>
                <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce"></span>
                </div>
            </div>
        </div>
    </div>
  );
};

export default LoadingScreen;
