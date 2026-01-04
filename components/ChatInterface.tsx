
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2, Square, Sparkles, ThumbsUp, ThumbsDown, Copy, Check, Share2, MessageSquare, Globe, ExternalLink, ShieldCheck, AlertOctagon } from 'lucide-react';
import { Message, StreamChunk } from '../types';
import { streamChatResponse } from '../services/geminiService';
import { checkRateLimits, logRequest, getUsageStats, USER_LIMIT } from '../services/rateLimitService';
import { useAuth } from '../contexts/AuthContext';
import MarkdownContent from './MarkdownContent';

interface ChatInterfaceProps {
  modelId: string;
  onStateChange?: (isGenerating: boolean) => void;
}

const LoadingStatus = ({ text }: { text: string }) => {
  return (
    <div className="flex items-center gap-3 h-6 px-1">
        <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></span>
        </div>
        <span className="text-sm font-medium text-gray-400 animate-pulse font-mono tracking-wide truncate max-w-[300px] md:max-w-full">{text}</span>
    </div>
  );
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ modelId, onStateChange }) => {
  const { session, profile, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Thinking...");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [usageCount, setUsageCount] = useState(0);
  
  // Placeholder Typing Animation State
  const [placeholderText, setPlaceholderText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const typingSpeed = 100;
  const pauseDuration = 2000;
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stopRef = useRef(false);
  
  const shouldAutoScrollRef = useRef(true);

  // Update usage stats on mount
  useEffect(() => {
    if (profile?.id) {
        getUsageStats(profile.id).then(setUsageCount);
    }
  }, [profile?.id, isLoading]);

  // Report state changes to parent
  useEffect(() => {
    if (onStateChange) {
        onStateChange(isLoading);
    }
  }, [isLoading, onStateChange]);

  // Typewriter Effect for Placeholder
  useEffect(() => {
    if (isFocused || input.length > 0) {
        setPlaceholderText("Type your message here...");
        return;
    }

    const targetText = "Type your message here...";
    let currentIndex = 0;
    let isDeleting = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    let isMounted = true;

    const animatePlaceholder = () => {
        if (!isMounted) return;

        if (isDeleting) {
            if (currentIndex > 0) {
                setPlaceholderText(targetText.slice(0, currentIndex - 1));
                currentIndex--;
                timeoutId = setTimeout(animatePlaceholder, typingSpeed / 2);
            } else {
                isDeleting = false;
                timeoutId = setTimeout(animatePlaceholder, 500);
            }
        } else {
            if (currentIndex < targetText.length) {
                setPlaceholderText(targetText.slice(0, currentIndex + 1));
                currentIndex++;
                timeoutId = setTimeout(animatePlaceholder, typingSpeed);
            } else {
                isDeleting = true;
                timeoutId = setTimeout(animatePlaceholder, pauseDuration);
            }
        }
    };

    timeoutId = setTimeout(animatePlaceholder, 500);

    return () => {
        isMounted = false;
        clearTimeout(timeoutId);
    };
  }, [isFocused, input]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    shouldAutoScrollRef.current = isAtBottom;
  };

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
       scrollToBottom('smooth');
    }
  }, [messages]);

  useEffect(() => {
    scrollToBottom('auto');
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
        if (input === '') {
            textareaRef.current.style.height = 'auto'; 
        } else {
            textareaRef.current.style.height = 'auto';
            const newHeight = Math.min(textareaRef.current.scrollHeight, 150);
            textareaRef.current.style.height = `${newHeight}px`;
        }
    }
  }, [input]);

  const handleStop = () => {
    stopRef.current = true;
  };

  const getLoadingText = (inputText: string) => {
    const cleanInput = inputText.trim();
    const lower = cleanInput.toLowerCase();
    
    const extractTopic = (triggerWord: string) => {
        const index = lower.indexOf(triggerWord);
        if (index === -1) return "";
        let remainder = cleanInput.slice(index + triggerWord.length).trim();
        remainder = remainder.replace(/^[:\s-]+/, "").replace(/^(for|about|of|on|to|the|a|an|tentang|soal|mengenai)\s+/i, "");
        if (!remainder) return "";
        const words = remainder.split(' ');
        if (words.length > 5) {
            return words.slice(0, 5).join(' ') + '...';
        }
        return remainder;
    };

    if (lower.match(/\b(search|cari|find|google|lookup|carikan)\b/)) {
        const match = lower.match(/\b(search|cari|find|google|lookup|carikan)\b/);
        const topic = extractTopic(match ? match[0] : "");
        return topic ? `Searching web for "${topic}"...` : "Searching the web...";
    }
    if (lower.startsWith("info ") || lower.startsWith("berita ") || lower.startsWith("news ")) {
        const topic = extractTopic(" ");
        return `Fetching info about "${topic}"...`;
    }
    if (lower.match(/\b(create|write|code|generate|build|buat|tulis|bikin|bikinin|coding)\b/)) {
         const match = lower.match(/\b(create|write|code|generate|build|buat|tulis|bikin|bikinin|coding)\b/);
         const topic = extractTopic(match ? match[0] : "");
         return topic ? `Drafting code for "${topic}"...` : "Writing code...";
    }
    if (lower.match(/\b(explain|analyze|describe|jelaskan|analisa|review|cek|check)\b/)) {
         const match = lower.match(/\b(explain|analyze|describe|jelaskan|analisa|review|cek|check)\b/);
         const topic = extractTopic(match ? match[0] : "");
         return topic ? `Analyzing "${topic}"...` : "Analyzing request...";
    }
    if (lower.match(/^(why|how|what|kenapa|bagaimana|apa|siapa|dimana)\b/)) {
         return "Thinking deeply...";
    }
    if (lower.match(/\b(fix|debug|perbaiki|error|bug|masalah)\b/)) {
        return "Debugging code...";
    }
    return "Generating response...";
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!session || !profile) {
        setMessages(prev => [...prev, {
            role: 'model',
            content: "Please log in to use the chat features.",
            timestamp: Date.now(),
            isError: true
        }]);
        return;
    }

    shouldAutoScrollRef.current = true;
    scrollToBottom('smooth');

    const userMsg: Message = { role: 'user', content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    
    setLoadingStatus(getLoadingText(input));
    
    setInput('');
    setIsLoading(true);
    stopRef.current = false;
    
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const modelMsgId = Date.now() + 1;
    setMessages(prev => [...prev, { role: 'model', content: '', timestamp: modelMsgId }]);

    try {
      // 1. RATE LIMIT CHECK
      const { allowed, reason } = await checkRateLimits(profile.id, profile.role);
      
      if (!allowed) {
          throw new Error(reason || "Rate limit exceeded.");
      }

      // 2. Log Request
      await logRequest(profile.id);

      // 3. Generate Stream
      const stream = streamChatResponse(modelId, messages, userMsg.content);

      let fullText = '';
      let collectedMetadata = null;

      for await (const chunk of stream) {
        if (stopRef.current) {
          break;
        }

        fullText += chunk.text;
        
        if (chunk.groundingMetadata) {
            collectedMetadata = chunk.groundingMetadata;
        }

        setMessages(prev => prev.map(msg => 
          msg.timestamp === modelMsgId ? { 
              ...msg, 
              content: fullText,
              groundingMetadata: collectedMetadata 
          } : msg
        ));
      }
    } catch (error: any) {
      const errorMsg = error.message || "Sorry, I encountered an error. Please check your API Key or try again.";
      setMessages(prev => prev.map(msg => 
        msg.timestamp === modelMsgId ? { ...msg, content: errorMsg, isError: true } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput('');
    shouldAutoScrollRef.current = true;
  };

  const handleCopyMessage = (content: string, id: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleFeedback = (index: number, type: 'like' | 'dislike') => {
    setMessages(prev => prev.map((msg, i) => {
      if (i === index) {
        const newFeedback = msg.feedback === type ? undefined : type;
        return { ...msg, feedback: newFeedback };
      }
      return msg;
    }));
  };

  const handleShare = async (content: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'GenAI Studio Response',
          text: content,
        });
      } catch (err) {
        console.log('Share canceled or failed', err);
      }
    } else {
      handleCopyMessage(content, Date.now());
      alert('Sharing not supported on this device. Copied to clipboard.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden relative">
      
      <div className="flex flex-col flex-1 h-full min-w-0">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-800 bg-[#161b22] flex items-center justify-between z-20 flex-shrink-0">
            <div className="flex items-center gap-3">
                <div className="p-1.5 bg-blue-500/10 rounded-md">
                    <MessageSquare className="text-blue-400" size={18} />
                </div>
                <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Chat Session</h2>
                {profile?.role === 'admin' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">
                        <ShieldCheck size={10} /> ADMIN
                    </span>
                )}
            </div>
            
            <div className="flex items-center gap-2">
                {profile?.role !== 'admin' && profile && (
                     <div className="text-[10px] text-gray-500 font-mono mr-2 hidden sm:block">
                        LIMIT: <span className={usageCount >= (USER_LIMIT * 0.8) ? "text-red-400" : "text-gray-300"}>{usageCount}/{USER_LIMIT}</span>
                     </div>
                )}
                {messages.length > 0 && (
                    <button 
                        onClick={clearChat}
                        disabled={isLoading}
                        className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-red-400 transition-colors bg-gray-800/50 hover:bg-gray-800 px-3 py-1.5 rounded-md border border-gray-700/50"
                        title="Clear conversation"
                    >
                        <Trash2 size={14} />
                        <span className="hidden sm:inline">Clear</span>
                    </button>
                )}
            </div>
          </div>

          {/* Messages Area */}
          <div 
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin scroll-smooth"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 animate-fade-in">
                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
                    <Sparkles size={32} className="text-blue-500" />
                </div>
                <h2 className="text-xl font-semibold text-gray-200 mb-2">Welcome to GenAI Studio</h2>
                <p className="text-gray-400 text-center max-w-md">
                    {session 
                        ? "Start a conversation to generate code, brainstorm ideas, or ask complex questions using Gemini."
                        : "Please Log In to start using the chat features."}
                </p>
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-4 group animate-fade-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-lg">
                    {msg.isError ? <AlertOctagon size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
                  </div>
                )}
                
                <div className={`max-w-[85%] md:max-w-[75%] flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}>
                  <div className={`rounded-2xl p-4 shadow-sm w-full ${
                    msg.role === 'user' 
                      ? 'bg-[#1f6feb] text-white rounded-tr-none' 
                      : 'bg-[#161b22] text-gray-100 rounded-tl-none border border-gray-800'
                  } ${msg.isError ? 'border-red-500/50 bg-red-900/10 text-red-200' : ''}`}>
                    {msg.role === 'model' ? (
                      msg.content ? (
                        <>
                          <MarkdownContent content={msg.content} />
                          
                          {/* Grounding Sources */}
                          {msg.groundingMetadata?.groundingChunks && msg.groundingMetadata.groundingChunks.length > 0 && (
                             <div className="mt-4 pt-3 border-t border-gray-800/80">
                                <div className="flex items-center gap-2 mb-2">
                                    <Globe size={12} className="text-blue-400" />
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sources</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {msg.groundingMetadata.groundingChunks.map((chunk: any, i: number) => {
                                        if (chunk.web?.uri && chunk.web?.title) {
                                            return (
                                                <a 
                                                    key={i} 
                                                    href={chunk.web.uri} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0d1117] border border-gray-700/50 rounded-md hover:border-blue-500/50 hover:bg-[#1a202c] transition-all text-xs text-blue-400 hover:text-blue-300 max-w-full"
                                                >
                                                    <span className="truncate max-w-[150px]">{chunk.web.title}</span>
                                                    <ExternalLink size={10} className="flex-shrink-0 opacity-50" />
                                                </a>
                                            );
                                        }
                                        return null;
                                    })}
                                </div>
                             </div>
                          )}

                          {/* Action Bar */}
                          {!isLoading && !msg.isError && (
                            <div className="mt-3 pt-3 border-t border-gray-800/50 flex items-center gap-1">
                              <button 
                                onClick={() => handleCopyMessage(msg.content, msg.timestamp)}
                                className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-md transition-all"
                                title="Copy full response"
                              >
                                {copiedId === msg.timestamp ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                              </button>
                              
                              <div className="w-px h-3 bg-gray-800 mx-1"></div>

                              <button 
                                onClick={() => handleFeedback(idx, 'like')}
                                className={`p-1.5 rounded-md transition-all ${
                                  msg.feedback === 'like' 
                                    ? 'text-green-400 bg-green-400/10' 
                                    : 'text-gray-500 hover:text-green-400 hover:bg-gray-800'
                                }`}
                              >
                                <ThumbsUp size={14} />
                              </button>
                              
                              <button 
                                onClick={() => handleFeedback(idx, 'dislike')}
                                className={`p-1.5 rounded-md transition-all ${
                                  msg.feedback === 'dislike' 
                                    ? 'text-red-400 bg-red-400/10' 
                                    : 'text-gray-500 hover:text-red-400 hover:bg-gray-800'
                                }`}
                              >
                                <ThumbsDown size={14} />
                              </button>

                              <div className="flex-1"></div>
                              
                              <button 
                                onClick={() => handleShare(msg.content)}
                                className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-gray-800 rounded-md transition-all"
                              >
                                <Share2 size={14} />
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <LoadingStatus text={loadingStatus} />
                      )
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden">
                    {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <User size={16} className="text-gray-300" />}
                  </div>
                )}
              </div>
            ))}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-[#0d1117] border-t border-gray-800 flex-shrink-0">
            <div className="max-w-4xl mx-auto relative flex items-end gap-3 bg-[#161b22] p-2 rounded-xl border border-gray-700 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all shadow-lg">
              
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isLoading ? "Generating response..." : placeholderText}
                disabled={isLoading}
                className={`w-full bg-transparent text-gray-100 placeholder-gray-500 py-3 pl-3 max-h-[150px] outline-none resize-none scrollbar-thin font-medium leading-normal ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                rows={1}
              />

              <button
                onClick={isLoading ? handleStop : handleSend}
                disabled={!isLoading && !input.trim()}
                className={`p-3 rounded-lg flex items-center justify-center transition-all mb-1 ${
                  isLoading 
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/50 shadow-lg hover:shadow-red-500/10'
                    : (!input.trim() 
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                        : 'bg-blue-600 text-white hover:bg-blue-500 shadow-md hover:shadow-blue-500/20')
                }`}
                title={isLoading ? "Stop Generation" : "Send Message"}
              >
                {isLoading ? <Square size={20} fill="currentColor" /> : <Send size={20} />}
              </button>
            </div>
            <div className="text-center mt-2">
                <span className="text-[10px] text-gray-500 font-mono">Gemini can make mistakes. Please double-check responses.</span>
            </div>
          </div>
      </div>
    </div>
  );
};

export default ChatInterface;
