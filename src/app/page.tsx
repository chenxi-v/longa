'use client';

import { useState, useEffect } from 'react';
import PageTransition from '@/components/PageTransition';
import { VideoSource } from '@/api/client';

export default function Home() {
  const [videoSources, setVideoSources] = useState<VideoSource[] | undefined>(undefined);

  useEffect(() => {
    const stored = localStorage.getItem('videoSources');
    if (stored) {
      const sources = JSON.parse(stored);
      const enabledSources = sources.filter((s: VideoSource) => s.enabled !== false);
      setVideoSources(enabledSources);
    } else {
      setVideoSources([]);
    }
  }, []);

  return (
    <PageTransition>
      <div className="min-h-screen relative">
        <div className="relative" style={{ zIndex: 10 }}>
          <header className="min-h-[calc(50vh+3.5rem)] flex items-center justify-center px-4 sm:px-6 pt-20 sm:pt-20">
            <div className="w-full max-w-2xl px-2 sm:px-4 text-center">
              <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                Long<span className="text-blue-400">TV</span>
              </h1>
              <p className="text-gray-400 text-lg">视频聚合平台</p>
            </div>
          </header>

          <main className="flex-1 px-4 sm:px-6 pb-8">
            {videoSources !== undefined && videoSources.length === 0 && (
              <div className="max-w-2xl mx-auto mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                <p className="text-yellow-400 text-center">请先在设置中配置并启用视频源</p>
              </div>
            )}
            
            {videoSources !== undefined && videoSources.length > 0 && (
              <div className="max-w-2xl mx-auto">
              </div>
            )}
          </main>
        </div>
      </div>
    </PageTransition>
  );
}
