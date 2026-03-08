import { NextRequest, NextResponse } from 'next/server';
import { generateAuthCookie, verifySignature } from '@/lib/auth';

export const runtime = 'nodejs';

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

export async function POST(req: NextRequest) {
  try {
    const envUsername = process.env.ADMIN_USERNAME;
    const envPassword = process.env.ADMIN_PASSWORD;

    if (!envUsername || !envPassword) {
      return NextResponse.json(
        { ok: false, error: '系统未配置登录凭据，请联系管理员' },
        { status: 500 }
      );
    }

    const { username, password } = await req.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: '用户名不能为空' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
    }

    if (username !== envUsername || password !== envPassword) {
      return NextResponse.json(
        { ok: false, error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true, username });
    const cookieValue = await generateAuthCookie(username, password);
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);

    response.cookies.set('user_auth', cookieValue, {
      path: '/',
      expires,
      sameSite: 'lax',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (error) {
    console.error('登录接口异常', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('user_auth');
    
    if (!authCookie) {
      return NextResponse.json({ authenticated: false });
    }

    let decoded = decodeURIComponent(authCookie.value);
    
    let authData: { username?: string; signature?: string };
    
    if (decoded.startsWith('eyJ')) {
      const jwtPayload = parseJwt(decoded)
      if (jwtPayload && jwtPayload.username) {
        authData = jwtPayload
      } else {
        return NextResponse.json({ authenticated: false });
      }
    } else {
      try {
        authData = JSON.parse(decoded);
      } catch {
        const jwtPayload = parseJwt(decoded)
        if (jwtPayload && jwtPayload.username) {
          authData = jwtPayload
        } else {
          return NextResponse.json({ authenticated: false });
        }
      }
    }

    const envUsername = process.env.ADMIN_USERNAME;
    const envPassword = process.env.ADMIN_PASSWORD;

    if (!envUsername || !envPassword) {
      return NextResponse.json({ authenticated: false });
    }

    if (authData.username !== envUsername) {
      return NextResponse.json({ authenticated: false });
    }

    if (authData.signature) {
      const isValid = await verifySignature(authData.username, authData.signature, envPassword);
      if (!isValid) {
        return NextResponse.json({ authenticated: false });
      }
    }

    return NextResponse.json({ 
      authenticated: true, 
      username: authData.username 
    });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
