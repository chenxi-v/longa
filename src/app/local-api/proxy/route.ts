import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const apiUrl = url.searchParams.get('apiUrl');
  const wd = url.searchParams.get('wd');
  const pg = url.searchParams.get('pg');
  const ac = url.searchParams.get('ac');
  const ids = url.searchParams.get('ids');
  const t = url.searchParams.get('t');
  const proxyUrl = url.searchParams.get('proxyUrl');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (!apiUrl) {
    return NextResponse.json({ error: '缺少API地址' }, {
      status: 400,
      headers: corsHeaders,
    });
  }

  try {
    const targetUrl = new URL(apiUrl);
    
    if (wd) targetUrl.searchParams.set('wd', wd);
    if (pg) targetUrl.searchParams.set('pg', pg);
    if (ac) targetUrl.searchParams.set('ac', ac);
    if (ids) targetUrl.searchParams.set('ids', ids);
    if (t) targetUrl.searchParams.set('t', t);
    
    let finalUrl = targetUrl.toString();

    if (proxyUrl) {
      const workerUrl = proxyUrl.replace(/\/$/, '');
      finalUrl = `${workerUrl}/?url=${encodeURIComponent(finalUrl)}`;
    }

    console.log(`[Proxy] 请求URL: ${finalUrl}`);

    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    console.log(`[Proxy] 响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '无法读取响应');
      console.error(`[Proxy] API请求失败: ${response.status}`, errorText);
      throw new Error(`API请求失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '请求失败';
    console.error('[Proxy] 请求异常:', message, error);
    return NextResponse.json({ error: message }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
