
import React, { useState, useRef, useEffect } from 'react';
import { Hammer, Play, Eraser, CheckCircle2, Terminal, Code2, FileText, ChevronDown, Square, Cpu, Zap, Activity, Grid, FileJson, AlignLeft, FileCode, Download, Loader2, ShieldCheck } from 'lucide-react';
import { streamBuilderResponse } from '../services/geminiService';
import { checkRateLimits, logRequest, getUsageStats, USER_LIMIT } from '../services/rateLimitService';
import { useAuth } from '../contexts/AuthContext';
import MarkdownContent from './MarkdownContent';
import { BUILDER_TEMPLATES } from '../constants';

interface BuilderInterfaceProps {
  modelId: string;
  onStateChange?: (isGenerating: boolean) => void;
}

const BuilderInterface: React.FC<BuilderInterfaceProps> = ({ modelId, onStateChange }) => {
  const { session, profile } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [generatedScript, setGeneratedScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  
  // UI State
  const [showTemplates, setShowTemplates] = useState(false);
  const [outputFormat, setOutputFormat] = useState<'markdown' | 'json' | 'text'>('markdown');
  const [showFormats, setShowFormats] = useState(false);
  
  // Mobile Tab State ('editor' | 'preview')
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');
  
  // State to toggle between "Info View" and "Console View" (Desktop logic mostly)
  const [hasStarted, setHasStarted] = useState(false);
  
  // Animation State for System Checks
  const [initStep, setInitStep] = useState(0);

  const stopRef = useRef(false);

  // Update usage stats on mount
  useEffect(() => {
    if (profile?.id) {
        getUsageStats(profile.id).then(setUsageCount);
    }
  }, [profile?.id, isGenerating]);

  // Report state changes to parent
  useEffect(() => {
    if (onStateChange) {
        onStateChange(isGenerating);
    }
  }, [isGenerating, onStateChange]);

  // Reset animation when returning to Info View
  useEffect(() => {
    if (!hasStarted) {
        setInitStep(0);
        const t1 = setTimeout(() => setInitStep(1), 400);
        const t2 = setTimeout(() => setInitStep(2), 900);
        const t3 = setTimeout(() => setInitStep(3), 1400);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [hasStarted]);
  
  const handleStop = () => {
    stopRef.current = true;
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    if (!session || !profile) {
        setHasStarted(true);
        setGeneratedScript("// Error: Please log in to use the Script Builder.");
        setMobileTab('preview');
        return;
    }

    setGeneratedScript('');
    stopRef.current = false;
    setIsGenerating(true);
    setIsComplete(false);
    setHasStarted(true); // Switch to Console View logic
    setMobileTab('preview'); // Auto-switch to preview on mobile

    try {
        // 1. Check Rate Limits
        const { allowed, reason } = await checkRateLimits(profile.id, profile.role);
        if (!allowed) {
            throw new Error(reason || "Rate limit exceeded.");
        }

        // 2. Log Request
        await logRequest(profile.id);
        
        // 3. Generate Stream
        const stream = streamBuilderResponse(modelId, prompt, outputFormat);

        let fullText = '';
        for await (const chunk of stream) {
            if (stopRef.current) {
                break;
            }
            fullText += chunk;
        }
        
        setGeneratedScript(fullText);
        
        if (!stopRef.current) {
            setIsComplete(true);
        }
    } catch (error: any) {
        setGeneratedScript(`// Error generating script: ${error.message || "Unknown error"}`);
    } finally {
        setIsGenerating(false);
    }
  };

  const handleClear = () => {
      setPrompt('');
      setGeneratedScript('');
      setIsComplete(false);
      setHasStarted(false); // Switch back to Info View
      setMobileTab('editor'); // Switch back to editor on mobile
  };

  const handleDownload = () => {
    if (!generatedScript) return;

    let extension = 'md';
    let mimeType = 'text/plain';
    let contentToSave = generatedScript;
    
    // Generate a unique random filename to avoid conflicts
    // Format: genai-{random_string}-{timestamp}
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    let filename = `genai-script-${randomSuffix}-${Date.now()}`;

    if (outputFormat === 'json') {
        extension = 'json';
        mimeType = 'application/json';
        // Attempt to clean markdown code blocks if present to ensure valid JSON file
        const jsonMatch = generatedScript.match(/```json\s*([\s\S]*?)\s*```/) || generatedScript.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            contentToSave = jsonMatch[1];
        }
    } else if (outputFormat === 'text') {
        extension = 'txt';
        mimeType = 'text/plain';
    } else {
        // Markdown Mode - Smart Extraction logic...
        const codeBlockRegex = /```([a-zA-Z0-9+\-#.]+)?\s*([\s\S]*?)\s*```/g;
        const matches = [...generatedScript.matchAll(codeBlockRegex)];
        
        if (matches.length > 0) {
            const bestMatch = matches.reduce((prev, current) => {
                return (current[2].length > prev[2].length) ? current : prev;
            });
            const lang = bestMatch[1]?.toLowerCase().trim() || 'text';
            contentToSave = bestMatch[2];
            
            const langMap: Record<string, string> = {
                'javascript': 'js', 'js': 'js', 'typescript': 'ts', 'ts': 'ts',
                'typescriptreact': 'tsx', 'jsx': 'jsx', 'tsx': 'tsx', 'python': 'py',
                'py': 'py', 'html': 'html', 'css': 'css', 'json': 'json', 'bash': 'sh',
                'sh': 'sh', 'shell': 'sh', 'java': 'java', 'cpp': 'cpp', 'c': 'c',
                'go': 'go', 'rust': 'rs', 'php': 'php', 'ruby': 'rb', 'markdown': 'md',
                'md': 'md', 'dockerfile': 'dockerfile',
            };
            extension = langMap[lang] || 'txt';
            if (extension === 'dockerfile') filename = 'Dockerfile';
        }
    }

    const blob = new Blob([contentToSave], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    if (filename === 'Dockerfile' && extension === 'dockerfile') {
        a.download = filename;
    } else {
        a.download = `${filename}.${extension}`;
    }

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFormatLabel = () => {
    switch (outputFormat) {
        case 'json': return 'JSON';
        case 'text': return 'Text';
        default: return 'Markdown';
    }
  };

  const getFormatIcon = () => {
    switch (outputFormat) {
        case 'json': return <FileJson size={14} />;
        case 'text': return <AlignLeft size={14} />;
        default: return <FileCode size={14} />;
    }
  };

  const renderCheckItem = (step: number, label: string) => {
    const isActive = initStep >= step;
    return (
      <div className={`flex items-center gap-2 text-xs transition-all duration-500 ${isActive ? 'opacity-100 translate-x-0' : 'opacity-40 -translate-x-2'}`}>
          <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] scale-110' : 'bg-gray-800'}`}></div>
          <span className={`transition-colors duration-300 ${isActive ? 'text-gray-300' : 'text-gray-600'}`}>{label}</span>
          <div className="h-px bg-gray-800/50 flex-1 overflow-hidden relative rounded-full">
              <div className={`absolute left-0 top-0 bottom-0 bg-gradient-to-r from-green-500/30 to-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)] transition-all duration-1000 ease-out ${isActive ? 'w-full' : 'w-0'}`}></div>
          </div>
          <span className={`font-mono text-[10px] font-bold transition-all duration-300 ${isActive ? 'text-green-400' : 'text-gray-800'}`}>
              {isActive ? 'OK' : '...'}
          </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      
      {/* MOBILE TAB NAVIGATION */}
      <div className="lg:hidden flex items-center p-1 bg-[#161b22] border border-gray-800 rounded-lg mb-3 shrink-0">
          <button 
             onClick={() => setMobileTab('editor')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-colors ${mobileTab === 'editor' ? 'bg-[#2d333b] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
          >
             <Hammer size={14} /> 
             Script Editor
          </button>
          <button 
             onClick={() => setMobileTab('preview')}
             disabled={!hasStarted && !isGenerating}
             className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-colors ${
                 mobileTab === 'preview' 
                 ? 'bg-[#2d333b] text-white shadow-sm' 
                 : (!hasStarted && !isGenerating ? 'text-gray-700 cursor-not-allowed' : 'text-gray-500 hover:text-gray-300')
             }`}
          >
             {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Terminal size={14} />} 
             Output Console
          </button>
      </div>

      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-2 lg:gap-6 relative min-h-0">
        {/* LEFT PANEL: INPUT (EDITOR) */}
        <div className={`${mobileTab === 'editor' ? 'flex' : 'hidden'} lg:flex flex-col h-full bg-[#0d1117] rounded-xl border border-gray-800 shadow-xl overflow-hidden relative`}>
            <div className="px-6 py-4 border-b border-gray-800 bg-[#161b22] flex items-center justify-between z-20 relative gap-2 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-purple-500/10 rounded-md">
                        <Hammer className="text-purple-400" size={18} />
                    </div>
                    <h2 className="hidden sm:block text-sm font-semibold text-gray-200 uppercase tracking-wide">Script Builder</h2>
                    
                    {/* Admin/User Role Indicator */}
                    {profile?.role === 'admin' ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">
                            <ShieldCheck size={10} /> ADMIN
                        </span>
                    ) : (
                         <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${usageCount >= (USER_LIMIT * 0.8) ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-gray-800 text-gray-400 border-gray-700"}`}>
                            {usageCount}/{USER_LIMIT}
                         </span>
                    )}
                </div>
                
                <div className="flex items-center gap-3">
                    {/* Output Format Selector */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowFormats(!showFormats)}
                            className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-white transition-colors bg-gray-800/50 hover:bg-gray-700 px-3 py-1.5 rounded-md border border-gray-700/50 min-w-[100px]"
                        >
                            {getFormatIcon()}
                            <span>{getFormatLabel()}</span>
                            <div className="flex-1"></div>
                            <ChevronDown size={12} className={`transition-transform ${showFormats ? 'rotate-180' : ''}`} />
                        </button>

                        {showFormats && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowFormats(false)}></div>
                                <div className="absolute right-0 top-full mt-2 w-36 bg-[#1c2128] border border-gray-700 rounded-lg shadow-xl z-30 overflow-hidden py-1 animate-fade-in">
                                    <div className="px-3 py-2 border-b border-gray-700/50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                        Output Format
                                    </div>
                                    <button
                                        className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-[#30363d] hover:text-white transition-colors flex items-center gap-2"
                                        onClick={() => { setOutputFormat('markdown'); setShowFormats(false); }}
                                    >
                                        <FileCode size={14} className="text-blue-400" /> Markdown
                                    </button>
                                    <button
                                        className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-[#30363d] hover:text-white transition-colors flex items-center gap-2"
                                        onClick={() => { setOutputFormat('json'); setShowFormats(false); }}
                                    >
                                        <FileJson size={14} className="text-yellow-400" /> JSON
                                    </button>
                                    <button
                                        className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-[#30363d] hover:text-white transition-colors flex items-center gap-2"
                                        onClick={() => { setOutputFormat('text'); setShowFormats(false); }}
                                    >
                                        <AlignLeft size={14} className="text-gray-400" /> Plain Text
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Templates Dropdown */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowTemplates(!showTemplates)}
                            className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-white transition-colors bg-gray-800/50 hover:bg-gray-700 px-3 py-1.5 rounded-md border border-gray-700/50"
                        >
                            <FileText size={14} />
                            <span className="hidden sm:inline">Templates</span>
                            <ChevronDown size={12} className={`transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
                        </button>

                        {showTemplates && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowTemplates(false)}></div>
                                <div className="absolute right-0 top-full mt-2 w-64 bg-[#1c2128] border border-gray-700 rounded-lg shadow-xl z-30 overflow-hidden py-1 animate-fade-in">
                                    <div className="px-3 py-2 border-b border-gray-700/50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                        Select a template
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
                                        {BUILDER_TEMPLATES.map((t) => (
                                            <button
                                                key={t.id}
                                                className="w-full text-left px-4 py-2.5 text-xs text-gray-300 hover:bg-[#30363d] hover:text-white transition-colors border-l-2 border-transparent hover:border-purple-500 truncate"
                                                onClick={() => {
                                                    setPrompt(t.prompt);
                                                    setShowTemplates(false);
                                                }}
                                                title={t.label}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 min-h-0 overflow-y-auto lg:overflow-visible custom-scrollbar">
            <div className="flex-1 relative min-h-[250px] lg:min-h-0">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={`Describe the functionality you need in ${getFormatLabel()} format...`}
                    className="w-full h-full bg-[#161b22] p-4 rounded-xl border border-gray-700 text-gray-200 placeholder-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none font-mono text-base sm:text-sm leading-relaxed custom-scrollbar"
                />
            </div>
            
            <div className="flex gap-3 pt-2 shrink-0 pb-1">
                <button
                    onClick={handleClear}
                    className="px-4 py-3 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex items-center gap-2 text-sm font-medium"
                    disabled={isGenerating}
                >
                    <Eraser size={16} />
                    Clear
                </button>
                
                {isGenerating ? (
                    <button
                        onClick={handleStop}
                        className="flex-1 px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all text-sm bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20 shadow-lg hover:shadow-red-500/10"
                    >
                        <Square size={16} fill="currentColor" />
                        Stop Generation
                    </button>
                ) : (
                    <button
                        onClick={handleGenerate}
                        disabled={!prompt.trim()}
                        className={`flex-1 px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all text-sm ${
                        !prompt.trim()
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            : 'bg-purple-600 text-white hover:bg-purple-500 shadow-lg hover:shadow-purple-500/25'
                        }`}
                    >
                        <Play size={16} fill="currentColor" />
                        Build Script
                    </button>
                )}
            </div>
            </div>
        </div>

        {/* RIGHT PANEL: OUTPUT (PREVIEW) */}
        <div className={`${mobileTab === 'preview' ? 'flex' : 'hidden'} lg:flex flex-col h-full bg-[#0d1117] rounded-xl border border-gray-800 shadow-xl overflow-hidden relative`}>
            
            {/* Dynamic Header */}
            <div className="px-6 py-4 border-b border-gray-800 bg-[#161b22] flex items-center justify-between z-20 shrink-0">
                {!hasStarted ? (
                    // Info Header
                    <div className="flex items-center gap-3 animate-fade-in">
                        <Activity size={18} className="text-purple-400" />
                        <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">AI Architect System</h3>
                    </div>
                ) : (
                    // Console Header
                    <div className="flex items-center gap-3 animate-fade-in">
                        <Terminal size={18} className="text-gray-400" />
                        <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Output Console</h3>
                    </div>
                )}
                
                {/* Status Info / Actions */}
                <div className="flex items-center gap-3">
                    {hasStarted && isComplete && (
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-1.5 text-xs font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-md transition-colors animate-fade-in"
                            title="Download output"
                        >
                            <Download size={12} />
                            Download
                        </button>
                    )}

                    {!hasStarted ? (
                        <span className="flex items-center gap-1.5 text-blue-400 text-xs font-medium bg-blue-400/10 px-2 py-1 rounded-full border border-blue-400/20">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                            System Ready
                        </span>
                    ) : (
                        isComplete ? (
                            <span className="flex items-center gap-1.5 text-green-400 text-xs font-medium bg-green-400/10 px-2 py-1 rounded-full border border-green-400/20 animate-fade-in">
                                <CheckCircle2 size={12} /> Generated
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-yellow-400 text-xs font-medium bg-yellow-400/10 px-2 py-1 rounded-full border border-yellow-400/20 animate-pulse">
                                <Cpu size={12} /> Processing...
                            </span>
                        )
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div 
                className="flex-1 overflow-auto bg-[#161b22] scrollbar-thin relative"
            >
            {!hasStarted ? (
                /* --- STATE 1: Info / Animation View --- */
                <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden select-none p-6 animate-fade-in">
                    
                    {/* Background Details */}
                    <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                    
                    <div className="relative z-10 w-full max-w-sm mx-auto p-1">
                        {/* Floating Card */}
                        <div className="relative bg-[#0d1117]/80 border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl">
                            
                            {/* Card Header */}
                            <div className="bg-[#161b22]/90 px-4 py-3 flex items-center justify-between border-b border-gray-800/50">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-gray-700"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-gray-700"></div>
                                </div>
                                <div className="text-[10px] font-mono text-gray-500 flex items-center gap-1.5">
                                    <Grid size={10} />
                                    <span>BLUEPRINT_MODE</span>
                                </div>
                            </div>

                            {/* Card Body - Simulated "Planning" State */}
                            <div className="p-6 space-y-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-500/10 flex items-center justify-center border border-purple-500/20">
                                        <Zap size={20} className="text-purple-400" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-gray-200">AI Architect Active</div>
                                        <div className="text-xs text-gray-500 mt-0.5">Gemini 2.5 Flash Engine</div>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    {renderCheckItem(1, "Syntax Analysis Module")}
                                    {renderCheckItem(2, "Logic Optimization")}
                                    {renderCheckItem(3, "Security Scan")}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 text-center space-y-2 relative z-10">
                        <p className="text-sm font-medium text-gray-400">
                            Waiting for specifications...
                        </p>
                        <p className="text-xs text-gray-600 font-mono max-w-xs mx-auto">
                            Select a template or describe your requirements to initialize the generation sequence.
                        </p>
                    </div>
                </div>
            ) : (
                /* --- STATE 2: Console View --- */
                <div className="p-6 h-full">
                    {isGenerating ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-6 animate-fade-in opacity-80">
                            <div className="relative">
                                <div className="w-12 h-12 border-4 border-gray-700 rounded-full"></div>
                                <div className="absolute top-0 left-0 w-12 h-12 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <p className="text-sm font-semibold text-gray-300">Generating Architecture</p>
                                <p className="text-xs font-mono text-gray-500">Compiling response from Gemini...</p>
                            </div>
                        </div>
                    ) : (
                        outputFormat === 'text' ? (
                            <div className="font-mono text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                                {generatedScript}
                            </div>
                        ) : (
                            <MarkdownContent content={generatedScript} />
                        )
                    )}
                </div>
            )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default BuilderInterface;
