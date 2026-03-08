interface Context {
  request: Request
  env: {
    ADMIN_USERNAME?: string
    ADMIN_PASSWORD?: string
  }
  next: () => Promise<Response>
}

const SKIP_PATHS = [
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/manifest.json',
  '/icons/',
  '/logo.png',
  '/api/login',
  '/api/logout',
  '/api/db-status',
  '/api/data',
  '/api/proxy',
  '/api/video-proxy',
  '/api/health',
  '/api/spider-proxy',
  '/api/backend',
  '/login',
]

function shouldSkipAuth(pathname: string): boolean {
  if (SKIP_PATHS.some(path => pathname.startsWith(path))) {
    return true
  }
  
  if (pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    return true
  }
  
  return false
}

async function verify(token: string, secret: string): Promise<{ username: string } | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [header, payload, signature] = parts
    const data = `${header}.${payload}`
    
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    
    const signatureBytes = new Uint8Array(
      atob(signature).split('').map(c => c.charCodeAt(0))
    )
    
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(data)
    )
    
    if (!isValid) return null
    
    const payloadData = JSON.parse(atob(payload))
    
    if (payloadData.exp && payloadData.exp < Math.floor(Date.now() / 1000)) {
      return null
    }
    
    return { username: payloadData.username }
  } catch {
    return null
  }
}

export const onRequest = async (context: Context) => {
  const { request, env, next } = context
  const url = new URL(request.url)
  const pathname = url.pathname

  if (shouldSkipAuth(pathname)) {
    return next()
  }

  const { ADMIN_USERNAME, ADMIN_PASSWORD } = env

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    if (pathname.startsWith('/api/')) {
      return new Response('Unauthorized', { status: 401 })
    }

    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'not_configured')
    return Response.redirect(loginUrl.toString(), 302)
  }

  const cookieHeader = request.headers.get('Cookie') || ''
  const authCookie = cookieHeader
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('user_auth='))

  if (!authCookie) {
    return handleAuthFailure(request, pathname)
  }

  const token = decodeURIComponent(authCookie.split('=')[1])
  const decoded = await verify(token, ADMIN_PASSWORD)

  if (!decoded || decoded.username !== ADMIN_USERNAME) {
    return handleAuthFailure(request, pathname)
  }

  return next()
}

function handleAuthFailure(request: Request, pathname: string): Response {
  if (pathname.startsWith('/api/')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('redirect', pathname)
  return Response.redirect(loginUrl.toString(), 302)
}
