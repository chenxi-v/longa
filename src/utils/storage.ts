const STORAGE_TYPE = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage'

export function isCloudStorage(): boolean {
  return STORAGE_TYPE === 'upstash'
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

function parseJwt(token: string): { username?: string } | null {
  try {
    const base64Payload = token.split('.')[1]
    if (!base64Payload) return null
    const payload = atob(base64Payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(payload)
  } catch {
    return null
  }
}

function getUsername(): string {
  if (typeof window === 'undefined') return 'default'
  
  try {
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const trimmed = cookie.trim()
      const firstEqualIndex = trimmed.indexOf('=')
      if (firstEqualIndex > 0) {
        const key = trimmed.substring(0, firstEqualIndex)
        const value = trimmed.substring(firstEqualIndex + 1)
        if (key && value) {
          acc[key] = value
        }
      }
      return acc
    }, {} as Record<string, string>)

    const authCookie = cookies['user_auth']
    
    if (!authCookie) return 'default'

    let decoded = decodeURIComponent(authCookie)
    
    if (decoded.startsWith('eyJ')) {
      const jwtPayload = parseJwt(decoded)
      if (jwtPayload && jwtPayload.username) {
        return jwtPayload.username
      }
    }
    
    try {
      const authData = JSON.parse(decoded)
      return authData.username || 'default'
    } catch {
      const jwtPayload = parseJwt(decoded)
      if (jwtPayload && jwtPayload.username) {
        return jwtPayload.username
      }
    }
    
    return 'default'
  } catch {
    return 'default'
  }
}

export interface WatchHistoryItem {
  id: string
  vod_id: number | string
  vod_name: string
  vod_pic?: string
  vod_remarks?: string
  sourceId?: string
  sourceName?: string
  sourceType?: string
  sourceApiUrl?: string
  episodes?: { label: string; url: string; index: number }[]
  currentEpisodeIndex?: number
  timestamp: number
}

export interface SearchHistoryItem {
  keyword: string
  timestamp: number
}

export interface VideoSource {
  id: string
  name: string
  key: string
  apiUrl: string
  enabled?: boolean
}

export interface ProxySettings {
  enabled: boolean
  proxyUrl: string
}

export interface SpiderProxySettings {
  enabled: boolean
  workerUrl: string
}

export function generateStorageKey(source: string, id: string): string {
  return `${source}+${id}`
}

const WatchHistoryStorage = {
  KEY: 'watch_history',
  
  get(): WatchHistoryItem[] {
    if (typeof window === 'undefined') return []
    const data = localStorage.getItem(this.KEY)
    return data ? JSON.parse(data) : []
  },

  save(history: WatchHistoryItem[]): void {
    localStorage.setItem(this.KEY, JSON.stringify(history))
  },

  async syncToCloud(): Promise<void> {
    if (!isCloudStorage()) return
    const history = this.get()
    try {
      await fetch(getDataApiPath(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'watchHistory',
          data: history,
        }),
      })
    } catch (e) {
      console.error('Failed to sync watch history:', e)
    }
  },

  async loadFromCloud(): Promise<WatchHistoryItem[]> {
    if (!isCloudStorage()) return []
    try {
      const res = await fetch(`${getDataApiPath()}?action=watchHistory`)
      const { data } = await res.json()
      return data || []
    } catch (e) {
      console.error('Failed to load watch history from cloud:', e)
      return []
    }
  },
}

const SearchHistoryStorage = {
  KEY: 'search_history',
  
  get(): SearchHistoryItem[] {
    if (typeof window === 'undefined') return []
    const data = localStorage.getItem(this.KEY)
    return data ? JSON.parse(data) : []
  },

  save(history: SearchHistoryItem[]): void {
    localStorage.setItem(this.KEY, JSON.stringify(history))
  },

  async addToCloud(keyword: string): Promise<void> {
    if (!isCloudStorage()) return
    try {
      await fetch(getDataApiPath(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addSearchHistory',
          data: { keyword },
        }),
      })
    } catch (e) {
      console.error('Failed to add search history to cloud:', e)
    }
  },

  async deleteFromCloud(keyword?: string): Promise<void> {
    if (!isCloudStorage()) return
    try {
      await fetch(getDataApiPath(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteSearchHistory',
          data: { keyword },
        }),
      })
    } catch (e) {
      console.error('Failed to delete search history from cloud:', e)
    }
  },

  async loadFromCloud(): Promise<SearchHistoryItem[]> {
    if (!isCloudStorage()) return []
    try {
      const res = await fetch(`${getDataApiPath()}?action=searchHistory`)
      const { data } = await res.json()
      return (data || []).map((keyword: string) => ({
        keyword,
        timestamp: Date.now(),
      }))
    } catch (e) {
      console.error('Failed to load search history from cloud:', e)
      return []
    }
  },
}

