import { Redis } from '@upstash/redis'

type StorageType = 'localstorage' | 'upstash'

const STORAGE_TYPE: StorageType = (process.env.NEXT_PUBLIC_STORAGE_TYPE as StorageType) || 'localstorage'

let redisClient: Redis | null = null

function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient
  }

  const url = process.env.UPSTASH_URL
  const token = process.env.UPSTASH_TOKEN

  if (!url || !token) {
    return null
  }

  try {
    redisClient = new Redis({
      url,
      token,
    })
    return redisClient
  } catch {
    return null
  }
}

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (err: unknown) {
      const error = err as Error
      const isLastAttempt = i === maxRetries - 1
      const isConnectionError =
        error.message?.includes('Connection') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('ENOTFOUND') ||
        error.message?.includes('fetch failed')

      if (isConnectionError && !isLastAttempt) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
        continue
      }

      throw err
    }
  }

  throw new Error('超过最大重试次数')
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

export class DbManager {
  private client: Redis | null
  private storageType: StorageType

  constructor() {
    this.storageType = STORAGE_TYPE
    this.client = STORAGE_TYPE === 'upstash' ? getRedisClient() : null
  }

  getStorageType(): StorageType {
    return this.storageType
  }

  isUsingDatabase(): boolean {
    return this.client !== null
  }

  private whKey(user: string) {
    return `u:${user}:wh`
  }

  private shKey(user: string) {
    return `u:${user}:sh`
  }

  private sourcesKey(user: string) {
    return `u:${user}:sources`
  }

  private proxyKey(user: string) {
    return `u:${user}:proxy`
  }

  private spiderProxyKey(user: string) {
    return `u:${user}:spiderproxy`
  }

  async getWatchHistory(userName: string): Promise<WatchHistoryItem[]> {
    if (!this.client) return []
    try {
      const key = this.whKey(userName)
      const val = await withRetry(() => this.client!.get(key))
      return val ? (val as WatchHistoryItem[]) : []
    } catch {
      return []
    }
  }

  async setWatchHistory(userName: string, history: WatchHistoryItem[]): Promise<void> {
    if (!this.client) return
    try {
      const key = this.whKey(userName)
      await withRetry(() => this.client!.set(key, history))
    } catch {
      // Ignore error
    }
  }

  async getSearchHistory(userName: string): Promise<string[]> {
    if (!this.client) return []
    try {
      const key = this.shKey(userName)
      const result = await withRetry(() => this.client!.lrange(key, 0, -1))
      return result.map((item) => String(item))
    } catch {
      return []
    }
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    if (!this.client) return
    try {
      const key = this.shKey(userName)
      await withRetry(() => this.client!.lrem(key, 0, keyword))
      await withRetry(() => this.client!.lpush(key, keyword))
      await withRetry(() => this.client!.ltrim(key, 0, 19))
    } catch {
      // Ignore error
    }
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    if (!this.client) return
    try {
      const key = this.shKey(userName)
      if (keyword) {
        await withRetry(() => this.client!.lrem(key, 0, keyword))
      } else {
        await withRetry(() => this.client!.del(key))
      }
    } catch {
      // Ignore error
    }
  }

  async getVideoSources(userName: string): Promise<VideoSource[]> {
    if (!this.client) return []
    try {
      const key = this.sourcesKey(userName)
      const val = await withRetry(() => this.client!.get(key))
      return val ? (val as VideoSource[]) : []
    } catch {
      return []
    }
  }

  async setVideoSources(userName: string, sources: VideoSource[]): Promise<void> {
    if (!this.client) return
    try {
      const key = this.sourcesKey(userName)
      await withRetry(() => this.client!.set(key, sources))
    } catch {
      // Ignore error
    }
  }

  async getProxySettings(userName: string): Promise<ProxySettings | null> {
    if (!this.client) return null
    try {
      const key = this.proxyKey(userName)
      const val = await withRetry(() => this.client!.get(key))
      return val ? (val as ProxySettings) : null
    } catch {
      return null
    }
  }

  async setProxySettings(userName: string, settings: ProxySettings): Promise<void> {
    if (!this.client) return
    try {
      const key = this.proxyKey(userName)
      await withRetry(() => this.client!.set(key, settings))
    } catch {
      // Ignore error
    }
  }

  async getSpiderProxySettings(userName: string): Promise<SpiderProxySettings | null> {
    if (!this.client) return null
    try {
      const key = this.spiderProxyKey(userName)
      const val = await withRetry(() => this.client!.get(key))
      return val ? (val as SpiderProxySettings) : null
    } catch {
      return null
    }
  }

  async setSpiderProxySettings(userName: string, settings: SpiderProxySettings): Promise<void> {
    if (!this.client) return
    try {
      const key = this.spiderProxyKey(userName)
      await withRetry(() => this.client!.set(key, settings))
    } catch {
      // Ignore error
    }
  }

  async ping(): Promise<number> {
    if (!this.client) return 0
    const start = Date.now()
    try {
      await withRetry(() => this.client!.ping())
      return Date.now() - start
    } catch {
      return -1
    }
  }
}

export const db = new DbManager()

export function isCloudStorage(): boolean {
  return STORAGE_TYPE === 'upstash'
}
