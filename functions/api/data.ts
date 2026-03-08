import { Redis } from '@upstash/redis/cloudflare'

interface Context {
  request: Request
  env: {
    NEXT_PUBLIC_STORAGE_TYPE?: string
    UPSTASH_URL?: string
    UPSTASH_TOKEN?: string
    ADMIN_USERNAME?: string
    ADMIN_PASSWORD?: string
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function parseJwt(token: string): { username?: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(payload)
  } catch {
    return null
  }
}

function getUsername(request: Request, body?: { username?: string }): string {
  if (body?.username) {
    return body.username
  }

  const url = new URL(request.url)
  const usernameParam = url.searchParams.get('username')
  if (usernameParam) {
    return usernameParam
  }

  const cookieHeader = request.headers.get('Cookie') || ''
  const authCookie = cookieHeader
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('user_auth='))

  if (!authCookie) return 'default'

  try {
    let token = decodeURIComponent(authCookie.split('=')[1])
    
    if (token.startsWith('eyJ')) {
      const jwtPayload = parseJwt(token)
      if (jwtPayload && jwtPayload.username) {
        return jwtPayload.username
      }
    }
    
    const data = JSON.parse(token)
    return data.username || 'default'
  } catch {
    return 'default'
  }
}

export const onRequest = async (context: Context) => {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  const { NEXT_PUBLIC_STORAGE_TYPE, UPSTASH_URL, UPSTASH_TOKEN } = context.env

  if (NEXT_PUBLIC_STORAGE_TYPE !== 'upstash' || !UPSTASH_URL || !UPSTASH_TOKEN) {
    return new Response(JSON.stringify({ error: 'Cloud storage not enabled' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN })

  if (context.request.method === 'GET') {
    const username = getUsername(context.request)
    const url = new URL(context.request.url)
    const action = url.searchParams.get('action')

    try {
      switch (action) {
        case 'watchHistory': {
          const val = await redis.get(`u:${username}:wh`)
          return new Response(JSON.stringify({ data: val || [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
        case 'searchHistory': {
          const result = await redis.lrange(`u:${username}:sh`, 0, -1)
          return new Response(JSON.stringify({ data: result.map(String) }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
        case 'videoSources': {
          const val = await redis.get(`u:${username}:sources`)
          return new Response(JSON.stringify({ data: val || [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
        case 'proxySettings': {
          const val = await redis.get(`u:${username}:proxy`)
          return new Response(JSON.stringify({ data: val }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
        case 'spiderProxySettings': {
          const val = await redis.get(`u:${username}:spiderproxy`)
          return new Response(JSON.stringify({ data: val }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
        case 'all': {
          const [watchHistory, searchHistory, videoSources, proxySettings, spiderProxySettings] = await Promise.all([
            redis.get(`u:${username}:wh`),
            redis.lrange(`u:${username}:sh`, 0, -1),
            redis.get(`u:${username}:sources`),
            redis.get(`u:${username}:proxy`),
            redis.get(`u:${username}:spiderproxy`),
          ])

          return new Response(JSON.stringify({
            watchHistory: watchHistory || [],
            searchHistory: searchHistory.map(String),
            videoSources: videoSources || [],
            proxySettings,
            spiderProxySettings,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
        default:
          return new Response(JSON.stringify({ error: 'Invalid action' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch data'
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
  }

  if (context.request.method === 'POST') {
    try {
      const body = await context.request.json()
      const { action, data, username: bodyUsername } = body
      const username = getUsername(context.request, { username: bodyUsername })

      switch (action) {
        case 'watchHistory': {
          await redis.set(`u:${username}:wh`, data)
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
        case 'addSearchHistory': {
          const { keyword } = data
          const shKey = `u:${username}:sh`
          await redis.lrem(shKey, 0, keyword)
          await redis.lpush(shKey, keyword)
          await redis.ltrim(shKey, 0, 19)
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
        case 'deleteSearchHistory': {
          const { keyword } = data
          const shKey = `u:${username}:sh`
          if (keyword) {
            await redis.lrem(shKey, 0, keyword)
          } else {
            await redis.del(shKey)
          }
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
        case 'videoSources': {
          await redis.set(`u:${username}:sources`, data)
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
        case 'proxySettings': {
          await redis.set(`u:${username}:proxy`, data)
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
        case 'spiderProxySettings': {
          await redis.set(`u:${username}:spiderproxy`, data)
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
        }
        default:
          return new Response(JSON.stringify({ error: 'Invalid action' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save data'
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
