import React, { useEffect, useRef } from 'react';
import { Activity, Zap, Database, Clock, Server } from 'lucide-react';

interface AnalyticsPanelProps {
  isGenerating: boolean;
  metrics: {
    latency: number | null;
    tokenCount: number;
    tps: number;
    totalExchanges: number;
  };
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ isGenerating, metrics }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Neural Network Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: { x: number; y: number; vx: number; vy: number }[] = [];
    const particleCount = 40;
    
    const resize = () => {
        if (canvas.parentElement) {
            canvas.width = canvas.parentElement.offsetWidth;
            canvas.height = canvas.parentElement.offsetHeight;
        }
    };
    resize();
    window.addEventListener('resize', resize);

    // Init particles
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5
        });
    }

    let animationFrameId: number;

    const render = () => {
        ctx.fillStyle = '#0d1117'; // Match bg
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Update and draw particles
        const activeColor = '#3b82f6'; // Blue
        const idleColor = '#4b5563'; // Gray
        
        particles.forEach(p => {
            // Speed up when generating
            const speedMultiplier = isGenerating ? 3 : 0.5;
            p.x += p.vx * speedMultiplier;
            p.y += p.vy * speedMultiplier;

            // Bounce
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

            ctx.beginPath();
            ctx.arc(p.x, p.y, isGenerating ? 2 : 1.5, 0, Math.PI * 2);
            ctx.fillStyle = isGenerating ? activeColor : idleColor;
            ctx.fill();
        });

        // Draw connections
        ctx.lineWidth = 1;

        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 80) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    
                    const opacity = 1 - (dist / 80);
                    ctx.strokeStyle = isGenerating 
                        ? `rgba(59, 130, 246, ${opacity * 0.4})` 
                        : `rgba(75, 85, 99, ${opacity * 0.2})`;
                    ctx.stroke();
                }
            }
        }

        animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
        window.removeEventListener('resize', resize);
        cancelAnimationFrame(animationFrameId);
    };
  }, [isGenerating]);

  return (
    <div className="h-full flex flex-col bg-[#0f131a] text-gray-300 font-mono text-xs overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-800 bg-[#161b22] flex items-center justify-between shadow-sm flex-shrink-0">
            <div className="flex items-center gap-2">
                <Activity size={14} className="text-blue-400" />
                <span className="font-semibold tracking-wider text-gray-200">SYSTEM ANALYTICS</span>
            </div>
            <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${isGenerating ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse' : 'bg-gray-700'}`}></div>
        </div>

        {/* Animation Container */}
        <div className="h-48 w-full relative border-b border-gray-800 bg-[#0d1117] flex-shrink-0">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
            <div className="absolute bottom-2 right-2 text-[9px] text-gray-600 font-bold tracking-widest opacity-70">NEURAL_ENGINE_V2.5</div>
            
            {/* Overlay Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,6px_100%] pointer-events-none"></div>
        </div>

        {/* Scrollable Metrics */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-6">
            
            {/* Latency Metric */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <Clock size={12} />
                    <span className="uppercase font-bold text-[10px]">Response Latency</span>
                </div>
                <div className="flex items-end justify-between">
                    <div className="text-2xl font-bold text-white flex items-baseline gap-1">
                        {metrics.latency !== null ? metrics.latency.toFixed(0) : '--'} 
                        <span className="text-sm font-normal text-gray-500">ms</span>
                    </div>
                    {metrics.latency && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${metrics.latency < 500 ? 'text-green-400 bg-green-400/10' : 'text-yellow-400 bg-yellow-400/10'}`}>
                            {metrics.latency < 500 ? 'OPTIMAL' : 'NORMAL'}
                        </span>
                    )}
                </div>
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-blue-500 transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(((metrics.latency || 0) / 1500) * 100, 100)}%` }}
                    ></div>
                </div>
            </div>

            {/* Tokens per Second */}
            <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <Zap size={12} />
                    <span className="uppercase font-bold text-[10px]">Throughput</span>
                </div>
                    <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-white flex items-baseline gap-1">
                        {metrics.tps}
                        <span className="text-sm font-normal text-gray-500">tok/s</span>
                    </div>
                    <div className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-colors ${
                        metrics.tps > 40 ? 'border-green-500/30 text-green-400 bg-green-500/10' : 
                        metrics.tps > 20 ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' :
                        'border-gray-700 text-gray-500'
                    }`}>
                        {metrics.tps > 50 ? 'HYPER' : metrics.tps > 25 ? 'TURBO' : 'STD'}
                    </div>
                    </div>
            </div>

            {/* Token Count */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <Database size={12} />
                    <span className="uppercase font-bold text-[10px]">Context Usage</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#161b22] p-2 rounded border border-gray-800">
                        <div className="text-[9px] text-gray-500 font-bold mb-1">SESSION TOKENS</div>
                        <div className="text-lg font-semibold text-gray-200">{metrics.tokenCount}</div>
                    </div>
                    <div className="bg-[#161b22] p-2 rounded border border-gray-800">
                        <div className="text-[9px] text-gray-500 font-bold mb-1">EXCHANGES</div>
                        <div className="text-lg font-semibold text-gray-200">{metrics.totalExchanges}</div>
                    </div>
                </div>
            </div>

            {/* Simulated Server Logs */}
            <div className="space-y-2 pt-4 border-t border-gray-800/50">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Server size={12} />
                    <span className="uppercase font-bold text-[10px]">Event Log</span>
                </div>
                <div className="font-mono text-[10px] space-y-1.5 text-gray-500">
                        <div className="flex gap-2">
                            <span className="text-gray-600">[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]</span>
                            <span>System ready.</span>
                        </div>
                        {isGenerating && (
                            <>
                            <div className="flex gap-2 text-blue-400/80 animate-pulse">
                                <span className="text-blue-500/50">[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]</span>
                                <span>Streaming content...</span>
                            </div>
                            </>
                        )}
                        {metrics.latency !== null && !isGenerating && (
                            <div className="flex gap-2 text-green-400/80">
                                <span className="text-green-500/50">[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]</span>
                                <span>Request completed ({metrics.latency}ms)</span>
                            </div>
                        )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default AnalyticsPanel;