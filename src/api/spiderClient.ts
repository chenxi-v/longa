/**
 * 爬虫API客户端
 */
import {
  SpiderSource,
  SpiderSourceCard,
  SpiderHomeResponse,
  SpiderCategoryResponse,
  SpiderDetailResponse,
  SpiderPlayerResponse
} from './spider';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * 获取后端所有爬虫配置
 */
export async function fetchSpiderConfigs(): Promise<SpiderSource[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/config/list`);
    if (!response.ok) {
      throw new Error('获取爬虫配置失败');
    }
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('获取爬虫配置失败:', error);
    return [];
  }
}

/**
 * 获取已启用的爬虫配置
 */
export async function fetchEnabledSpiderConfigs(): Promise<SpiderSource[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/config/enabled`);
    if (!response.ok) {
      throw new Error('获取启用的爬虫配置失败');
    }
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('获取启用的爬虫配置失败:', error);
    return [];
  }
}

/**
 * 保存爬虫配置
 */
export async function saveSpiderConfig(config: Partial<SpiderSource>): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/config/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || '保存爬虫配置失败');
    }
    return true;
  } catch (error) {
    console.error('保存爬虫配置失败:', error);
    throw error;
  }
}

/**
 * 删除爬虫配置
 */
export async function deleteSpiderConfig(key: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/config/${key}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('删除爬虫配置失败');
    }
    return true;
  } catch (error) {
    console.error('删除爬虫配置失败:', error);
    return false;
  }
}

/**
 * 加载爬虫到内存
 */
export async function loadSpider(key: string, path: string, type: string, ext: string = ''): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/spider/load`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        path,
        spider_type: type,
        extend: ext,
      }),
    });
    if (!response.ok) {
      throw new Error('加载爬虫失败');
    }
    return true;
  } catch (error) {
    console.error('加载爬虫失败:', error);
    return false;
  }
}

/**
 * 卸载爬虫
 */
export async function unloadSpider(key: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/spider/unload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key }),
    });
    if (!response.ok) {
      throw new Error('卸载爬虫失败');
    }
    return true;
  } catch (error) {
    console.error('卸载爬虫失败:', error);
    return false;
  }
}

/**
 * 获取首页内容
 */
export async function fetchSpiderHome(key: string, useProxy: boolean = false): Promise<SpiderHomeResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/home`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        filter: false,
        use_proxy: useProxy,
      }),
    });
    if (!response.ok) {
      throw new Error('获取首页内容失败');
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('获取首页内容失败:', error);
    return null;
  }
}

/**
 * 获取分类内容
 */
export async function fetchSpiderCategory(
  key: string,
  tid: string,
  page: number = 1,
  filters: Record<string, string> = {},
  useProxy: boolean = false
): Promise<SpiderCategoryResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/category`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        tid,
        pg: page.toString(),
        filter: false,
        extend: filters,
        use_proxy: useProxy,
      }),
    });
    if (!response.ok) {
      throw new Error('获取分类内容失败');
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('获取分类内容失败:', error);
    return null;
  }
}

/**
 * 获取视频详情
 */
export async function fetchSpiderDetail(key: string, ids: string[], useProxy: boolean = false): Promise<SpiderDetailResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/detail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        ids,
        use_proxy: useProxy,
      }),
    });
    if (!response.ok) {
      throw new Error('获取视频详情失败');
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('获取视频详情失败:', error);
    return null;
  }
}

/**
 * 搜索视频
 */
export async function fetchSpiderSearch(
  key: string,
  keyword: string,
  quick: boolean = false,
  useProxy: boolean = false
): Promise<SpiderCategoryResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        keyword,
        quick,
        use_proxy: useProxy,
      }),
    });
    if (!response.ok) {
      throw new Error('搜索失败');
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('搜索失败:', error);
    return null;
  }
}

/**
 * 获取播放地址
 */
export async function fetchSpiderPlayer(
  key: string,
  flag: string,
  id: string
): Promise<SpiderPlayerResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/player`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        flag,
        id,
        vip_flags: [],
      }),
    });
    if (!response.ok) {
      throw new Error('获取播放地址失败');
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('获取播放地址失败:', error);
    return null;
  }
}

/**
 * 切换爬虫配置启用状态
 */
export async function toggleSpiderConfig(key: string, enabled: boolean): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/config/toggle/${key}?enabled=${enabled}`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('切换启用状态失败');
    }
    return true;
  } catch (error) {
    console.error('切换启用状态失败:', error);
    return false;
  }
}

/**
 * 检查后端连接状态
 */
export async function checkBackendConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * 获取爬虫源卡片列表（从localStorage）
 */
export function getSpiderSourceCards(): SpiderSourceCard[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('spiderSourceCards');
  if (stored) {
    return JSON.parse(stored);
  }
  return [];
}

/**
 * 保存爬虫源卡片列表到localStorage
 */
export function saveSpiderSourceCards(cards: SpiderSourceCard[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('spiderSourceCards', JSON.stringify(cards));
}

/**
 * 添加或更新爬虫源卡片
 */
export function addOrUpdateSpiderSourceCard(card: SpiderSourceCard): void {
  const cards = getSpiderSourceCards();
  const index = cards.findIndex(c => c.key === card.key);
  if (index >= 0) {
    cards[index] = card;
  } else {
    cards.push(card);
  }
  saveSpiderSourceCards(cards);
}

/**
 * 删除爬虫源卡片
 */
export function deleteSpiderSourceCard(key: string): void {
  const cards = getSpiderSourceCards();
  const filtered = cards.filter(c => c.key !== key);
  saveSpiderSourceCards(filtered);
}

export function getProxyImageUrl(url: string): string {
  if (!url) return url;
  
  if (url.startsWith('proxy://')) {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const proxyPath = url.replace('proxy://', '');
    const questionMarkIndex = proxyPath.indexOf('?');
    if (questionMarkIndex !== -1) {
      const siteKey = proxyPath.substring(0, questionMarkIndex);
      const imageUrl = proxyPath.substring(questionMarkIndex + 1);
      return `${API_BASE_URL}/api/proxy/?siteKey=${siteKey}&url=${encodeURIComponent(imageUrl)}`;
    }
    return `${API_BASE_URL}/api/proxy/?siteKey=${proxyPath}`;
  }
  
  return url;
}
