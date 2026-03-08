'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, Trash2 } from 'lucide-react';
import { SearchHistory } from '@/utils/history';

interface SearchHistoryPopupProps {
  onSelect: (keyword: string) => void;
  onSearch: (keyword: string) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export default function SearchHistoryPopup({
  onSelect,
  onSearch,
  inputValue,
  onInputChange,
  onFocus,
  onBlur
}: SearchHistoryPopupProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<{ keyword: string; timestamp: number }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(SearchHistory.getAll());
  }, [showHistory]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFocus = () => {
    setShowHistory(true);
    onFocus?.();
  };

  const handleSelectHistory = (keyword: string) => {
    onInputChange(keyword);
    setShowHistory(false);
    onSelect(keyword);
  };

  const handleRemoveHistory = (e: React.MouseEvent, keyword: string) => {
    e.stopPropagation();
    SearchHistory.remove(keyword);
    setHistory(SearchHistory.getAll());
  };

  const handleClearHistory = () => {
    SearchHistory.clear();
    setHistory([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      SearchHistory.add(inputValue.trim());
      setShowHistory(false);
      onSearch(inputValue.trim());
    }
  };

  const handleSearchClick = () => {
    if (inputValue.trim()) {
      SearchHistory.add(inputValue.trim());
      setShowHistory(false);
      onSearch(inputValue.trim());
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder="搜索视频..."
          className="w-full px-4 py-3 sm:px-6 sm:py-4 pl-10 sm:pl-12 pr-12 sm:pr-14 text-sm sm:text-lg bg-gray-800/80 backdrop-blur-sm text-white placeholder-gray-400 border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        <svg
          className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <button
          onClick={handleSearchClick}
          className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
          title="搜索"
        >
          <Search className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {showHistory && history.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800/95 backdrop-blur-xl rounded-xl border border-gray-700/50 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700/50">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Clock className="w-4 h-4" />
              <span>搜索历史</span>
            </div>
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              清空
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {history.map((item, index) => (
              <div
                key={index}
                onClick={() => handleSelectHistory(item.keyword)}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-white/5 cursor-pointer group transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-gray-300 truncate">{item.keyword}</span>
                </div>
                <button
                  onClick={(e) => handleRemoveHistory(e, item.keyword)}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-700 rounded transition-all"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
