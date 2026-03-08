import { Redis } from '@upstash/redis/cloudflare'

interface Context {
  request: Request
  env: {
    NEXT_PUBLIC_STORAGE_TYPE?: string
    UPSTASH_URL?: string
    UPSTASH_TOKEN?: string
  }
}

export const onRequest = async (context: Context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  const { NEXT_PUBLIC_STORAGE_TYPE, UPSTASH_URL, UPSTASH_TOKEN } = context.env
  const storageType = NEXT_PUBLIC_STORAGE_TYPE || 'localstorage'

  if (storageType !== 'upstash' || !UPSTASH_URL || !UPSTASH_TOKEN) {
    return new Response(JSON.stringify({
      connected: false,
      type: storageType,
      message: '使用本地浏览器存储',
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  }

  try {
    const redis = new Redis({
      url: UPSTASH_URL,
      token: UPSTASH_TOKEN,
    })

    const start = Date.now()
    await redis.ping()
    const latency = Date.now() - start

    return new Response(JSON.stringify({
      connected: true,
      type: storageType,
      latency,
      message: '已连接云端数据库',
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({
      connected: false,
      type: storageType,
      message: '云端数据库连接失败',
      error: message,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  }
}
