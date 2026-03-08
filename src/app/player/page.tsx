'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Settings, ChevronDown, Maximize2, Volume2, Film, Clock, Calendar, User, Star, FileText, List, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import PageTransition from '@/components/PageTransition';
import CollapseButton from '@/components/CollapseButton';
import Artplayer from 'artplayer';
import artplayerPluginLiquidGlass from '@/api/plugins/artplayer-liquid-glass';
import Hls, {
  type LoaderContext,
  type LoaderCallbacks,
  type LoaderResponse,
  type LoaderStats,
  type HlsConfig,
  type LoaderConfiguration,
  ErrorTypes,
  ErrorDetails,
} from 'hls.js';
import { getVideoDetail, parsePlayUrl, Episode, VideoSource } from '@/api/client';
import { fetchSpiderPlayer, getProxyImageUrl } from '@/api/spiderClient';
import { WatchHistory, EpisodeData } from '@/utils/history';



interface VideoItem {
  vod_id: number;
  vod_name: string;
  vod_en: string;
  vod_time: string;
  vod_remarks: string;
  vod_play_from: string;
  vod_pic?: string;
  vod_play_url?: string;
  vod_pic_thumb?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_writer?: string;
  vod_blurb?: string;
  vod_pubdate?: string;
  vod_area?: string;
  vod_lang?: string;
  vod_year?: string;
  vod_duration?: string;
  vod_score?: string;
  vod_content?: string;
  type_id: number;
  type_name: string;
}

function filterAdsFromM3U8(m3u8Content: string) {
  if (!m3u8Content) return '';

  const discontinuityRegex = /#EXT-X-DISCONTINUITY/g;
  return m3u8Content.replace(discontinuityRegex, '');
}

function parseTvBoxLink(text: string): { displayText: string; clickAction?: { id: string; name: string } } {
  if (!text) return { displayText: '' };
  
  const linkRegex = /\[a=cr:(\{[^}]+\})\/\]([^\[]*)\[\/a\]/g;
  let result = text;
  let match;
  
  while ((match = linkRegex.exec(text)) !== null) {
    try {
      const jsonData = JSON.parse(match[1]);
      const displayText = match[2];
      result = result.replace(match[0], displayText);
    } catch {
      // JSON解析失败，保持原样
    }
  }
  
  return { displayText: result };
}

const getHlsBufferConfig = () => {
  const mode = typeof window !== 'undefined' ? localStorage.getItem('playerBufferMode') || 'standard' : 'standard';

  switch (mode) {
    case 'enhanced':
      return {
        maxBufferLength: 45,
        backBufferLength: 45,
        maxBufferSize: 90 * 1000 * 1000,
      };
    case 'max':
      return {
        maxBufferLength: 90,
        backBufferLength: 60,
        maxBufferSize: 180 * 1000 * 1000,
      };
    case 'standard':
    default:
      return {
        maxBufferLength: 30,
        backBufferLength: 30,
        maxBufferSize: 60 * 1000 * 1000,
      };
  }
};

const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent);
const isMobile = isIOS || isAndroid || (typeof window !== 'undefined' && window.innerWidth < 768);
const isIOS13 = isIOS && typeof window !== 'undefined' && (window as any).webkit?.presentationMode !== undefined;

interface ExtendedLoaderContext extends LoaderContext {
  type: string;
}

interface ArtplayerWithHls extends Artplayer {
  hls?: Hls;
}

class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
  constructor(config: HlsConfig) {
    super(config);
    const load = this.load.bind(this);
    this.load = function (
      context: LoaderContext,
      config: LoaderConfiguration,
      callbacks: LoaderCallbacks<LoaderContext>,
    ) {
      const ctx = context as ExtendedLoaderContext;
      if (ctx.type === 'manifest' || ctx.type === 'level') {
        const onSuccess = callbacks.onSuccess;
        callbacks.onSuccess = function (
          response: LoaderResponse,
          stats: LoaderStats,
          context: LoaderContext,
          networkDetails: unknown,
        ) {
          if (response.data && typeof response.data === 'string') {
            response.data = filterAdsFromM3U8(response.data);
          }
          return onSuccess(response, stats, context, networkDetails);
        };
      }
      load(context, config, callbacks);
    };
  }
}

function PlayerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sourceId = searchParams.get('sourceId');
  const videoId = searchParams.get('videoId');
  const returnUrl = searchParams.get('returnUrl');
  const urlParam = searchParams.get('url');
  const historyIdParam = searchParams.get('historyId');
  const dataParam = searchParams.get('data');
  
  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<VideoSource | null>(null);
  const [isSpiderSource, setIsSpiderSource] = useState(false);
  const [videoDetail, setVideoDetail] = useState<VideoItem | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showEpisodeList, setShowEpisodeList] = useState(true);
  const [isEpisodeSelectorCollapsed, setIsEpisodeSelectorCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [directUrl, setDirectUrl] = useState('');
  const [directPlayTrigger, setDirectPlayTrigger] = useState(false);
  const [shouldInitDirectPlayer, setShouldInitDirectPlayer] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const episodesPerPage = isMobile ? 12 : 24;
  const artRef = useRef<Artplayer | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const loadFromSpiderData = () => {
      if (!dataParam) return false;

      try {
        const spiderData = JSON.parse(decodeURIComponent(dataParam));
        const detail: VideoItem = {
          vod_id: spiderData.vod_id,
          vod_name: spiderData.vod_name || '',
          vod_pic: spiderData.vod_pic || '',
          vod_remarks: spiderData.vod_remarks || '',
          vod_content: spiderData.vod_content || '',
          vod_actor: spiderData.vod_actor || '',
          vod_director: spiderData.vod_director || '',
          vod_year: spiderData.vod_year || '',
          vod_area: spiderData.vod_area || '',
          type_name: spiderData.type_name || '',
          vod_en: spiderData.vod_en || '',
          vod_time: spiderData.vod_time || '',
          vod_play_from: spiderData.vod_play_from || '',
          vod_play_url: spiderData.vod_play_url || '',
          type_id: spiderData.type_id || 0
        };

        setVideoDetail(detail);

        const parsedEpisodes = parsePlayUrl(detail.vod_play_url || '');
        setEpisodes(parsedEpisodes);

        if (parsedEpisodes.length > 0) {
          setSelectedEpisode(parsedEpisodes[0]);
        }

        if (spiderData.sourceKey && spiderData.sourceName) {
          const source: VideoSource = {
            id: spiderData.sourceKey,
            name: spiderData.sourceName,
            key: spiderData.sourceKey,
            apiUrl: '',
          };
          setSelectedSource(source);
          setIsSpiderSource(true);
          
          // 保存观看记录
          if (parsedEpisodes.length > 0) {
            const historyId = WatchHistory.add({
              vod_id: detail.vod_id,
              vod_name: detail.vod_name,
              vod_pic: detail.vod_pic,
              vod_remarks: detail.vod_remarks,
              sourceId: spiderData.sourceKey,
              sourceName: spiderData.sourceName,
              sourceType: 'spider',
              episodes: parsedEpisodes,
              currentEpisodeIndex: 0
            });
            setCurrentHistoryId(historyId);
          }
        }

        setLoading(false);
        return true;
      } catch (err) {
        console.error('解析爬虫数据失败:', err);
        setError('解析视频数据失败');
        setLoading(false);
        return false;
      }
    };
    
    const loadFromHistory = () => {
      if (!historyIdParam) return false;
      
      const allHistory = WatchHistory.getAll();
      const historyItem = allHistory.find(h => h.id === historyIdParam);
      
      if (!historyItem || !historyItem.episodes || historyItem.episodes.length === 0) {
        return false;
      }
      
      const detail: VideoItem = {
        vod_id: historyItem.vod_id as number,
        vod_name: historyItem.vod_name,
        vod_pic: historyItem.vod_pic || '',
        vod_remarks: historyItem.vod_remarks || '',
        vod_content: '',
        vod_actor: '',
        vod_director: '',
        vod_year: '',
        vod_area: '',
        type_name: '',
        vod_en: '',
        vod_time: '',
        vod_play_from: '',
        vod_play_url: '',
        type_id: 0
      };
      
      setVideoDetail(detail);
      setEpisodes(historyItem.episodes as Episode[]);
      
      const episodeIndex = historyItem.currentEpisodeIndex || 0;
      const episode = historyItem.episodes[episodeIndex];
      
      if (episode) {
        setSelectedEpisode(episode as Episode);
        setCurrentHistoryId(historyItem.id);
        setLoading(false);
        
        // 处理爬虫API源
        if (historyItem.sourceType === 'spider' && historyItem.sourceId) {
          const source: VideoSource = {
            id: historyItem.sourceId,
            name: historyItem.sourceName || '',
            key: historyItem.sourceId,
            apiUrl: '',
          };
          setSelectedSource(source);
          setIsSpiderSource(true);
        } else if (historyItem.sourceApiUrl) {
          const source: VideoSource = {
            id: historyItem.sourceId || '',
            name: historyItem.sourceName || '',
            key: historyItem.sourceId || '',
            apiUrl: historyItem.sourceApiUrl,
          };
          setSelectedSource(source);
        }
      }
      
      return true;
    };

    const loadSources = async () => {
      if (loadFromSpiderData()) {
        return;
      }

      if (loadFromHistory()) {
        return;
      }

      const stored = localStorage.getItem('videoSources');
      let localSources: VideoSource[] = [];
      
      if (stored) {
        const sources = JSON.parse(stored);
        localSources = sources.filter((s: VideoSource) => s.enabled !== false);
      }
      
      if (localSources.length > 0) {
        setVideoSources(localSources);
        
        if (urlParam) {
          setDirectUrl(urlParam);
          setShouldInitDirectPlayer(true);
          setLoading(false);
          return;
        }
        
        if (sourceId) {
          const source = localSources.find((s: VideoSource) => s.id === sourceId);
          if (source) {
            setSelectedSource(source);
            loadVideoDetail(source, videoId);
          } else {
            setError('未找到指定的视频源');
            setLoading(false);
          }
        } else if (localSources.length > 0) {
          setSelectedSource(localSources[0]);
          setLoading(false);
        }
      } else {
        if (urlParam) {
          setDirectUrl(urlParam);
          setShouldInitDirectPlayer(true);
          setLoading(false);
        } else {
          setLoading(false);
        }
      }
    };
    
    loadSources();
    
    return () => {
      abortController.abort();
    };
  }, [sourceId, videoId, urlParam, historyIdParam, dataParam]);

  const loadVideoDetail = async (source: VideoSource, id: string | null) => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const detail = await getVideoDetail(source, parseInt(id));
      setVideoDetail(detail);
      
      const parsedEpisodes = parsePlayUrl(detail.vod_play_url || '');
      setEpisodes(parsedEpisodes);
      
      if (parsedEpisodes.length > 0) {
        setSelectedEpisode(parsedEpisodes[0]);
        
        const historyId = WatchHistory.add({
          vod_id: detail.vod_id,
          vod_name: detail.vod_name,
          vod_pic: detail.vod_pic,
          vod_remarks: detail.vod_remarks,
          sourceId: source.id,
          sourceName: source.name,
          sourceApiUrl: source.apiUrl,
          currentEpisodeIndex: 0
        });
        setCurrentHistoryId(historyId);
      } else {
        setError('未找到可播放的集数');
      }
    } catch (err) {
      console.error('加载视频详情失败:', err);
      setError(err instanceof Error ? err.message : '获取视频详情失败');
    } finally {
      setLoading(false);
    }
  };

  const initIframePlayer = (url: string) => {
    console.log('初始化iframe播放器，URL:', url);
    
    if (!videoRef.current) {
      console.error('videoRef.current不存在，无法初始化iframe播放器');
      setPlaybackStatus('播放器初始化失败');
      return;
    }

    // 设置播放状态
    setPlaybackStatus('正在加载视频...');

    // 清理之前的播放器
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (artRef.current) {
      artRef.current.destroy();
      artRef.current = null;
    }

    // 创建iframe
    videoRef.current.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.allowFullscreen = true;
    iframe.allow = 'autoplay; fullscreen; encrypted-media';
    videoRef.current.appendChild(iframe);

    setPlaybackStatus(null);
  };



  const initPlayer = (url: string) => {
    console.log('尝试初始化播放器，URL:', url);
    console.log('videoRef.current存在:', !!videoRef.current);
    
    if (!videoRef.current) {
      console.error('videoRef.current不存在，无法初始化播放器');
      setPlaybackStatus('播放器初始化失败');
      return;
    }

    // 设置播放状态
    setPlaybackStatus('正在加载视频...');

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (artRef.current) {
      artRef.current.destroy();
      artRef.current = null;
    }

    const isM3U8 = url.includes('.m3u8');

    console.log('创建Artplayer实例，容器:', videoRef.current);
    
    const art = new Artplayer({
      container: videoRef.current,
      url: url,
      volume: 0.7,
      isLive: false,
      muted: false,
      autoplay: false,
      pip: true,
      autoSize: false,
      autoMini: false,
      screenshot: true,
      setting: true,
      loop: false,
      flip: true,
      playbackRate: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      subtitleOffset: true,
      miniProgressBar: false,
      mutex: true,
      backdrop: true,
      playsInline: true,
      autoOrientation: true,
      airplay: isIOS || isAndroid,
      theme: '#0ea5e9',
      lang: 'zh-cn',
      moreVideoAttr: {
        crossOrigin: 'anonymous',
      },
      plugins: [
        artplayerPluginLiquidGlass(),
      ],
      customType: {
        m3u8: (video: HTMLVideoElement, url: string, player: any) => {
          const artWithHls = player as ArtplayerWithHls;
          if (Hls.isSupported()) {
            if (artWithHls.hls) artWithHls.hls.destroy();
            
            const bufferConfig = getHlsBufferConfig();
            
            const hlsConfig: Partial<HlsConfig> = {
              debug: false,
              enableWorker: true,
              lowLatencyMode: !isMobile,
              maxBufferLength: isMobile
                ? (isIOS13 ? 8 : isIOS ? 10 : 15)
                : bufferConfig.maxBufferLength,
              backBufferLength: isMobile
                ? (isIOS13 ? 5 : isIOS ? 8 : 10)
                : bufferConfig.backBufferLength,
              maxBufferSize: isMobile
                ? (isIOS13 ? 20 * 1000 * 1000 : isIOS ? 30 * 1000 * 1000 : 40 * 1000 * 1000)
                : bufferConfig.maxBufferSize,
              maxLoadingDelay: isMobile ? (isIOS13 ? 1 : 2) : 2,
              maxBufferHole: isMobile ? (isIOS13 ? 0.05 : 0.1) : 0.1,
              liveDurationInfinity: false,
              liveBackBufferLength: isMobile ? (isIOS13 ? 3 : 5) : null,
              maxMaxBufferLength: isMobile ? (isIOS13 ? 60 : 120) : 600,
              maxFragLookUpTolerance: isMobile ? 0.1 : 0.25,
              abrEwmaFastLive: isMobile ? 2 : 3,
              abrEwmaSlowLive: isMobile ? 6 : 9,
              abrBandWidthFactor: isMobile ? 0.8 : 0.95,
              startFragPrefetch: !isMobile,
              testBandwidth: !isIOS13,
              fragLoadPolicy: {
                default: {
                  maxTimeToFirstByteMs: isMobile ? 3000 : 5000,
                  maxLoadTimeMs: isMobile ? 30000 : 60000,
                  timeoutRetry: {
                    maxNumRetry: isMobile ? 2 : 4,
                    retryDelayMs: 0,
                    maxRetryDelayMs: 0,
                  },
                  errorRetry: {
                    maxNumRetry: isMobile ? 3 : 6,
                    retryDelayMs: 1000,
                    maxRetryDelayMs: isMobile ? 4000 : 8000,
                  },
                },
              },
              loader: CustomHlsJsLoader as unknown as typeof Hls.DefaultConfig.loader,
            };
            
            const hls = new Hls(hlsConfig);
            hls.loadSource(url);
            hls.attachMedia(video);
            hlsRef.current = hls;
            artWithHls.hls = hls;
            player.on('destroy', () => hls.destroy());

            hls.on(Hls.Events.ERROR, (event: any, data: any) => {
              console.error('HLS Error:', event, data);

              if (data.details === Hls.ErrorDetails.FRAG_PARSING_ERROR) {
                console.log('片段解析错误，尝试重新加载...');
                hls.startLoad();
                return;
              }

              if (data.details === Hls.ErrorDetails.BUFFER_APPEND_ERROR &&
                  data.err && data.err.message &&
                  data.err.message.includes('timestamp')) {
                console.log('时间戳错误，清理缓冲区并重新加载...');
                try {
                  const currentTime = video.currentTime;
                  hls.trigger(Hls.Events.BUFFER_RESET, undefined);
                  hls.startLoad(currentTime);
                } catch (e) {
                  console.warn('缓冲区重置失败:', e);
                  hls.startLoad();
                }
                return;
              }

              if (data.details === Hls.ErrorDetails.INTERNAL_ABORTED) {
                console.log('内部中止，忽略此错误');
                return;
              }

              if (data.fatal) {
                switch (data.type) {
                  case ErrorTypes.NETWORK_ERROR:
                    console.log('网络错误，尝试恢复...');
                    // 显示网络错误提示
                    if (artRef.current) {
                      artRef.current.notice.show = '网络错误，请检查链接是否有效';
                    }
                    setPlaybackStatus('网络错误，请检查链接');
                    hls.startLoad();
                    break;
                  case ErrorTypes.MEDIA_ERROR:
                    console.log('媒体错误，尝试恢复...');
                    hls.recoverMediaError();
                    break;
                  default:
                    console.log('无法恢复的错误');
                    hls.destroy();
                    // 显示错误提示
                    if (artRef.current) {
                      artRef.current.notice.show = '播放器错误，请检查链接格式';
                    }
                    setPlaybackStatus('播放错误');
                    break;
                }
              }
            });
            
            // 监听加载成功事件
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              setPlaybackStatus('视频加载成功，正在播放...');
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            setPlaybackStatus('视频加载成功，正在播放...');
          }
        },
      },
    });

    art.on('ready', () => {
      setPlaybackStatus('播放器已就绪');
    });
    
    art.on('fullscreen', () => setIsFullscreen(true));
    art.on('fullscreenExit', () => setIsFullscreen(false));

    artRef.current = art;
  };

  useEffect(() => {
    const loadSpiderPlayer = async () => {
      if (!selectedEpisode?.url || !selectedSource || !isSpiderSource) return;
      
      console.log('爬虫源播放，调用playerContent:', selectedEpisode.url);
      setPlaybackStatus('正在获取播放链接...');
      
      try {
        const playerData = await fetchSpiderPlayer(
          selectedSource.key,
          '',
          selectedEpisode.url
        );
        
        if (playerData) {
          console.log('获取到的播放数据:', playerData);
          
          if (playerData.parse === 1) {
            console.log('使用iframe播放');
            initIframePlayer(playerData.url || '');
          } else {
            console.log('使用HLS播放');
            initPlayer(playerData.url || '');
          }
        } else {
          console.error('获取播放链接失败');
          setPlaybackStatus('获取播放链接失败');
        }
      } catch (err) {
        console.error('获取播放链接失败:', err);
        setPlaybackStatus('获取播放链接失败');
      }
    };
    
    if (isSpiderSource && selectedEpisode?.url && selectedSource) {
      loadSpiderPlayer();
    } else if (selectedEpisode?.url && !isSpiderSource) {
      initPlayer(selectedEpisode.url);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (artRef.current) {
        artRef.current.destroy();
        artRef.current = null;
      }
    };
  }, [selectedEpisode, selectedSource, isSpiderSource]);

  const handleSourceSelect = (source: VideoSource) => {
    setSelectedSource(source);
    setShowSourceDropdown(false);
    if (videoId) {
      loadVideoDetail(source, videoId);
    }
  };

  const handleEpisodeSelect = async (episode: Episode) => {
    console.log('选择集数:', episode);
    
    if (selectedEpisode?.index === episode.index) {
      console.log('已选择当前集数，忽略');
      return;
    }
    
    setSelectedEpisode(episode);
    
    if (currentHistoryId) {
      WatchHistory.updateEpisode(currentHistoryId, episode.index);
    }
    
    if (isSpiderSource && selectedSource && episode.url) {
      console.log('爬虫源切换集数，调用playerContent:', episode.url);
      setPlaybackStatus('正在获取播放链接...');
      
      try {
        const playerData = await fetchSpiderPlayer(
          selectedSource.key,
          '',
          episode.url
        );
        
        if (playerData) {
          console.log('获取到的播放数据:', playerData);
          
          if (playerData.parse === 1) {
            console.log('使用iframe播放');
            initIframePlayer(playerData.url || '');
          } else {
            console.log('使用HLS播放');
            initPlayer(playerData.url || '');
            if (artRef.current) {
              artRef.current.play();
            }
          }
        } else {
          console.error('获取播放链接失败');
          setPlaybackStatus('获取播放链接失败');
        }
      } catch (err) {
        console.error('获取播放链接失败:', err);
        setPlaybackStatus('获取播放链接失败');
      }
    } else if (artRef.current && episode.url) {
      let playUrl = episode.url;
      
      try {
        if (episode.url.includes('$')) {
          const parts = episode.url.split('$');
          if (parts.length > 1) {
            const base64Data = parts[1];
            console.log('检测到base64编码的播放数据:', base64Data);
            const decodedData = atob(base64Data);
            const parsedData = JSON.parse(decodedData);
            if (parsedData.url) {
              playUrl = parsedData.url;
              console.log('解析后的播放URL:', playUrl);
            }
          }
        }
      } catch (err) {
        console.log('解析播放数据失败，使用原始URL:', err);
      }
      
      console.log('切换播放URL:', playUrl);
      initPlayer(playUrl);
      artRef.current.play();
    }
  };

  const handleDirectPlay = () => {
    if (!directUrl.trim()) {
      alert('请输入有效的视频链接');
      return;
    }

    // 检查URL是否为有效链接
    try {
      new URL(directUrl);
      
      // 清空之前的视频详情和选集信息
      setVideoDetail(null);
      setEpisodes([]);
      setSelectedEpisode(null);
      
      // 触发直接播放
      setDirectPlayTrigger(prev => !prev);
    } catch (err) {
      alert('请输入有效的视频链接');
    }
  };

  // 处理直接播放触发
  useEffect(() => {
    if (directPlayTrigger && directUrl.trim()) {
      initPlayer(directUrl);
    }
  }, [directPlayTrigger, directUrl]);

  // 处理直接URL播放
  useEffect(() => {
    if (!loading && shouldInitDirectPlayer && directUrl.trim()) {
      setDirectPlayTrigger(prev => !prev);
      setShouldInitDirectPlayer(false);
    }
  }, [loading, shouldInitDirectPlayer, directUrl]);

  const handleFullscreen = () => {
    if (artRef.current) {
      artRef.current.fullscreen = true;
    }
  };

  const handlePreviousEpisode = () => {
    if (selectedEpisode && selectedEpisode.index > 0) {
      handleEpisodeSelect(episodes[selectedEpisode.index - 1]);
    }
  };

  const handleNextEpisode = () => {
    if (selectedEpisode && selectedEpisode.index < episodes.length - 1) {
      handleEpisodeSelect(episodes[selectedEpisode.index + 1]);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
  };

  const totalPages = Math.ceil(episodes.length / episodesPerPage);
  const startIndex = (currentPage - 1) * episodesPerPage;
  const endIndex = startIndex + episodesPerPage;
  const currentEpisodes = episodes.slice(startIndex, endIndex);

  return (
    <PageTransition>
      <div className="min-h-screen relative">
        <div className="relative" style={{ zIndex: 10 }}>
          <div className="max-w-7xl mx-auto px-4 py-20 sm:py-24">
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between mb-8 gap-4">
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                视频播放器
              </h1>
              <button
                onClick={() => router.back()}
                className="inline-flex items-center gap-2 px-4 py-2 h-10 bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 text-white rounded-full hover:from-blue-600 hover:via-sky-600 hover:to-cyan-600 transition-all duration-300"
              >
                返回
              </button>
            </div>
            
            <div className="space-y-6">
              {loading ? (
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-12 border border-gray-700/50">
                  <div className="flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-3 text-gray-400">加载中...</span>
                  </div>
                </div>
              ) : error ? (
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-red-500/50">
                  <p className="text-red-400 text-center">{error}</p>
                </div>
              ) : (videoDetail || directUrl || urlParam) ? (
                <>
                  <div className="flex items-center justify-center lg:justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {selectedSource && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 text-white text-sm font-medium shadow-lg">
                          <span>源：{selectedSource.name}</span>
                          {videoDetail?.vod_name && (
                            <span>· {videoDetail.vod_name}</span>
                          )}
                          {episodes.length > 0 && selectedEpisode?.label && (
                            <span>· {selectedEpisode.label}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {videoDetail && episodes.length > 0 && (
                      <CollapseButton
                        isCollapsed={isEpisodeSelectorCollapsed}
                        onToggle={() => setIsEpisodeSelectorCollapsed(!isEpisodeSelectorCollapsed)}
                      />
                    )}
                  </div>

                  <div
                    className={`grid gap-4 transition-all duration-300 ease-in-out ${isEpisodeSelectorCollapsed
                      ? 'grid-cols-1'
                      : 'grid-cols-1 md:grid-cols-4'
                      }`}
                  >
                    <div
                      className={`h-full transition-all duration-300 ease-in-out rounded-xl overflow-hidden ${isEpisodeSelectorCollapsed ? 'col-span-1' : 'md:col-span-3'
                        }`}
                    >
                      <div className="relative w-full aspect-video lg:h-[500px] xl:h-[600px] 2xl:h-[700px] bg-black rounded-xl overflow-hidden shadow-lg">
                        <div ref={videoRef} className="w-full h-full"></div>
                      </div>
                    </div>

                    {videoDetail && episodes.length > 0 && (
                      <div
                        className={`h-[300px] lg:h-full transition-all duration-300 ease-in-out ${isEpisodeSelectorCollapsed
                          ? 'md:col-span-1 lg:hidden lg:opacity-0 lg:scale-95'
                          : 'md:col-span-1 lg:opacity-100 lg:scale-100'
                          }`}
                      >
                        <div className='md:ml-2 px-3 py-2 h-full rounded-xl flex flex-col overflow-hidden bg-gradient-to-br from-blue-500/10 via-sky-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:via-sky-500/20 dark:to-cyan-500/20 border border-blue-500/20 dark:border-blue-400/30 relative'>
                          <div className='flex mb-1 shrink-0 relative'>
                            <div
                              className='group flex-1 py-2 px-3 text-center cursor-pointer transition-all duration-300 font-semibold relative overflow-hidden active:scale-[0.98] min-h-[32px] text-white bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 rounded-full'
                            >
                              <span className='relative z-10 font-bold text-xs'>选集</span>
                              </div>
                            </div>

                            <div className='flex items-center gap-1 mb-3 shrink-0'>
                              <button
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 bg-white/10 border border-white/20 text-gray-300 rounded-full hover:bg-white/20 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                              >
                                <ChevronLeft className="w-3 h-3" />
                              </button>
                              <div className='flex-1 overflow-x-auto scrollbar-hide'>
                                <div className='flex gap-1 min-w-max'>
                                  {Array.from({ length: totalPages }, (_, i) => {
                                    const start = i * episodesPerPage + 1;
                                    const end = Math.min(start + episodesPerPage - 1, episodes.length);
                                    const label = `${start}-${end}`;
                                    const isActive = i === currentPage - 1;
                                    return (
                                      <button
                                        key={label}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={`min-w-[50px] py-1 px-1.5 text-xs font-medium transition-all duration-200 whitespace-nowrap shrink-0 text-center rounded-full active:scale-95
                                          ${isActive
                                            ? 'text-white bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500'
                                            : 'text-gray-400 hover:text-white hover:bg-white/20'
                                          }`.trim()}
                                      >
                                        {label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <button
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1.5 bg-white/10 border border-white/20 text-gray-300 rounded-full hover:bg-white/20 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                              >
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>

                            <div className='flex items-center gap-2 mb-3 shrink-0'>
                              <button
                                onClick={handlePreviousEpisode}
                                disabled={selectedEpisode?.index === 0}
                                className="flex-1 px-2 py-1 bg-white/10 border border-white/20 text-gray-300 rounded-full hover:bg-white/20 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-1 text-xs"
                              >
                                <ChevronLeft className="w-3 h-3" />
                                上一集
                              </button>
                              <button
                                onClick={handleNextEpisode}
                                disabled={selectedEpisode?.index === episodes.length - 1}
                                className="flex-1 px-2 py-1 bg-white/10 border border-white/20 text-gray-300 rounded-full hover:bg-white/20 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-1 text-xs"
                              >
                                下一集
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>

                            <div className='grid grid-cols-3 gap-1.5 flex-1 content-start'>
                              {currentEpisodes.map((episode) => {
                                const isActive = selectedEpisode?.index === episode.index;
                                return (
                                  <button
                                    key={episode.index}
                                    onClick={() => handleEpisodeSelect(episode)}
                                    className={`group min-h-[32px] px-1.5 py-1.5 flex items-center justify-center text-xs font-medium rounded-full transition-all duration-200 whitespace-nowrap relative overflow-hidden active:scale-95
                                      ${isActive
                                        ? 'bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-500 text-white shadow-md shadow-blue-500/20'
                                        : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-gradient-to-r hover:from-blue-500 hover:via-sky-500 hover:to-cyan-500 hover:text-white hover:border-blue-400'
                                      }`.trim()}
                                  >
                                    <span className='relative z-10 truncate'>{episode.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                    )}
                  </div>

                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-gray-700/50">
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                      {videoDetail?.vod_pic && !imageLoadFailed ? (
                        <div className="w-full sm:w-48 flex-shrink-0 mx-auto sm:mx-0">
                          <img
                            src={getProxyImageUrl(videoDetail.vod_pic)}
                            alt={videoDetail?.vod_name || ''}
                            className="w-full aspect-[2/3] object-cover rounded-lg shadow-lg"
                            onError={() => setImageLoadFailed(true)}
                          />
                        </div>
                      ) : (
                        <div className="w-full sm:w-48 flex-shrink-0 mx-auto sm:mx-0">
                          <div className="w-full aspect-[2/3] bg-gradient-to-br from-gray-600 to-gray-800 rounded-lg flex items-center justify-center">
                            <Film className="w-12 h-12 text-gray-400" />
                          </div>
                        </div>
                      )}
                      <div className="flex-1">
                        <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">{videoDetail?.vod_name}</h2>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-gray-300">
                            <Film className="w-4 h-4" />
                            <span>{videoDetail?.type_name}</span>
                          </div>
                          {videoDetail?.vod_area && (
                            <div className="flex items-center gap-2 text-gray-300">
                              <span className="text-gray-400">地区：</span>
                              <span>{videoDetail.vod_area}</span>
                            </div>
                          )}
                          {videoDetail?.vod_year && (
                            <div className="flex items-center gap-2 text-gray-300">
                              <Calendar className="w-4 h-4" />
                              <span>{videoDetail.vod_year}</span>
                            </div>
                          )}
                          {videoDetail?.vod_score && (
                            <div className="flex items-center gap-2 text-yellow-400">
                              <Star className="w-4 h-4" />
                              <span>{videoDetail.vod_score}</span>
                            </div>
                          )}
                          {videoDetail?.vod_remarks && (
                            <div className="flex items-center gap-2 text-blue-400">
                              <Clock className="w-4 h-4" />
                              <span>{videoDetail.vod_remarks}</span>
                            </div>
                          )}
                          {videoDetail?.vod_actor && (
                            <div className="flex items-start gap-2 text-gray-300">
                              <User className="w-4 h-4 mt-0.5" />
                              <span className="text-sm">{videoDetail.vod_actor}</span>
                            </div>
                          )}
                          {videoDetail?.vod_director && (
                            <div className="flex items-center gap-2 text-gray-300">
                              <span className="text-gray-400">导演：</span>
                              <span>{parseTvBoxLink(videoDetail.vod_director).displayText}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {(videoDetail?.vod_blurb || videoDetail?.vod_content) && (
                      <div className="mt-6 pt-6 border-t border-gray-700/50">
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                          <p className="text-gray-300 text-sm leading-relaxed">{videoDetail?.vod_blurb || videoDetail?.vod_content}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 sm:p-8 border border-gray-700/50">
                    <h2 className="text-xl font-semibold text-white mb-4 text-center">直接播放</h2>
                    <p className="text-gray-400 text-center mb-6">输入视频链接直接播放</p>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        value={directUrl}
                        onChange={(e) => setDirectUrl(e.target.value)}
                        placeholder="请输入 m3u8 或 mp4 播放链接..."
                        className="flex-1 px-4 py-3 rounded-lg bg-gray-700/50 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={handleDirectPlay}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
                      >
                        播放
                      </button>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-gray-700/50">
                      <p className="text-sm text-gray-400 text-center">
                        支持 m3u8、mp4 等常见视频格式
                      </p>
                    </div>
                  </div>
                  
                  {/* 视频播放器容器 */}
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-700/50">
                    <div className="aspect-video bg-black">
                      <div ref={videoRef} className="w-full h-full"></div>
                    </div>
                    {playbackStatus && (
                      <div className="p-3 bg-gray-900/50 border-t border-gray-700/50">
                        <p className="text-sm text-center text-gray-300">{playbackStatus}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

export default function PlayerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen relative">
        <div className="relative" style={{ zIndex: 10 }}>
          <div className="max-w-7xl mx-auto px-4 py-20 sm:py-24">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-12 border border-gray-700/50">
              <div className="flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-3 text-gray-400">加载中...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <PlayerContent />
    </Suspense>
  );
}
