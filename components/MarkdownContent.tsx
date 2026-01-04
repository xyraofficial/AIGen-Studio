import React, { useMemo, useRef } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';

interface MarkdownContentProps {
  content: string;
}

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const parsedContent = useMemo(() => {
    // Create a new renderer instance for this render cycle
    const renderer = new marked.Renderer();
    
    // Custom renderer for code blocks with synchronous highlighting
    renderer.code = (code, language) => {
       // Normalize language
       const lang = (language || 'text').toLowerCase();
       const validLang = !!(lang && hljs.getLanguage(lang));
       
       // 1. Detect pure Terminal Output (for styling like a console window)
       const isTerminalOutput = ['console', 'terminal', 'output'].includes(lang);
       
       // 2. Detect Shell/Command-line languages that benefit from WRAPPING instead of scrolling
       // This fixes the mobile "snap back" scroll bug by removing the need to scroll for long git commands
       const shouldWrapText = ['bash', 'sh', 'shell', 'zsh', 'git', 'console', 'terminal', 'output'].includes(lang);
       
       let processedCode = code;

       if (isTerminalOutput) {
           // Remove ANSI escape codes and handle carriage returns for pure terminal output
           processedCode = processedCode.replace(/\u001b\[[0-9;]*[mK]/g, '');
           processedCode = processedCode.replace(/\r\n/g, '\n');
           processedCode = processedCode.split('\n').map(line => {
               const lastCrIndex = line.lastIndexOf('\r');
               return lastCrIndex !== -1 ? line.substring(lastCrIndex + 1) : line;
           }).join('\n');
       }
       
       // Synchronous Highlighting
       let highlightedCode = processedCode;
       try {
           if (validLang) {
               highlightedCode = hljs.highlight(processedCode, { language: lang }).value;
           } else {
               highlightedCode = hljs.highlight(processedCode, { language: 'plaintext' }).value;
           }
       } catch (error) {
           console.warn('Highlighting failed', error);
           highlightedCode = processedCode.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
       }

       const encodedCode = encodeURIComponent(processedCode);
       
       // Header Logic: Terminal dots for output, Language name for scripts
       const headerContent = isTerminalOutput 
         ? `<div class="flex gap-1.5 py-0.5">
              <div class="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
              <div class="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
              <div class="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
            </div>
            <span class="text-[10px] font-mono text-gray-500 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">terminal</span>`
         : `<span class="text-xs font-mono font-bold text-gray-400 uppercase tracking-wide flex items-center gap-2">
              ${lang === 'js' ? 'javascript' : lang}
            </span>`;

       const borderColor = isTerminalOutput ? 'border-gray-800' : 'border-gray-700';
       const bgColor = isTerminalOutput ? 'bg-[#0f1115]' : 'bg-[#0d1117]';

       // CSS Logic: 
       // If it's Bash/Shell/Git/Terminal -> wrap lines (no scroll needed, easy to read on mobile)
       // If it's Python/JS/etc -> keep pre (scroll needed to preserve strict indentation)
       const whitespaceClass = shouldWrapText ? '!whitespace-pre-wrap !break-words' : '!whitespace-pre';

       return `
         <div class="code-wrapper relative group my-5 rounded-lg overflow-hidden border ${borderColor} ${bgColor} shadow-lg">
           <div class="flex items-center justify-between px-4 py-2.5 bg-[#1a1f29] border-b ${borderColor} select-none">
              <div class="flex items-center">
                 ${headerContent}
              </div>
              <button 
                class="copy-btn flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-white transition-colors cursor-pointer bg-gray-800/50 hover:bg-gray-700 px-2 py-1 rounded border border-transparent hover:border-gray-600" 
                data-code="${encodedCode}"
                aria-label="Copy code"
              >
                  <span class="copy-icon-container flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  </span>
                  <span class="copy-text">Copy</span>
              </button>
           </div>
           <div class="relative w-full">
             <pre class="!m-0 !border-0 !bg-transparent !p-4 overflow-x-auto w-full scrollbar-thin"><code class="hljs ${validLang ? lang : ''} !font-mono !text-[13px] !leading-relaxed ${whitespaceClass}">${highlightedCode}</code></pre>
           </div>
         </div>`;
    };

    try {
        return marked.parse(content, { renderer, gfm: true, breaks: true }) as string;
    } catch (e) {
        console.error("Markdown parsing error", e);
        return content;
    }
  }, [content]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const button = target.closest('.copy-btn') as HTMLElement;

    if (button && containerRef.current?.contains(button)) {
        const encodedCode = button.getAttribute('data-code');
        if (!encodedCode) return;
        const code = decodeURIComponent(encodedCode);
        navigator.clipboard.writeText(code).then(() => {
            const iconContainer = button.querySelector('.copy-icon-container');
            const label = button.querySelector('.copy-text');
            if (iconContainer) iconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-400"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            if (label) {
                label.textContent = 'Copied';
                label.classList.add('text-green-400');
            }
            setTimeout(() => {
                 if (iconContainer) iconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
                 if (label) {
                    label.textContent = 'Copy';
                    label.classList.remove('text-green-400');
                 }
            }, 2000);
        });
    }
  };

  return (
    <div 
        ref={containerRef}
        className="markdown-body text-gray-200"
        dangerouslySetInnerHTML={{ __html: parsedContent }}
        onClick={handleContainerClick}
    />
  );
};

export default MarkdownContent;