import { NextRequest, NextResponse } from 'next/server'
import { db, isCloudStorage, WatchHistoryItem, VideoSource, ProxySettings, SpiderProxySettings } from '@/lib/db'

function parseJwt(token: string): { username?: string } | null {
  try {
    const base64Payload = token.split('.')[1]
    if (!base64Payload) return null
    const payload = Buffer.from(base64Payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    return JSON.parse(payload)
  } catch {
    return null
  }
}

function getUsername(request: NextRequest, body?: { username?: string }): string {
  if (body?.username) {
    return body.username
  }
  
  const cookie = request.cookies.get('user_auth')
  
  if (!cookie) {
    return 'default'
  }
  
  try {
    let decoded = decodeURIComponent(cookie.value)
    
    if (decoded.startsWith('eyJ')) {
      const jwtPayload = parseJwt(decoded)
      if (jwtPayload && jwtPayload.username) {
        return jwtPayload.username
      }
    }
    
    const data = JSON.parse(decoded)
    return data.username || 'default'
  } catch {
    return 'default'
  }
}

export async function GET(request: NextRequest) {
  if (!isCloudStorage()) {
    return NextResponse.json({ error: 'Cloud storage not enabled' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const usernameParam = searchParams.get('username')
  const username = usernameParam || getUsername(request)

  try {
    switch (action) {
      case 'watchHistory': {
        const data = await db.getWatchHistory(username)
        return NextResponse.json({ data })
      }
      case 'searchHistory': {
        const data = await db.getSearchHistory(username)
        return NextResponse.json({ data })
      }
      case 'videoSources': {
        const data = await db.getVideoSources(username)
        return NextResponse.json({ data })
      }
      case 'proxySettings': {
        const data = await db.getProxySettings(username)
        return NextResponse.json({ data })
      }
      case 'spiderProxySettings': {
        const data = await db.getSpiderProxySettings(username)
        return NextResponse.json({ data })
      }
      case 'all': {
        const [watchHistory, searchHistory, videoSources, proxySettings, spiderProxySettings] = await Promise.all([
          db.getWatchHistory(username),
          db.getSearchHistory(username),
          db.getVideoSources(username),
          db.getProxySettings(username),
          db.getSpiderProxySettings(username),
        ])
        return NextResponse.json({
          watchHistory,
          searchHistory,
          videoSources,
          proxySettings,
          spiderProxySettings,
        })
      }
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Data API error:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!isCloudStorage()) {
    return NextResponse.json({ error: 'Cloud storage not enabled' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { action, data, username: bodyUsername } = body
    
    const username = bodyUsername || getUsername(request, body)

    switch (action) {
      case 'watchHistory': {
        const history = data as WatchHistoryItem[]
        await db.setWatchHistory(username, history)
        return NextResponse.json({ success: true })
      }
      case 'addSearchHistory': {
        const { keyword } = data as { keyword: string }
        await db.addSearchHistory(username, keyword)
        return NextResponse.json({ success: true })
      }
      case 'deleteSearchHistory': {
        const { keyword } = data as { keyword?: string }
        await db.deleteSearchHistory(username, keyword)
        return NextResponse.json({ success: true })
      }
      case 'videoSources': {
        const sources = data as VideoSource[]
        await db.setVideoSources(username, sources)
        return NextResponse.json({ success: true })
      }
      case 'proxySettings': {
        const settings = data as ProxySettings
        await db.setProxySettings(username, settings)
        return NextResponse.json({ success: true })
      }
      case 'spiderProxySettings': {
        const settings = data as SpiderProxySettings
        await db.setSpiderProxySettings(username, settings)
        return NextResponse.json({ success: true })
      }
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Data API error:', error)
    return NextResponse.json({ error: 'Failed to save data' }, { status: 500 })
  }
}
