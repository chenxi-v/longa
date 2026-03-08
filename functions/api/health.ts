interface Context {
  request: Request
  env: unknown
  params: unknown
}

export const onRequest = async (context: Context) => {
  const url = new URL(context.request.url)
  const backendUrl = url.searchParams.get('backendUrl')

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
    // 强制使用IPv4地址，避免IPv6连接问题
    let targetUrl = `${backendUrl}/health`;
    targetUrl = targetUrl.replace('localhost', '127.0.0.1');
    console.log('健康检查 - 目标URL:', targetUrl);
    
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        status: 'unhealthy',
        error: `后端请求失败: ${response.status}`
      }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    }

    const data = await response.json()
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '请求失败'
    return new Response(JSON.stringify({ status: 'unhealthy', error: message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  }
}
