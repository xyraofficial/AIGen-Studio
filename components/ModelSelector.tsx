import React from 'react';
import { AVAILABLE_MODELS } from '../constants';
import { Cpu, Zap, Code2, ChevronDown, Info } from 'lucide-react';

interface ModelSelectorProps {
  selectedModelId: string;
  onSelectModel: (id: string) => void;
  disabled?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModelId, onSelectModel, disabled }) => {
  const selected = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0];

  return (
    <div className="flex items-center gap-3">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:block">Model:</label>
      
      <div className="relative group">
        <select
          value={selectedModelId}
          onChange={(e) => onSelectModel(e.target.value)}
          disabled={disabled}
          // Reduced width (w-[140px] sm:w-[200px]) and padding (pr-16) for a tighter fit
          className="appearance-none bg-[#161b22] border border-gray-700 text-gray-200 text-sm rounded-lg py-2 pl-3 pr-16 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 cursor-pointer hover:bg-[#1c2128] transition-colors shadow-sm w-[140px] sm:w-[200px] truncate"
        >
          {AVAILABLE_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
        
        {/* Icons inside the select box - Removed background color to fix hover state */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-2 pl-2">
            {/* Category Icon */}
            {selected.category === 'coding' && <Code2 size={15} className="text-blue-400 shrink-0" />}
            {selected.category === 'fast' && <Zap size={15} className="text-yellow-400 shrink-0" />}
            {selected.category === 'general' && <Cpu size={15} className="text-purple-400 shrink-0" />}
            
            <div className="w-px h-4 bg-gray-700"></div>
            
            {/* Dropdown Chevron */}
            <ChevronDown size={14} className="text-gray-500 shrink-0" />
        </div>
        
        {/* Tooltip Description - HIDDEN ON MOBILE (hidden md:group-hover:block) */}
        <div className="absolute hidden md:group-hover:block top-full mt-2 right-0 w-80 p-0 bg-[#1c2128] border border-gray-700 rounded-lg shadow-2xl z-50 animate-fade-in overflow-hidden pointer-events-none">
            <div className="px-4 py-3 border-b border-gray-700/50 bg-[#21262d] flex items-center gap-2">
                 {selected.category === 'coding' && <Code2 size={16} className="text-blue-400" />}
                 {selected.category === 'fast' && <Zap size={16} className="text-yellow-400" />}
                 {selected.category === 'general' && <Cpu size={16} className="text-purple-400" />}
                 <span className="text-xs font-bold text-gray-200 uppercase tracking-wide">{selected.name}</span>
            </div>
            <div className="p-4">
                <p className="text-xs text-gray-400 leading-relaxed">{selected.description}</p>
                <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                    <Info size={10} />
                    <span>Best for: {selected.category === 'coding' ? 'Complex Logic' : selected.category === 'fast' ? 'Quick Answers' : 'Balanced Tasks'}</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ModelSelector;