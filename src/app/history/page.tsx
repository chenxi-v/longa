'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { History, Trash2, Play, X } from 'lucide-react';
import Link from 'next/link';
import PageTransition from '@/components/PageTransition';
import { WatchHistory, WatchHistoryItem } from '@/utils/history';

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    setHistory(WatchHistory.getAll());
  }, []);

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    WatchHistory.remove(id);
    setHistory(WatchHistory.getAll());
  };

  const handleClear = () => {
    WatchHistory.clear();
    setHistory([]);
    setShowClearConfirm(false);
  };

  const handleClick = (item: WatchHistoryItem) => {
    if (item.sourceType === 'spider' && item.episodes && item.episodes.length > 0) {
      // 爬虫API源：直接跳转到播放器继续播放
      const params = new URLSearchParams({
        historyId: item.id,
        videoName: item.vod_name || '',
        coverPic: item.vod_pic || ''
      });
      router.push(`/player?${params.toString()}`);
    } else if (item.sourceType === 'tvbox' && item.episodes && item.episodes.length > 0 && item.currentEpisodeIndex !== undefined) {
      const episode = item.episodes[item.currentEpisodeIndex];
      if (episode) {
        const params = new URLSearchParams({
          historyId: item.id,
          videoName: item.vod_name || '',
          coverPic: item.vod_pic || ''
        });
        router.push(`/player?${params.toString()}`);
      }
    } else if (item.sourceId && item.vod_id) {
      const params = new URLSearchParams({
        sourceId: item.sourceId,
        videoId: String(item.vod_id)
      });
      router.push(`/player?${params.toString()}`);
    }
  };

  const getEpisodeInfo = (item: WatchHistoryItem): string => {
    if (item.sourceType === 'spider' && item.episodes && item.currentEpisodeIndex !== undefined) {
      const episode = item.episodes[item.currentEpisodeIndex];
      return episode?.label || `第${item.currentEpisodeIndex + 1}集`;
    }
    if (item.sourceType === 'tvbox' && item.episodes && item.currentEpisodeIndex !== undefined) {
      const episode = item.episodes[item.currentEpisodeIndex];
      return episode?.label || '';
    }
    if (item.currentEpisodeIndex !== undefined && item.currentEpisodeIndex > 0) {
      return `第${item.currentEpisodeIndex + 1}集`;
    }
    return '';
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes <= 1 ? '刚刚' : `${minutes}分钟前`;
      }
      return `${hours}小时前`;
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen relative">
        <div className="relative" style={{ zIndex: 10 }}>
          <div className="max-w-7xl mx-auto px-4 py-20 sm:py-24">
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between mb-8 gap-4">
              <div className="flex items-center gap-3">
                <History className="w-8 h-8 text-blue-400" />
                <h1 className="text-3xl sm:text-4xl font-bold text-white">
                  观看历史
                </h1>
              </div>
              <div className="flex items-center gap-3">
                {history.length > 0 && (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 rounded-full hover:bg-red-600/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    清空历史
                  </button>
                )}
                <button
                  onClick={() => router.back()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 text-white rounded-full hover:from-blue-600 hover:via-sky-600 hover:to-cyan-600 transition-all duration-300"
                >
                  返回
                </button>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-12 border border-gray-700/50">
                <div className="flex flex-col items-center justify-center text-gray-400">
                  <History className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg">暂无观看记录</p>
                  <p className="text-sm mt-2">观看的视频将自动记录在这里</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleClick(item)}
                    className="group relative bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-700/50 cursor-pointer hover:border-blue-500/50 transition-all hover:scale-105 flex flex-col h-full"
                  >
                    <div className="relative w-full" style={{ aspectRatio: '3/4' }}>
                      {item.vod_pic ? (
                        <img
                          src={item.vod_pic}
                          alt={item.vod_name}
                          className="w-full h-full object-cover absolute inset-0"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.style.display = 'none';
                            const parent = img.parentElement;
                            if (parent) {
                              const placeholder = document.createElement('div');
                              placeholder.className = 'w-full h-full bg-gray-700 flex items-center justify-center absolute inset-0';
                              placeholder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-12 h-12 text-gray-500"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
                              parent.appendChild(placeholder);
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-700 flex items-center justify-center absolute inset-0">
                          <Play className="w-12 h-12 text-gray-500" />
                        </div>
                      )}
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h3 className="text-white font-medium text-sm truncate">
                          {item.vod_name}
                        </h3>
                        {getEpisodeInfo(item) && (
                          <p className="text-gray-400 text-xs truncate mt-1">
                            {getEpisodeInfo(item)}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          {item.sourceName && (
                            <span className="text-blue-400 text-xs truncate max-w-[60%]">
                              {item.sourceName}
                            </span>
                          )}
                          <p className="text-gray-500 text-xs">
                            {formatTime(item.timestamp)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="absolute top-2 left-2 w-8 h-8 bg-blue-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    
                    <div className="p-2 border-t border-gray-700/50 flex-shrink-0">
                      <button
                        onClick={(e) => handleRemove(item.id, e)}
                        className="w-full py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showClearConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-gray-800 rounded-xl p-6 max-w-sm mx-4 border border-gray-700">
                  <h3 className="text-xl font-bold text-white mb-4">确认清空</h3>
                  <p className="text-gray-400 mb-6">确定要清空所有观看历史吗？此操作不可恢复。</p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleClear}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      确认清空
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
