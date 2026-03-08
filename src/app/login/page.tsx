'use client';

import { Lock, User, AlertCircle, Sparkles } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { isCloudStorage } from '@/utils/storage';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const apiPath = typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ? '/local-api/login' : '/api/login';
        const res = await fetch(apiPath);
        const data = await res.json();
        if (data.authenticated) {
          const redirect = searchParams.get('redirect') || '/';
          router.replace(redirect);
        }
      } catch {
        // Not authenticated, show login form
      }
    };
    checkAuth();
  }, [router, searchParams]);

  const syncDataFromCloud = async (user: string) => {
    try {
      const apiPath = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? '/local-api/data' : '/api/data';
      const res = await fetch(`${apiPath}?action=all&username=${encodeURIComponent(user)}`);
      const data = await res.json();

      if (data.watchHistory && data.watchHistory.length > 0) {
        localStorage.setItem('watch_history', JSON.stringify(data.watchHistory));
      }

      if (data.searchHistory && data.searchHistory.length > 0) {
        const items = (data.searchHistory as string[]).map((keyword) => ({
          keyword,
          timestamp: Date.now(),
        }));
        localStorage.setItem('search_history', JSON.stringify(items));
      }

      if (data.videoSources && data.videoSources.length > 0) {
        localStorage.setItem('videoSources', JSON.stringify(data.videoSources));
      }

      if (data.proxySettings) {
        localStorage.setItem('proxySettings', JSON.stringify(data.proxySettings));
      }
    } catch {
      // Ignore sync errors
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!password || !username) return;

    try {
      setLoading(true);
      const apiPath = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? '/local-api/login' : '/api/login';
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        if (isCloudStorage()) {
          await syncDataFromCloud(username);
        }
        
        const redirect = searchParams.get('redirect') || '/';
        window.location.href = redirect;
        return;
      } else if (res.status === 500 && data.error?.includes('未配置')) {
        setNotConfigured(true);
      } else {
        setError(data.error ?? '登录失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (notConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="max-w-md w-full p-8 bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg shadow-red-500/30">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">系统未配置</h1>
            <p className="text-gray-400 mb-6">
              请在环境变量中配置 ADMIN_USERNAME 和 ADMIN_PASSWORD 后重试
            </p>
            <div className="bg-gray-900/50 rounded-lg p-4 text-left">
              <p className="text-sm text-gray-500 mb-2">需要配置的环境变量：</p>
              <code className="text-xs text-cyan-400 block mb-1">ADMIN_USERNAME=您的用户名</code>
              <code className="text-xs text-cyan-400 block">ADMIN_PASSWORD=您的密码</code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-md w-full p-8 bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-500 shadow-lg shadow-blue-500/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">LongTV</h1>
          <p className="text-gray-400">欢迎回来，请登录您的账户</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
              用户名
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-500" />
              </div>
              <input
                id="username"
                type="text"
                autoComplete="username"
                className="block w-full pl-12 pr-4 py-3 rounded-xl border border-gray-600 bg-gray-700/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              密码
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-500" />
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="block w-full pl-12 pr-4 py-3 rounded-xl border border-gray-600 bg-gray-700/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 border border-red-500/50">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!password || !username || loading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 hover:from-blue-600 hover:via-sky-600 hover:to-cyan-600 text-white font-semibold shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '登录中...' : '立即登录'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
