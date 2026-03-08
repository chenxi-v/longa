interface Context {
  request: Request
  env: unknown
  params: { path: string[] }
}

export const onRequest = async (context: Context) => {
  const url = new URL(context.request.url)
  const backendUrl = url.searchParams.get('backendUrl')
  const path = context.params.path ? context.params.path.join('/') : ''

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  if (!backendUrl) {
    return new Response(JSON.stringify({ error: '缺少后端地址' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  }

  try {
    let targetUrl = `${backendUrl}/api/${path}${url.search.replace('backendUrl=', 'backendUrl_removed=')}`.replace(/[?&]backendUrl_removed=[^&]*/, '').replace(/[?&]$/, '');
    // 强制使用IPv4地址，避免IPv6连接问题
    targetUrl = targetUrl.replace('localhost', '127.0.0.1');
    console.log('后端API代理 - 目标URL:', targetUrl);
    
    const fetchOptions: RequestInit = {
      method: context.request.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }

    if (context.request.method === 'POST' || context.request.method === 'PUT') {
      const body = await context.request.text()
      if (body) {
        fetchOptions.body = body
      }
    }

    const response = await fetch(targetUrl, fetchOptions)

    const contentType = response.headers.get('Content-Type') || 'application/json'
    
    if (!response.ok) {
      const errorText = await response.text()
      return new Response(errorText, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          ...corsHeaders,
        },
      })
    }

    const data = await response.text()
    
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        ...corsHeaders,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '请求失败'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  }
}
