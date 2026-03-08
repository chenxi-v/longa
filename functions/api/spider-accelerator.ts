interface Context {
  request: Request
  env: unknown
  params: unknown
}

export const onRequest = async (context: Context) => {
  const url = new URL(context.request.url)
  const backendUrl = url.searchParams.get('backendUrl')
  const spiderKey = url.searchParams.get('spiderKey')
  const targetUrl = url.searchParams.get('targetUrl')

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,User-Agent',
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

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: '缺少目标URL' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  }

  try {
    const fetchOptions: RequestInit = {
      method: context.request.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
    }

    if (context.request.method === 'POST') {
      const body = await context.request.text()
      if (body) {
        fetchOptions.body = body
      }
    }

    const response = await fetch(targetUrl, fetchOptions)

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: `目标请求失败: ${response.status}`,
        code: 1 
      }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    }

    const contentType = response.headers.get('Content-Type') || 'application/json'
    
    if (contentType.includes('application/json')) {
      const data = await response.json()
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    } else {
      const data = await response.arrayBuffer()
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          ...corsHeaders,
        },
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '请求失败'
    return new Response(JSON.stringify({ error: message, code: 1 }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  }
}