const VideoSourcesStorage = {
  KEY: 'videoSources',
  
  get(): VideoSource[] {
    if (typeof window === 'undefined') return []
    const data = localStorage.getItem(this.KEY)
    return data ? JSON.parse(data) : []
  },

  save(sources: VideoSource[]): void {
    localStorage.setItem(this.KEY, JSON.stringify(sources))
  },

  async syncToCloud(sources: VideoSource[]): Promise<void> {
    if (!isCloudStorage()) return
    
    try {
      await fetch(getDataApiPath(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'videoSources',
          data: sources,
        }),
      })
    } catch (e) {
      console.error('Failed to sync video sources:', e)
    }
  },

  async loadFromCloud(): Promise<VideoSource[]> {
    if (!isCloudStorage()) return []
    try {
      const res = await fetch(`${getDataApiPath()}?action=videoSources`)
      const { data } = await res.json()
      return data || []
    } catch (e) {
      console.error('Failed to load video sources from cloud:', e)
      return []
    }
  },
}

const ProxySettingsStorage = {
  KEY: 'proxySettings',
  
  get(): ProxySettings {
    if (typeof window === 'undefined') return { enabled: false, proxyUrl: '' }
    const data = localStorage.getItem(this.KEY)
    return data ? JSON.parse(data) : { enabled: false, proxyUrl: '' }
  },

  save(settings: ProxySettings): void {
    localStorage.setItem(this.KEY, JSON.stringify(settings))
  },

  async syncToCloud(settings: ProxySettings): Promise<void> {
    if (!isCloudStorage()) return
    try {
      await fetch(getDataApiPath(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'proxySettings',
          data: settings,
        }),
      })
    } catch (e) {
      console.error('Failed to sync proxy settings:', e)
    }
  },

  async loadFromCloud(): Promise<ProxySettings | null> {
    if (!isCloudStorage()) return null
    try {
      const res = await fetch(`${getDataApiPath()}?action=proxySettings`)
      const { data } = await res.json()
      return data
    } catch (e) {
      console.error('Failed to load proxy settings from cloud:', e)
      return null
    }
  },
}

const SpiderProxySettingsStorage = {
  KEY: 'spiderProxySettings',
  
  get(): SpiderProxySettings {
    if (typeof window === 'undefined') return { enabled: false, workerUrl: '' }
    const data = localStorage.getItem(this.KEY)
    return data ? JSON.parse(data) : { enabled: false, workerUrl: '' }
  },

  save(settings: SpiderProxySettings): void {
    localStorage.setItem(this.KEY, JSON.stringify(settings))
  },

  async syncToCloud(settings: SpiderProxySettings): Promise<void> {
    if (!isCloudStorage()) return
    try {
      await fetch(getDataApiPath(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'spiderProxySettings',
          data: settings,
        }),
      })
    } catch (e) {
      console.error('Failed to sync spider proxy settings:', e)
    }
  },

  async loadFromCloud(): Promise<SpiderProxySettings | null> {
    if (!isCloudStorage()) return null
    try {
      const res = await fetch(`${getDataApiPath()}?action=spiderProxySettings`)
      const { data } = await res.json()
      return data
    } catch (e) {
      console.error('Failed to load spider proxy settings from cloud:', e)
      return null
    }
  },
}

export async function syncAllFromCloud(): Promise<void> {
  if (!isCloudStorage()) return

  try {
    const res = await fetch(`${getDataApiPath()}?action=all`)
    const data = await res.json()

    if (data.watchHistory && data.watchHistory.length > 0) {
      localStorage.setItem('watch_history', JSON.stringify(data.watchHistory))
    }

    if (data.searchHistory && data.searchHistory.length > 0) {
      const items = (data.searchHistory as string[]).map((keyword) => ({
        keyword,
        timestamp: Date.now(),
      }))
      localStorage.setItem('search_history', JSON.stringify(items))
    }

    if (data.videoSources && data.videoSources.length > 0) {
      localStorage.setItem('videoSources', JSON.stringify(data.videoSources))
    }

    if (data.proxySettings) {
      localStorage.setItem('proxySettings', JSON.stringify(data.proxySettings))
    }

    if (data.spiderProxySettings) {
      localStorage.setItem('spiderProxySettings', JSON.stringify(data.spiderProxySettings))
    }
  } catch (e) {
    console.error('Failed to sync all data from cloud:', e)
  }
}

export {
  WatchHistoryStorage,
  SearchHistoryStorage,
  VideoSourcesStorage,
  ProxySettingsStorage,
  SpiderProxySettingsStorage,
}
