'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronRight, Plus, Trash2, Edit, X, Power, Video, Globe, Database, CheckCircle, XCircle, RefreshCw, User, LogOut, Cloud, CloudOff, Radio } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PageTransition from '@/components/PageTransition';
import { VideoSource, ProxySettings } from '@/api/client';
import { VideoSourcesStorage, ProxySettingsStorage, SpiderProxySettingsStorage, syncAllFromCloud, isCloudStorage } from '@/utils/storage';
import {
  getSpiderSourceCards,
  saveSpiderSourceCards,
  fetchSpiderConfigs,
  checkBackendConnection,
  toggleSpiderConfig
} from '@/api/spiderClient';
import { SpiderSourceCard } from '@/api/spider';

interface DbStatus {
  connected: boolean;
  type: string;
  latency?: number;
  message: string;
  error?: string;
}

interface AuthStatus {
  authenticated: boolean;
  username?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState('video-sources');
  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [proxySettings, setProxySettings] = useState<ProxySettings>({
    enabled: false,
    proxyUrl: ''
  });
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<'success' | 'error' | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSource, setEditingSource] = useState<VideoSource | null>(null);
  const [formData, setFormData] = useState({ name: '', key: '', apiUrl: '' });
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [isCheckingDb, setIsCheckingDb] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ authenticated: false });
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // 爬虫API相关状态
  const [spiderSourceCards, setSpiderSourceCards] = useState<SpiderSourceCard[]>([]);
  const [backendConnected, setBackendConnected] = useState(false);
  const [spiderProxySettings, setSpiderProxySettings] = useState({
    enabled: false,
    workerUrl: ''
  });
  const [isCheckingSpiderProxy, setIsCheckingSpiderProxy] = useState(false);
  const [spiderProxyCheckResult, setSpiderProxyCheckResult] = useState<'success' | 'error' | null>(null);

  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('videoSources');
    if (stored) {
      setVideoSources(JSON.parse(stored));
    }

    const proxyStored = localStorage.getItem('proxySettings');
    if (proxyStored) {
      setProxySettings(JSON.parse(proxyStored));
    }

    const spiderProxyStored = localStorage.getItem('spiderProxySettings');
    if (spiderProxyStored) {
      const storedSettings = JSON.parse(spiderProxyStored);
      setSpiderProxySettings(storedSettings);
      
      // 同步代理设置到后端
      if (storedSettings.enabled && storedSettings.workerUrl) {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        fetch(`${API_BASE_URL}/api/spider/set-proxy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            spider_proxy_url: storedSettings.workerUrl
          })
        }).catch(console.error);
      }
    }

    const tabStored = localStorage.getItem('settingsSelectedTab');
    if (tabStored) {
      setSelectedTab(tabStored);
    }

    // 检查后端连接状态并获取爬虫配置
    checkBackendStatus();

    fetchDbStatus();
    fetchAuthStatus();
  }, []);

  // 定期检查后端连接状态
  useEffect(() => {
    const interval = setInterval(() => {
      checkBackendStatus();
    }, 10000); // 每10秒检查一次

    return () => clearInterval(interval);
  }, []);

  const checkBackendStatus = async () => {
    const connected = await checkBackendConnection();
    setBackendConnected(connected);

    if (connected) {
      // 从后端获取最新配置
      const configs = await fetchSpiderConfigs();
      
      // 检查后端智能代理状态
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      let backendProxyEnabled = false;
      
      try {
        const proxyResponse = await fetch(`${API_BASE_URL}/api/smart-proxy/get-url`);
        if (proxyResponse.ok) {
          const proxyData = await proxyResponse.json();
          backendProxyEnabled = !!proxyData.data?.proxy_url;
        }
      } catch (error) {
        console.error('检查后端代理状态失败:', error);
      }
      
      // 从localStorage读取用户设置（代理开关等）
      const storedCards = localStorage.getItem('spiderSourceCards');
      let storedCardsData: SpiderSourceCard[] = [];
      if (storedCards) {
        storedCardsData = JSON.parse(storedCards);
      }
      
      // 合并后端配置和用户设置
      const cards: SpiderSourceCard[] = configs.map(config => {
        const stored = storedCardsData.find(s => s.key === config.key);
        return {
          key: config.key,
          name: config.name,
          connected: true,
          enabled: config.enabled,
          // 如果后端代理已启用，前端也显示为启用
          proxyEnabled: stored?.proxyEnabled || backendProxyEnabled
        };
      });
      
      // 保存到localStorage
      localStorage.setItem('spiderSourceCards', JSON.stringify(cards));
      setSpiderSourceCards(cards);
    } else {
      // 后端断开，清空卡片
      setSpiderSourceCards([]);
    }
  };

  const fetchAuthStatus = async () => {
    try {
      const apiPath = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? '/local-api/login' : '/api/login';
      const res = await fetch(apiPath);
      const data = await res.json();
      setAuthStatus(data);
    } catch {
      setAuthStatus({ authenticated: false });
    }
  };

  const fetchDbStatus = async () => {
    setIsCheckingDb(true);
    try {
      const apiPath = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? '/local-api/db-status' : '/api/db-status';
      const res = await fetch(apiPath);
      const data = await res.json();
      setDbStatus(data);
    } catch {
      setDbStatus({
        connected: false,
        type: 'unknown',
        message: '获取数据库状态失败',
      });
    } finally {
      setIsCheckingDb(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const apiPath = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? '/local-api/logout' : '/api/logout';
      await fetch(apiPath, { method: 'POST' });
      setAuthStatus({ authenticated: false });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSyncFromCloud = async () => {
    setIsSyncing(true);
    try {
      await syncAllFromCloud();
      const stored = localStorage.getItem('videoSources');
      if (stored) {
        setVideoSources(JSON.parse(stored));
      }
      const proxyStored = localStorage.getItem('proxySettings');
      if (proxyStored) {
        setProxySettings(JSON.parse(proxyStored));
      }
      alert('数据同步成功！');
    } catch (error) {
      console.error('Sync failed:', error);
      alert('数据同步失败，请重试');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('settingsSelectedTab', selectedTab);
  }, [selectedTab]);

  useEffect(() => {
    const updateIndicator = () => {
      const button = buttonRefs.current[selectedTab];
      const nav = navRef.current;
      if (button && nav) {
        const navRect = nav.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        setIndicatorStyle({
          left: buttonRect.left - navRect.left,
          width: buttonRect.width
        });
      }
    };
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [selectedTab]);

  const saveToLocalStorage = (sources: VideoSource[]) => {
    localStorage.setItem('videoSources', JSON.stringify(sources));
    VideoSourcesStorage.syncToCloud(sources).catch(console.error);
  };

  const saveProxySettings = (settings: ProxySettings) => {
    localStorage.setItem('proxySettings', JSON.stringify(settings));
    ProxySettingsStorage.syncToCloud(settings).catch(console.error);
    setProxySettings(settings);
  };

  const handleCheckProxyStatus = async () => {
    if (!proxySettings.enabled || !proxySettings.proxyUrl) {
      alert('请先启用代理并配置 Worker 地址');
      return;
    }

    setIsChecking(true);
    setCheckResult(null);

    try {
      const testUrl = `${proxySettings.proxyUrl.replace(/\/$/, '')}/https://httpbin.org/get`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setCheckResult('success');
        alert('Cloudflare Worker 代理连接正常');
      } else {
        setCheckResult('error');
        alert(`代理连接失败: HTTP ${response.status}`);
      }
    } catch (error) {
      setCheckResult('error');
      const message = error instanceof Error ? error.message : '未知错误';
      alert(`代理连接失败: ${message}`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSaveProxySettings = () => {
    if (proxySettings.enabled && !proxySettings.proxyUrl) {
      alert('请配置 Worker 地址');
      return;
    }

    if (proxySettings.enabled && proxySettings.proxyUrl) {
      try {
        new URL(proxySettings.proxyUrl);
      } catch {
        alert('Worker 地址格式不正确');
        return;
      }
    }

    saveProxySettings({
      enabled: proxySettings.enabled,
      proxyUrl: proxySettings.proxyUrl?.trim() || '',
    });

    alert('代理配置已保存');
  };

  const saveSpiderProxySettings = (settings: typeof spiderProxySettings) => {
    localStorage.setItem('spiderProxySettings', JSON.stringify(settings));
    setSpiderProxySettings(settings);

    // 同步到云端
    SpiderProxySettingsStorage.syncToCloud(settings).catch(console.error);

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    if (settings.enabled && settings.workerUrl) {
      fetch(`${API_BASE_URL}/api/spider/set-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spider_proxy_url: settings.workerUrl
        })
      }).catch(console.error);
    } else {
      fetch(`${API_BASE_URL}/api/spider/set-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spider_proxy_url: null
        })
      }).catch(console.error);
    }
  };

  const handleCheckSpiderProxyStatus = async () => {
    if (!spiderProxySettings.enabled || !spiderProxySettings.workerUrl) {
      alert('请先启用爬虫API加速并配置 Worker 地址');
      return;
    }

    setIsCheckingSpiderProxy(true);
    setSpiderProxyCheckResult(null);

    try {
      const testUrl = `${spiderProxySettings.workerUrl.replace(/\/$/, '')}?targetUrl=https://httpbin.org/get`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setSpiderProxyCheckResult('success');
        alert('爬虫API加速 Worker 连接正常');
      } else {
        setSpiderProxyCheckResult('error');
        alert(`Worker 连接失败: HTTP ${response.status}`);
      }
    } catch (error) {
      setSpiderProxyCheckResult('error');
      const message = error instanceof Error ? error.message : '未知错误';
      alert(`Worker 连接失败: ${message}`);
    } finally {
      setIsCheckingSpiderProxy(false);
    }
  };

  const handleSaveSpiderProxySettings = () => {
    if (spiderProxySettings.enabled && !spiderProxySettings.workerUrl) {
      alert('请输入 Cloudflare Worker 地址');
      return;
    }

    if (spiderProxySettings.enabled && spiderProxySettings.workerUrl) {
      try {
        new URL(spiderProxySettings.workerUrl);
      } catch {
        alert('请输入有效的 URL 地址');
        return;
      }
    }

    saveSpiderProxySettings({
      enabled: spiderProxySettings.enabled,
      workerUrl: spiderProxySettings.workerUrl?.trim() || '',
    });
    alert('爬虫API加速设置已保存');
  };

  const handleAddClick = () => {
    setEditingSource(null);
    setFormData({ name: '', key: '', apiUrl: '' });
    setShowModal(true);
  };

  const handleEditClick = (source: VideoSource) => {
    setEditingSource(source);
    setFormData({ 
      name: source.name, 
      key: source.key, 
      apiUrl: source.apiUrl
    });
    setShowModal(true);
  };

  const handleDeleteClick = (id: string) => {
    const newSources = videoSources.filter(s => s.id !== id);
    setVideoSources(newSources);
    saveToLocalStorage(newSources);
  };

  const handleToggleEnabled = (id: string) => {
    const newSources = videoSources.map(s => 
      s.id === id 
        ? { ...s, enabled: s.enabled === undefined ? false : !s.enabled }
        : s
    );
    setVideoSources(newSources);
    saveToLocalStorage(newSources);
  };

  const handleToggleAllEnabled = (enabled: boolean) => {
    const newSources = videoSources.map(s => ({ ...s, enabled }));
    setVideoSources(newSources);
    saveToLocalStorage(newSources);
  };

  const handleToggleProxy = (id: string) => {
    const newSources = videoSources.map(s => 
      s.id === id 
        ? { ...s, proxyEnabled: s.proxyEnabled === false ? undefined : false }
        : s
    );
    setVideoSources(newSources);
    saveToLocalStorage(newSources);
  };

  const allEnabled = videoSources.every(s => s.enabled !== false);
  const hasSources = videoSources.length > 0;

  const handleSave = () => {
    if (!formData.name || !formData.key || !formData.apiUrl) {
      alert('请填写所有字段');
      return;
    }

    if (editingSource) {
      const newSources = videoSources.map(s => 
        s.id === editingSource.id 
          ? { ...s, name: formData.name, key: formData.key, apiUrl: formData.apiUrl }
          : s
      );
      setVideoSources(newSources);
      saveToLocalStorage(newSources);
    } else {
      const newSource: VideoSource = {
        id: Date.now().toString(),
        name: formData.name,
        key: formData.key,
        apiUrl: formData.apiUrl
      };
      const newSources = [...videoSources, newSource];
      setVideoSources(newSources);
      saveToLocalStorage(newSources);
    }

    setShowModal(false);
    setFormData({ name: '', key: '', apiUrl: '' });
    setEditingSource(null);
  };

  const navItems = [
    { id: 'video-sources', label: '视频源配置', icon: Video },
    { id: 'spider-sources', label: '爬虫API', icon: Radio },
    { id: 'proxy-settings', label: '代理设置', icon: Globe },
    { id: 'database', label: '数据库', icon: Database },
    { id: 'account', label: '账户', icon: User },
  ];

  // 爬虫API相关处理函数
  const handleToggleSpiderEnabled = async (key: string, enabled: boolean) => {
    const success = await toggleSpiderConfig(key, enabled);
    if (success) {
      // 更新本地状态
      const updatedCards = spiderSourceCards.map(card =>
        card.key === key ? { ...card, enabled } : card
      );
      setSpiderSourceCards(updatedCards);
    }
  };

  const handleToggleSpiderProxy = async (key: string, proxyEnabled: boolean) => {
    // 更新本地状态
    const updatedCards = spiderSourceCards.map(card =>
      card.key === key ? { ...card, proxyEnabled } : card
    );
    setSpiderSourceCards(updatedCards);
    
    // 保存到localStorage
    localStorage.setItem('spiderSourceCards', JSON.stringify(updatedCards));
    
    console.log('代理状态已保存:', key, proxyEnabled);
  };

  return (
    <PageTransition>
      <div className="min-h-screen relative">
        <div className="relative" style={{ zIndex: 10 }}>
          <div className="max-w-6xl mx-auto px-4 py-20 sm:py-24">
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between mb-8 gap-4">
              <h1 className="text-3xl sm:text-4xl font-bold text-white">
                设置
              </h1>
              <Link 
                href="/" 
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 text-white rounded-full hover:from-blue-600 hover:via-sky-600 hover:to-cyan-600 transition-all duration-300"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
                返回首页
              </Link>
            </div>
            
            <div className="flex flex-col gap-6">
              <nav 
                ref={navRef}
                className="relative flex justify-center p-1.5 bg-gray-800/50 backdrop-blur-sm rounded-full border border-gray-700/50"
              >
                <div 
                  className="absolute top-1.5 h-[calc(100%-12px)] bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 rounded-full shadow-lg shadow-blue-500/30 transition-all duration-300 ease-out"
                  style={{
                    left: `${indicatorStyle.left}px`,
                    width: `${indicatorStyle.width}px`
                  }}
                />
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    ref={(el) => { buttonRefs.current[item.id] = el; }}
                    onClick={() => setSelectedTab(item.id)}
                    className={`relative z-10 flex-1 sm:flex-none px-3 sm:px-6 py-2.5 rounded-full flex items-center justify-center sm:justify-start gap-2 transition-colors duration-200 ${
                      selectedTab === item.id 
                        ? 'text-white' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <item.icon className="w-5 h-5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline font-medium">{item.label}</span>
                  </button>
                ))}
              </nav>
              
              <main className="flex-1">
                {selectedTab === 'video-sources' && (
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                    <h2 className="text-xl font-semibold text-white mb-6">视频源配置</h2>
                    
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          普通API
                        </h3>
                        <div className="flex items-center gap-3">
                          {hasSources && (
                            <button
                              onClick={() => handleToggleAllEnabled(!allEnabled)}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                allEnabled
                                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              }`}
                            >
                              <Power className="w-4 h-4" />
                              {allEnabled ? '全部禁用' : '全部启用'}
                            </button>
                          )}
                          <button 
                            onClick={handleAddClick}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:via-sky-600 hover:to-cyan-600 transition-all duration-300"
                          >
                            <Plus className="w-4 h-4" />
                            添加源
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {videoSources
                          .map((source) => (
                            <div 
                              key={source.id}
                              className={`flex items-center justify-between p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all shadow-lg ${
                                source.enabled === false ? 'opacity-50' : ''
                              }`}
                            >
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-white font-medium truncate">{source.name}</h3>
                                  <p className="text-gray-400 text-sm truncate">Key: {source.key}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                <button
                                  onClick={() => handleToggleProxy(source.id)}
                                  className={`p-2 rounded-lg transition-colors ${
                                    source.proxyEnabled === false
                                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                      : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                  }`}
                                  title={source.proxyEnabled === false ? '代理已关闭' : '代理已开启'}
                                >
                                  <Globe className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleEnabled(source.id)}
                                  className={`p-2 rounded-lg transition-colors ${
                                    source.enabled === false
                                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                      : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                  }`}
                                  title={source.enabled === false ? '已禁用' : '已启用'}
                                >
                                  <Power className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleEditClick(source)}
                                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-600/50 rounded-lg transition-colors"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteClick(source.id)}
                                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                      
                      {videoSources.length === 0 && (
                        <div className="text-center py-6 text-gray-400 text-sm">
                          暂无视频源
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedTab === 'spider-sources' && (
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-xl font-semibold text-white">爬虫API配置</h2>
                        <p className="text-sm text-gray-400 mt-1">
                          后端状态: {backendConnected ? (
                            <span className="text-green-400">已连接</span>
                          ) : (
                            <span className="text-red-400">未连接</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {!backendConnected && (
                      <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-sm text-yellow-400">
                          ⚠️ 后端未连接，无法获取爬虫配置。请确保后端服务正在运行。
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {spiderSourceCards.map((card) => (
                        <div
                          key={card.key}
                          className={`flex items-center justify-between p-4 bg-white/5 backdrop-blur-md rounded-xl border transition-all shadow-lg ${
                            card.enabled !== false
                              ? 'border-white/10 hover:border-white/20 hover:bg-white/10'
                              : 'border-gray-600/50 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className={`w-3 h-3 rounded-full ${card.enabled !== false ? 'bg-green-500' : 'bg-gray-500'}`} />
                            <div className="flex-1 min-w-0">
                              <h3 className="text-white font-medium truncate">{card.name}</h3>
                              <p className="text-gray-400 text-sm truncate">Key: {card.key}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => handleToggleSpiderProxy(card.key, !card.proxyEnabled)}
                              className={`p-2 rounded-lg transition-colors ${
                                card.proxyEnabled
                                  ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                  : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                              }`}
                              title={card.proxyEnabled ? '已启用代理' : '未启用代理'}
                            >
                              <Cloud className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleSpiderEnabled(card.key, card.enabled === false)}
                              className={`p-2 rounded-lg transition-colors ${
                                card.enabled === false
                                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              }`}
                              title={card.enabled === false ? '已禁用' : '已启用'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {spiderSourceCards.length === 0 && backendConnected && (
                        <div className="text-center py-12 text-gray-400">
                          <Radio className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>暂无爬虫源配置</p>
                          <p className="text-sm mt-1">请在后端添加爬虫配置</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <h4 className="text-blue-400 font-medium mb-2">使用说明</h4>
                      <ul className="text-sm text-blue-300/80 space-y-1">
                        <li>• 爬虫API由后端自动映射到前端</li>
                        <li>• 可以通过开关控制爬虫源的启用状态</li>
                        <li>• 禁用的爬虫源不会在爬虫API页面显示</li>
                        <li>• 配置文件存储在后端的JSON文件中</li>
                        <li>• 云朵图标为独立代理开关，开启后该爬虫将使用加速代理</li>
                        <li>• 需要先在"代理设置"中配置爬虫API加速Worker地址</li>
                      </ul>
                    </div>
                  </div>
                )}

                {selectedTab === 'proxy-settings' && (
                  <div className="space-y-6">
                    {/* 普通API代理设置 */}
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                      <h2 className="text-xl font-semibold text-white mb-6">普通API代理加速</h2>
                      
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10">
                          <div className="flex-1">
                            <h3 className="text-white font-medium mb-1">启用代理</h3>
                            <p className="text-gray-400 text-sm">开启后所有普通API请求将通过Cloudflare Worker转发</p>
                          </div>
                          <button
                            onClick={() => saveProxySettings({ ...proxySettings, enabled: !proxySettings.enabled })}
                            className={`relative w-14 h-8 rounded-full transition-colors duration-300 focus:outline-none ${
                              proxySettings.enabled
                                ? 'bg-green-500'
                                : 'bg-gray-600'
                            }`}
                          >
                            <span
                              className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                                proxySettings.enabled
                                  ? 'translate-x-6'
                                  : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        {proxySettings.enabled && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Cloudflare Worker 地址</label>
                              <input
                                type="text"
                                value={proxySettings.proxyUrl}
                                onChange={(e) => setProxySettings({ ...proxySettings, proxyUrl: e.target.value })}
                                placeholder="https://your-worker.your-subdomain.workers.dev"
                                className="w-full px-4 py-3 bg-gray-700/50 text-white placeholder-gray-500 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>

                            <div className="flex gap-3">
                              <button
                                onClick={handleSaveProxySettings}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 hover:from-blue-600 hover:via-sky-600 hover:to-cyan-600 text-white rounded-lg transition-all duration-300"
                              >
                                保存配置
                              </button>
                              <button
                                onClick={handleCheckProxyStatus}
                                disabled={isChecking}
                                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                              >
                                {isChecking ? '测试中...' : '测试连接'}
                              </button>
                            </div>

                            {checkResult && (
                              <div className={`p-4 rounded-lg border ${
                                checkResult === 'success'
                                  ? 'bg-green-500/10 border-green-500/30'
                                  : 'bg-red-500/10 border-red-500/30'
                              }`}>
                                <p className={checkResult === 'success' ? 'text-green-400' : 'text-red-400'}>
                                  {checkResult === 'success' ? '✅ 代理连接成功' : '❌ 代理连接失败'}
                                </p>
                              </div>
                            )}

                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                              <p className="text-blue-400 text-sm">
                                💡 Cloudflare Worker 可以加速 API 请求，解决跨域问题。需要先部署 Worker 代理服务。
                              </p>
                            </div>
                          </>
                        )}

                        {!proxySettings.enabled && (
                          <div className="p-6 text-center bg-white/5 backdrop-blur-md rounded-xl border border-white/10">
                            <svg className="w-12 h-12 mx-auto mb-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm text-white">普通API代理加速未启用</p>
                            <p className="text-xs mt-1 text-gray-300">开启后将为所有视频源使用 Cloudflare Worker 加速</p>
                            <p className="text-xs mt-1 text-gray-300">也可在视频源管理中为单个源配置代理</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 爬虫API代理说明 */}
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                      <h2 className="text-xl font-semibold text-white mb-6">爬虫API代理加速</h2>
                      
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <p className="text-blue-400 text-sm mb-3">
                          💡 爬虫API代理已通过后端环境变量配置
                        </p>
                        <p className="text-blue-300/80 text-sm">
                          代理地址：https://corspy.longz.cc.cd
                        </p>
                        <p className="text-blue-300/80 text-sm mt-2">
                          点击爬虫源卡片的云朵图标 ☁️ 即可为该爬虫开启/关闭代理
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedTab === 'database' && (
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                    <h2 className="text-xl font-semibold text-white mb-6">数据库状态</h2>
                    
                    <div className="space-y-6">
                      <div className={`p-6 rounded-xl border ${
                        dbStatus?.connected 
                          ? 'bg-green-500/10 border-green-500/30' 
                          : 'bg-gray-700/30 border-gray-600/50'
                      }`}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            {dbStatus?.connected ? (
                              <CheckCircle className="w-8 h-8 text-green-400" />
                            ) : (
                              <XCircle className="w-8 h-8 text-gray-400" />
                            )}
                            <div>
                              <h3 className="text-lg font-medium text-white">
                                {dbStatus?.connected ? '已连接云端数据库' : '未连接云端数据库'}
                              </h3>
                              <p className="text-sm text-gray-400">
                                存储类型: {dbStatus?.type || 'localstorage'}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={fetchDbStatus}
                            disabled={isCheckingDb}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-600/50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`w-5 h-5 ${isCheckingDb ? 'animate-spin' : ''}`} />
                          </button>
                        </div>

                        {dbStatus?.connected && dbStatus.latency !== undefined && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-400">延迟:</span>
                            <span className={`font-medium ${
                              dbStatus.latency < 100 ? 'text-green-400' :
                              dbStatus.latency < 300 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {dbStatus.latency}ms
                            </span>
                          </div>
                        )}

                        {dbStatus?.error && (
                          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <p className="text-sm text-red-400">{dbStatus.error}</p>
                          </div>
                        )}
                      </div>

                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <h4 className="text-blue-400 font-medium mb-2">配置说明</h4>
                        <ul className="text-sm text-blue-300/80 space-y-1">
                          <li>• 设置 <code className="bg-blue-500/20 px-1 rounded">NEXT_PUBLIC_STORAGE_TYPE=upstash</code> 启用云端数据库</li>
                          <li>• 配置 <code className="bg-blue-500/20 px-1 rounded">UPSTASH_URL</code> 和 <code className="bg-blue-500/20 px-1 rounded">UPSTASH_TOKEN</code> 连接数据库</li>
                          <li>• 未配置时默认使用本地浏览器存储</li>
                        </ul>
                      </div>

                      {dbStatus?.type === 'localstorage' && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                          <p className="text-sm text-yellow-400">
                            💡 当前使用本地浏览器存储，数据仅保存在当前浏览器中。配置云端数据库后可在多设备间同步数据。
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedTab === 'account' && (
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
                    <h2 className="text-xl font-semibold text-white mb-6">账户管理</h2>
                    
                    <div className="space-y-6">
                      <div className={`p-6 rounded-xl border ${
                        authStatus.authenticated 
                          ? 'bg-green-500/10 border-green-500/30' 
                          : 'bg-gray-700/30 border-gray-600/50'
                      }`}>
                        <div className="flex items-center gap-3 mb-4">
                          {authStatus.authenticated ? (
                            <CheckCircle className="w-8 h-8 text-green-400" />
                          ) : (
                            <XCircle className="w-8 h-8 text-gray-400" />
                          )}
                          <div>
                            <h3 className="text-lg font-medium text-white">
                              {authStatus.authenticated ? '已登录' : '未登录'}
                            </h3>
                            {authStatus.username && (
                              <p className="text-sm text-gray-400">
                                用户名: {authStatus.username}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {isCloudStorage() && authStatus.authenticated && (
                        <div className="p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Cloud className="w-6 h-6 text-blue-400" />
                              <div>
                                <h4 className="text-white font-medium">云端数据同步</h4>
                                <p className="text-sm text-gray-400">从云端拉取最新数据到本地</p>
                              </div>
                            </div>
                            <button
                              onClick={handleSyncFromCloud}
                              disabled={isSyncing}
                              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:via-sky-600 hover:to-cyan-600 transition-all duration-300 disabled:opacity-50"
                            >
                              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                              {isSyncing ? '同步中...' : '立即同步'}
                            </button>
                          </div>
                        </div>
                      )}

                      {!isCloudStorage() && (
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <CloudOff className="w-5 h-5 text-yellow-400" />
                            <p className="text-sm text-yellow-400">
                              云端数据库未启用，数据仅保存在本地浏览器中
                            </p>
                          </div>
                        </div>
                      )}

                      {authStatus.authenticated ? (
                        <button
                          onClick={handleLogout}
                          disabled={isLoggingOut}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <LogOut className="w-5 h-5" />
                          {isLoggingOut ? '退出中...' : '退出登录'}
                        </button>
                      ) : (
                        <button
                          onClick={() => router.push('/login')}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:via-sky-600 hover:to-cyan-600 transition-all duration-300"
                        >
                          <User className="w-5 h-5" />
                          立即登录
                        </button>
                      )}

                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <h4 className="text-blue-400 font-medium mb-2">数据同步说明</h4>
                        <ul className="text-sm text-blue-300/80 space-y-1">
                          <li>• 登录后数据会自动同步到云端数据库</li>
                          <li>• 在其他设备登录同一账户可获取同步数据</li>
                          <li>• 修改设置后会自动保存到云端</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </main>
            </div>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
            <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
              <button 
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-xl font-semibold text-white mb-6">
                {editingSource ? '编辑视频源' : '添加视频源'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">名称</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="输入视频源名称"
                    className="w-full px-4 py-3 bg-gray-700/50 text-white placeholder-gray-500 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Key</label>
                  <input
                    type="text"
                    value={formData.key}
                    onChange={(e) => setFormData({...formData, key: e.target.value})}
                    placeholder="输入唯一标识 Key"
                    className="w-full px-4 py-3 bg-gray-700/50 text-white placeholder-gray-500 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">API 地址</label>
                  <input
                    type="text"
                    value={formData.apiUrl}
                    onChange={(e) => setFormData({...formData, apiUrl: e.target.value})}
                    placeholder="https://api.example.com"
                    className="w-full px-4 py-3 bg-gray-700/50 text-white placeholder-gray-500 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 hover:from-blue-600 hover:via-sky-600 hover:to-cyan-600 text-white rounded-lg transition-all duration-300"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
