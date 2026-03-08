'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Radio, Clock, Calendar, Star, Play, X, Menu, Search, AlertCircle, Cloud } from 'lucide-react';
import Link from 'next/link';
import PageTransition from '@/components/PageTransition';
import {
  SpiderSourceCard,
  SpiderCategory,
  SpiderVideoItem,
  SpiderFilter
} from '@/api/spider';
import {
  fetchSpiderConfigs,
  fetchSpiderHome,
  fetchSpiderCategory,
  fetchSpiderDetail,
  fetchSpiderSearch,
  checkBackendConnection,
  getProxyImageUrl
} from '@/api/spiderClient';

function SpiderVideosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [spiderSourceCards, setSpiderSourceCards] = useState<SpiderSourceCard[]>([]);
  const [selectedSource, setSelectedSource] = useState<SpiderSourceCard | null>(null);
  const [categories, setCategories] = useState<SpiderCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [videos, setVideos] = useState<SpiderVideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, SpiderFilter[]>>({});
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // 初始化
  useEffect(() => {
    let mounted = true;
    
    // 检查后端连接
    const initSpiderSources = async () => {
      const connected = await checkBackendConnection();
      if (!mounted) return;
      
      setBackendConnected(connected);

      if (connected) {
        // 从后端获取最新配置
        const configs = await fetchSpiderConfigs();
        if (!mounted) return;
        
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
        const cards: SpiderSourceCard[] = configs
          .filter(c => c.enabled !== false)
          .map(config => {
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
        
        // 从URL参数恢复状态（只在首次加载时）
        const sourceKey = searchParams.get('source');
        const categoryId = searchParams.get('category');
        const page = searchParams.get('page');
        const filtersParam = searchParams.get('filters');
        
        if (sourceKey) {
          const source = cards.find(c => c.key === sourceKey);
          if (source) {
            setSelectedSource(source);
            
            if (categoryId) {
              setSelectedCategory(parseInt(categoryId));
            }
            
            if (page) {
              setCurrentPage(parseInt(page));
            }
            
            if (filtersParam) {
              try {
                setSelectedFilters(JSON.parse(decodeURIComponent(filtersParam)));
              } catch (e) {
                console.error('解析筛选参数失败:', e);
              }
            }
          }
        }
      }
    };

    initSpiderSources();

    // 定期检查后端连接（不重复获取配置）
    const interval = setInterval(async () => {
      const connected = await checkBackendConnection();
      if (!mounted) return;
      
      setBackendConnected(connected);
      if (!connected) {
        setError('后端连接已断开');
      }
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // 选择第一个已启用的源
  useEffect(() => {
    if (spiderSourceCards.length > 0 && !selectedSource) {
      const firstEnabled = spiderSourceCards.find(c => c.enabled !== false);
      if (firstEnabled) {
        setSelectedSource(firstEnabled);
      }
    }
  }, [spiderSourceCards, selectedSource]);

  // 保存状态到URL参数
  useEffect(() => {
    if (selectedSource) {
      const params = new URLSearchParams();
      params.set('source', selectedSource.key);
      
      if (selectedCategory !== null) {
        params.set('category', selectedCategory.toString());
      }
      
      if (currentPage > 1) {
        params.set('page', currentPage.toString());
      }
      
      if (Object.keys(selectedFilters).length > 0) {
        params.set('filters', encodeURIComponent(JSON.stringify(selectedFilters)));
      }
      
      // 更新URL但不触发导航
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [selectedSource, selectedCategory, currentPage, selectedFilters]);

  // 加载分类
  useEffect(() => {
    if (selectedSource && backendConnected && !isInitialized) {
      loadCategories();
    }
  }, [selectedSource, backendConnected, isInitialized]);

  // 加载视频列表
  useEffect(() => {
    if (selectedSource && selectedCategory !== null && backendConnected && isInitialized) {
      loadVideos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, currentPage, selectedFilters, isInitialized]);

  const loadCategories = async () => {
    if (!selectedSource) return;

    setLoading(true);
    setError('');

    try {
      const homeData = await fetchSpiderHome(selectedSource.key, selectedSource.proxyEnabled || false);
      if (homeData) {
        setCategories(homeData.class || []);
        
        // 设置第一个分类
        if (homeData.class && homeData.class.length > 0) {
          setSelectedCategory(homeData.class[0].type_id);
        }
        
        setVideos(homeData.list || []);
        // 保存筛选数据
        if (homeData.filters) {
          setFilters(homeData.filters);
        }
        
        // 重置筛选选择
        setSelectedFilters({});
      } else {
        setError('加载分类失败');
      }
    } catch (err) {
      setError('加载分类失败');
      console.error(err);
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  };

  const loadVideos = async () => {
    if (!selectedSource || selectedCategory === null) return;

    setLoading(true);
    setError('');

    try {
      const categoryData = await fetchSpiderCategory(
        selectedSource.key,
        selectedCategory.toString(),
        currentPage,
        selectedFilters,
        selectedSource.proxyEnabled || false
      );

      if (categoryData) {
        setVideos(categoryData.list || []);
        setTotalPages(categoryData.pagecount || 1);
        setTotal(categoryData.total || 0);
      } else {
        setError('加载视频列表失败');
      }
    } catch (err) {
      setError('加载视频列表失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoClick = async (video: SpiderVideoItem) => {
    if (!selectedSource) return;

    setLoading(true);

    try {
      const detail = await fetchSpiderDetail(selectedSource.key, [video.vod_id.toString()], selectedSource.proxyEnabled || false);
      if (detail) {
        const encodedData = encodeURIComponent(JSON.stringify({
          ...video,
          ...detail,
          vod_name: detail.vod_name || video.vod_name,
          vod_pic: detail.vod_pic || video.vod_pic,
          vod_remarks: detail.vod_remarks || video.vod_remarks,
          sourceKey: selectedSource.key,
          sourceName: selectedSource.name,
          sourceType: 'spider'
        }));

        router.push(`/player?data=${encodedData}`);
      } else {
        alert('获取视频详情失败');
      }
    } catch (err) {
      console.error('获取视频详情失败:', err);
      alert('获取视频详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSourceSelect = (source: SpiderSourceCard) => {
    setSelectedSource(source);
    setSelectedCategory(null);
    setCategories([]);
    setVideos([]);
    setCurrentPage(1);
    setIsInitialized(false);  // 重置初始化状态，允许重新加载
    setIsSourceModalOpen(false);
  };

  const handleCategorySelect = (categoryId: number) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
    setIsCategoryModalOpen(false);
    // 重置筛选
    setSelectedFilters({});
  };

  const handleFilterChange = (filterKey: string, value: string) => {
    setSelectedFilters(prev => {
      const newFilters = { ...prev };
      if (value === '') {
        delete newFilters[filterKey];
      } else {
        newFilters[filterKey] = value;
      }
      return newFilters;
    });
    setCurrentPage(1);
  };

  const handleSearch = async () => {
    if (!selectedSource || !searchKeyword.trim()) return;

    setIsSearching(true);
    setLoading(true);
    setError('');

    try {
      const searchData = await fetchSpiderSearch(
        selectedSource.key,
        searchKeyword.trim(),
        false,
        selectedSource.proxyEnabled || false
      );

      if (searchData) {
        setVideos(searchData.list || []);
        setTotalPages(searchData.pagecount || 1);
        setTotal(searchData.total || 0);
        // 清除分类选择，显示搜索结果
        setSelectedCategory(null);
      } else {
        setError('搜索失败');
      }
    } catch (err) {
      setError('搜索失败');
      console.error(err);
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchKeyword('');
    setIsSearching(false);
    // 重新加载分类
    if (selectedSource && backendConnected) {
      setIsInitialized(false);
    }
  };

  const handleToggleProxy = async (key: string, proxyEnabled: boolean) => {
    // 更新本地状态
    const updatedCards = spiderSourceCards.map(card =>
      card.key === key ? { ...card, proxyEnabled } : card
    );
    setSpiderSourceCards(updatedCards);
    
    // 更新选中的源
    if (selectedSource?.key === key) {
      setSelectedSource({ ...selectedSource, proxyEnabled });
    }
    
    // 保存到localStorage
    localStorage.setItem('spiderSourceCards', JSON.stringify(updatedCards));
  };

  if (!backendConnected) {
    return (
      <PageTransition>
        <div className="min-h-screen relative">
          <div className="max-w-7xl mx-auto px-4 py-20 sm:py-24">
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">后端未连接</h2>
              <p className="text-gray-400 mb-6">请确保后端服务正在运行</p>
              <Link
                href="/settings"
                className="px-6 py-3 bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:via-sky-600 hover:to-cyan-600 transition-all duration-300"
              >
                前往设置
              </Link>
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (spiderSourceCards.length === 0) {
    return (
      <PageTransition>
        <div className="min-h-screen relative">
          <div className="max-w-7xl mx-auto px-4 py-20 sm:py-24">
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <Radio className="w-16 h-16 text-gray-400 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">暂无爬虫源</h2>
              <p className="text-gray-400 mb-6">请先在设置页面配置爬虫源</p>
              <Link
                href="/settings"
                className="px-6 py-3 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white rounded-lg hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 transition-all duration-300"
              >
                前往设置
              </Link>
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen relative">
        <div className="max-w-7xl mx-auto px-4 py-20 sm:py-24">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-3">
              <Radio className="w-8 h-8 text-green-400" />
              <h1 className="text-3xl sm:text-4xl font-bold text-white">爬虫API</h1>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 text-white rounded-full hover:from-blue-600 hover:via-sky-600 hover:to-cyan-600 transition-all duration-300"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
              返回首页
            </Link>
          </div>

          {/* Source and Category Selection */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <button
              onClick={() => setIsSourceModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700/50 hover:border-gray-600 transition-all"
            >
              <Radio className="w-4 h-4 text-green-400" />
              <span className="text-white">{selectedSource?.name || '选择源'}</span>
              <ChevronRight className="w-4 h-4 text-gray-400 rotate-90" />
            </button>

            {categories.length > 0 && !isSearching && (
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700/50 hover:border-gray-600 transition-all"
              >
                <Menu className="w-4 h-4 text-blue-400" />
                <span className="text-white">
                  {categories.find(c => c.type_id === selectedCategory)?.type_name || '选择分类'}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 rotate-90" />
              </button>
            )}

            {/* Search Box */}
            {selectedSource && (
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="搜索视频..."
                    className="w-full px-4 py-2 pl-10 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700/50 focus:border-green-500/50 focus:outline-none text-white placeholder-gray-400"
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
                {searchKeyword && (
                  <button
                    onClick={handleClearSearch}
                    className="px-3 py-2 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700/50 hover:border-gray-600 transition-all"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
                <button
                  onClick={handleSearch}
                  disabled={!searchKeyword.trim() || loading}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  搜索
                </button>
              </div>
            )}
          </div>

          {/* Search Results Indicator */}
          {isSearching && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-green-400">搜索结果:</span>
              <span className="text-white">"{searchKeyword}"</span>
              <span className="text-gray-400">({videos.length} 个结果)</span>
            </div>
          )}

          {/* Filters */}
          {selectedCategory !== null && filters[selectedCategory.toString()] && (
            <div className="mb-6 space-y-3">
              {filters[selectedCategory.toString()].map((filter) => (
                <div key={filter.key} className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-400 min-w-[60px]">{filter.name}:</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleFilterChange(filter.key, '')}
                      className={`px-3 py-1 text-sm rounded-full transition-all ${
                        !selectedFilters[filter.key]
                          ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                          : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:border-gray-600'
                      }`}
                    >
                      全部
                    </button>
                    {filter.value.map((item) => (
                      <button
                        key={item.v}
                        onClick={() => handleFilterChange(filter.key, item.v)}
                        className={`px-3 py-1 text-sm rounded-full transition-all ${
                          selectedFilters[filter.key] === item.v
                            ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                            : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:border-gray-600'
                        }`}
                      >
                        {item.n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
            </div>
          )}

          {/* Video Grid */}
          {!loading && videos.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mb-8">
                {videos.map((video, index) => (
                  <div
                    key={`${video.vod_id}-${video.vod_name}-${index}`}
                    onClick={() => handleVideoClick(video)}
                    className="group cursor-pointer"
                  >
                    <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-800 mb-2">
                      {video.vod_pic ? (
                        <img
                          src={getProxyImageUrl(video.vod_pic)}
                          alt={video.vod_name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Radio className="w-12 h-12 text-gray-600" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <Play className="w-8 h-8 text-white mx-auto" />
                        </div>
                      </div>
                      {video.vod_remarks && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs text-white">
                          {video.vod_remarks}
                        </div>
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-white truncate group-hover:text-green-400 transition-colors">
                      {video.vod_name}
                    </h3>
                    {video.vod_score && (
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs text-gray-400">{video.vod_score}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-800/50 text-white rounded-lg hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    上一页
                  </button>
                  <span className="text-gray-400">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-gray-800/50 text-white rounded-lg hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}

          {/* Empty State */}
          {!loading && videos.length === 0 && isInitialized && (
            <div className="text-center py-12">
              <Radio className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">暂无视频</p>
            </div>
          )}
        </div>

        {/* Source Selection Modal */}
        {isSourceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSourceModalOpen(false)}></div>
            <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700 max-h-[80vh] overflow-y-auto">
              <button
                onClick={() => setIsSourceModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-semibold text-white mb-4">选择爬虫源</h2>

              <div className="space-y-2">
                {spiderSourceCards.map((source) => (
                  <div
                    key={source.key}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                      selectedSource?.key === source.key
                        ? 'bg-green-500/20 border border-green-500/50'
                        : 'bg-gray-700/50 hover:bg-gray-700'
                    }`}
                  >
                    <button
                      onClick={() => handleSourceSelect(source)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <div className={`w-2 h-2 rounded-full ${source.connected ? 'bg-green-500' : 'bg-gray-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{source.name}</p>
                        <p className="text-xs text-gray-400 truncate">Key: {source.key}</p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleProxy(source.key, !source.proxyEnabled);
                      }}
                      className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                        source.proxyEnabled
                          ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                          : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                      }`}
                      title={source.proxyEnabled ? '已启用代理' : '未启用代理'}
                    >
                      <Cloud className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Category Selection Modal */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCategoryModalOpen(false)}></div>
            <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700 max-h-[80vh] overflow-y-auto">
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-semibold text-white mb-4">选择分类</h2>

              <div className="grid grid-cols-2 gap-2">
                {categories.map((category) => (
                  <button
                    key={category.type_id}
                    onClick={() => handleCategorySelect(category.type_id)}
                    className={`p-3 rounded-lg transition-all ${
                      selectedCategory === category.type_id
                        ? 'bg-blue-500/20 border border-blue-500/50'
                        : 'bg-gray-700/50 hover:bg-gray-700'
                    }`}
                  >
                    <p className="text-white font-medium">{category.type_name}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

export default function SpiderVideosPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
      </div>
    }>
      <SpiderVideosContent />
    </Suspense>
  );
}
