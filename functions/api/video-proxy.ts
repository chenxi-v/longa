interface Context {
  request: Request
  env: unknown
  params: unknown
}

export const onRequest = async (context: Context) => {
  const url = new URL(context.request.url)
  const videoUrl = url.searchParams.get('url')
  const headersParam = url.searchParams.get('headers')

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type',
  }

  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  if (!videoUrl) {
    return new Response(JSON.stringify({ error: '缺少视频URL' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  }

  try {
    let headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    }

    if (headersParam) {
      try {
        const parsedHeaders = JSON.parse(headersParam)
        headers = { ...headers, ...parsedHeaders }
      } catch (e) {
        console.error('解析请求头失败:', e)
      }
    }

    const rangeHeader = context.request.headers.get('Range')
    if (rangeHeader) {
      headers['Range'] = rangeHeader
    }

    const response = await fetch(videoUrl, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        error: `视频请求失败: ${response.status}`,
        url: videoUrl 
      }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    }

    const contentType = response.headers.get('Content-Type') || 'application/octet-stream'
    const contentLength = response.headers.get('Content-Length')
    const contentRange = response.headers.get('Content-Range')

    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      ...corsHeaders,
    }

    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength
    }
    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange
    }

    const data = await response.arrayBuffer()

    return new Response(data, {
      status: response.status,
      headers: responseHeaders,
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
