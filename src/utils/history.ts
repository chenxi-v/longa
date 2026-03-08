const WATCH_HISTORY_KEY = 'watch_history';
const SEARCH_HISTORY_KEY = 'search_history';
const MAX_WATCH_HISTORY_ITEMS = 50;
const MAX_SEARCH_HISTORY_ITEMS = 10;

export interface EpisodeData {
  label: string;
  url: string;
  index: number;
}

export interface WatchHistoryItem {
  id: string;
  vod_id: number | string;
  vod_name: string;
  vod_pic?: string;
  vod_remarks?: string;
  sourceId?: string;
  sourceName?: string;
  sourceType?: string;
  sourceApiUrl?: string;
  episodes?: EpisodeData[];
  currentEpisodeIndex?: number;
  timestamp: number;
}

export interface SearchHistoryItem {
  keyword: string;
  timestamp: number;
}

const STORAGE_TYPE = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

function isCloudStorage(): boolean {
  return STORAGE_TYPE === 'upstash';
}

function getDataApiPath(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '/local-api/data'
    }
  }
  return '/api/data'
}

async function syncWatchHistoryToCloud(history: WatchHistoryItem[]): Promise<void> {
  if (!isCloudStorage()) return;
  try {
    await fetch(getDataApiPath(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'watchHistory',
        data: history,
      }),
    });
  } catch (e) {
    console.error('Failed to sync watch history:', e);
  }
}

async function syncSearchHistoryToCloud(keyword: string): Promise<void> {
  if (!isCloudStorage()) return;
  try {
    await fetch(getDataApiPath(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'addSearchHistory',
        data: { keyword },
      }),
    });
  } catch (e) {
    console.error('Failed to sync search history:', e);
  }
}

async function deleteSearchHistoryFromCloud(keyword?: string): Promise<void> {
  if (!isCloudStorage()) return;
  try {
    await fetch(getDataApiPath(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'deleteSearchHistory',
        data: { keyword },
      }),
    });
  } catch (e) {
    console.error('Failed to delete search history:', e);
  }
}

export const WatchHistory = {
  getAll(): WatchHistoryItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(WATCH_HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  add(item: Omit<WatchHistoryItem, 'id' | 'timestamp'>): string {
    if (typeof window === 'undefined') return '';
    
    const history = this.getAll();
    const existingIndex = history.findIndex(
      h => h.vod_id === item.vod_id && h.sourceId === item.sourceId
    );
    
    if (existingIndex !== -1) {
      history.splice(existingIndex, 1);
    }
    
    const id = `${item.vod_id}-${item.sourceId}-${Date.now()}`;
    const newItem: WatchHistoryItem = {
      ...item,
      id,
      timestamp: Date.now()
    };
    
    history.unshift(newItem);
    
    if (history.length > MAX_WATCH_HISTORY_ITEMS) {
      history.splice(MAX_WATCH_HISTORY_ITEMS);
    }
    
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
    syncWatchHistoryToCloud(history).catch(console.error);
    return id;
  },

  updateEpisode(id: string, episodeIndex: number): void {
    if (typeof window === 'undefined') return;
    const history = this.getAll();
    const index = history.findIndex(h => h.id === id);
    if (index !== -1) {
      history[index].currentEpisodeIndex = episodeIndex;
      history[index].timestamp = Date.now();
      const updatedItem = history.splice(index, 1)[0];
      history.unshift(updatedItem);
      localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
      syncWatchHistoryToCloud(history).catch(console.error);
    }
  },

  remove(id: string): void {
    if (typeof window === 'undefined') return;
    const history = this.getAll().filter(h => h.id !== id);
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
    syncWatchHistoryToCloud(history).catch(console.error);
  },

  clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(WATCH_HISTORY_KEY);
    syncWatchHistoryToCloud([]).catch(console.error);
  }
};

export const SearchHistory = {
  getAll(): SearchHistoryItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(SEARCH_HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  add(keyword: string): void {
    if (typeof window === 'undefined' || !keyword.trim()) return;
    
    const history = this.getAll();
    const existingIndex = history.findIndex(
      h => h.keyword.toLowerCase() === keyword.toLowerCase()
    );
    
    if (existingIndex !== -1) {
      history.splice(existingIndex, 1);
    }
    
    history.unshift({
      keyword: keyword.trim(),
      timestamp: Date.now()
    });
    
    if (history.length > MAX_SEARCH_HISTORY_ITEMS) {
      history.splice(MAX_SEARCH_HISTORY_ITEMS);
    }
    
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    syncSearchHistoryToCloud(keyword.trim()).catch(console.error);
  },

  remove(keyword: string): void {
    if (typeof window === 'undefined') return;
    const history = this.getAll().filter(
      h => h.keyword.toLowerCase() !== keyword.toLowerCase()
    );
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    deleteSearchHistoryFromCloud(keyword).catch(console.error);
  },

  clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    deleteSearchHistoryFromCloud().catch(console.error);
  }
};
