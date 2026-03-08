/**
 * 爬虫API相关类型定义
 */

export interface SpiderSource {
  key: string;
  name: string;
  api: string;
  ext?: string;
  jar?: string;
  type: 'python' | 'javascript' | 'jar';
  enabled: boolean;
  proxy_enabled?: boolean;
  proxy_url?: string;
}

export interface SpiderSourceCard {
  key: string;
  name: string;
  connected: boolean;
  enabled?: boolean;
  proxyEnabled?: boolean;
}

export interface SpiderCategory {
  type_id: number;
  type_name: string;
}

export interface SpiderFilterValue {
  n: string;
  v: string;
}

export interface SpiderFilter {
  key: string;
  name: string;
  value: SpiderFilterValue[];
}

export interface SpiderVideoItem {
  vod_id: number;
  vod_name: string;
  vod_pic?: string;
  vod_remarks?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_area?: string;
  vod_year?: string;
  vod_score?: string;
  type_id: number;
  type_name: string;
  sourceKey?: string;
  sourceName?: string;
}

export interface SpiderHomeResponse {
  class: SpiderCategory[];
  list: SpiderVideoItem[];
  filters?: Record<string, SpiderFilter[]>;
}

export interface SpiderCategoryResponse {
  page: number;
  pagecount: number;
  limit: number;
  total: number;
  list: SpiderVideoItem[];
}

export interface SpiderDetailResponse {
  vod_id: number;
  vod_name: string;
  vod_pic?: string;
  vod_remarks?: string;
  vod_content?: string;
  vod_play_from?: string;
  vod_play_url?: Array<{
    name: string;
    url: string[];
  }>;
}

export interface SpiderPlayerResponse {
  parse: number;
  url: string;
  header?: Record<string, string>;
  jx?: string;
}
