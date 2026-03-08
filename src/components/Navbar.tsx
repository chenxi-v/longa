'use client';

import Link from 'next/link';
import { Settings, Play, Film, Radio, History } from 'lucide-react';

const Navbar = () => {
  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center bg-gray-900/90 backdrop-blur-xl rounded-full border border-gray-700/50 shadow-lg shadow-black/20 px-2 py-1.5">

        <div className="flex items-center justify-center gap-1 w-[120px]">
          <Link
            href="/player"
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-blue-500/20 transition-all duration-200 group"
            title="播放器"
          >
            <Play className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors" />
          </Link>
          <Link
            href="/api-videos"
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-purple-500/20 transition-all duration-200 group"
            title="API视频"
          >
            <Film className="w-4 h-4 text-gray-400 group-hover:text-purple-400 transition-colors" />
          </Link>
          <Link
            href="/spider-videos"
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-green-500/20 transition-all duration-200 group"
            title="爬虫API"
          >
            <Radio className="w-4 h-4 text-gray-400 group-hover:text-green-400 transition-colors" />
          </Link>
        </div>

        <div className="w-px h-6 bg-gray-700/50"></div>

        <div className="flex items-center justify-center px-6 min-w-[100px]">
          <Link href="/" className="flex items-center gap-1 group">
            <span className="text-lg font-bold text-white group-hover:scale-105 transition-transform">
              Long<span className="text-blue-400">TV</span>
            </span>
          </Link>
        </div>

        <div className="w-px h-6 bg-gray-700/50"></div>

        <div className="flex items-center justify-center gap-1 w-[120px]">
          <Link
            href="/history"
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-orange-500/20 transition-all duration-200 group"
            title="观看历史"
          >
            <History className="w-4 h-4 text-gray-400 group-hover:text-orange-400 transition-colors" />
          </Link>
          <Link
            href="/settings"
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-500/20 transition-all duration-200 group"
            title="设置"
          >
            <Settings className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
          </Link>
        </div>

      </div>
    </nav>
  );
};

export default Navbar;
