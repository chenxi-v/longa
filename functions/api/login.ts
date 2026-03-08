interface Context {
  request: Request
  env: {
    ADMIN_USERNAME?: string
    ADMIN_PASSWORD?: string
  }
}

async function sign(payload: { username: string }, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payloadStr = btoa(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 604800 }))
  
  const data = `${header}.${payloadStr}`
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  const signatureStr = btoa(String.fromCharCode(...new Uint8Array(signature)))
  
  return `${data}.${signatureStr}`
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const onRequest = async (context: Context) => {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  const { ADMIN_USERNAME, ADMIN_PASSWORD } = context.env

  if (context.request.method === 'GET') {
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    }

    const cookieHeader = context.request.headers.get('Cookie') || ''
    const authCookie = cookieHeader
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('user_auth='))

    if (!authCookie) {
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    }

    const token = decodeURIComponent(authCookie.split('=')[1])
    const decoded = await verify(token, ADMIN_PASSWORD)

    if (!decoded || decoded.username !== ADMIN_USERNAME) {
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    }

    return new Response(JSON.stringify({ authenticated: true, username: decoded.username }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  }

  if (context.request.method === 'POST') {
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: '系统未配置登录凭据' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    }

    try {
      const body = await context.request.json()
      const { username, password } = body as { username: string; password: string }

      if (!username || !password) {
        return new Response(JSON.stringify({ error: '请输入用户名和密码' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        })
      }

      if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        })
      }

      const token = await sign({ username }, ADMIN_PASSWORD)

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `user_auth=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=604800`,
          ...corsHeaders,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录失败'
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    }
  }

  return new Response(JSON.stringify({ error: '方法不允许' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}
