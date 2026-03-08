export interface PlayRecord {
  title: string;
  source_name: string;
  cover: string;
  year: string;
  index: number;
  total_episodes: number;
  play_time: number;
  total_time: number;
  save_time: number;
  search_title: string;
  remarks?: string;
  douban_id?: number;
  type?: string;
}

export interface Favorite {
  source_name: string;
  total_episodes: number;
  title: string;
  year: string;
  cover: string;
  save_time: number;
  search_title: string;
  origin?: 'vod' | 'live' | 'shortdrama';
  type?: string;
  releaseDate?: string;
  remarks?: string;
}

export interface VideoSource {
  id: string;
  name: string;
  key: string;
  apiUrl: string;
  enabled: boolean;
}

export interface ProxySettings {
  enabled: boolean;
  proxyUrl: string;
}

export interface AuthInfo {
  username?: string;
  password?: string;
  signature?: string;
  timestamp?: number;
  loginTime?: number;
}

export interface IStorage {
  getPlayRecord(userName: string, key: string): Promise<PlayRecord | null>;
  setPlayRecord(userName: string, key: string, record: PlayRecord): Promise<void>;
  getAllPlayRecords(userName: string): Promise<Record<string, PlayRecord>>;
  deletePlayRecord(userName: string, key: string): Promise<void>;

  getFavorite(userName: string, key: string): Promise<Favorite | null>;
  setFavorite(userName: string, key: string, favorite: Favorite): Promise<void>;
  getAllFavorites(userName: string): Promise<Record<string, Favorite>>;
  deleteFavorite(userName: string, key: string): Promise<void>;

  getSearchHistory(userName: string): Promise<string[]>;
  addSearchHistory(userName: string, keyword: string): Promise<void>;
  deleteSearchHistory(userName: string, keyword?: string): Promise<void>;

  getVideoSources(userName: string): Promise<VideoSource[]>;
  setVideoSources(userName: string, sources: VideoSource[]): Promise<void>;

  getProxySettings(userName: string): Promise<ProxySettings | null>;
  setProxySettings(userName: string, settings: ProxySettings): Promise<void>;

  ping(): Promise<number>;
}

export function generateStorageKey(source: string, id: string): string {
  return `${source}+${id}`;
}
