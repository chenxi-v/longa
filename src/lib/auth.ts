import { NextRequest } from 'next/server';
import { AuthInfo } from './types';

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

export function getAuthInfoFromCookie(request: NextRequest): AuthInfo | null {
  const authCookie = request.cookies.get('user_auth');

  if (!authCookie) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(authCookie.value);
    
    if (decoded.startsWith('eyJ')) {
      const jwtPayload = parseJwt(decoded)
      if (jwtPayload && jwtPayload.username) {
        return {
          username: jwtPayload.username,
          timestamp: Date.now(),
          loginTime: Date.now()
        }
      }
    }
    
    const authData = JSON.parse(decoded);
    return authData;
  } catch {
    const jwtPayload = parseJwt(authCookie.value)
    if (jwtPayload && jwtPayload.username) {
      return {
        username: jwtPayload.username,
        timestamp: Date.now(),
        loginTime: Date.now()
      }
    }
    return null;
  }
}

export function getAuthInfoFromBrowserCookie(): AuthInfo | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const trimmed = cookie.trim();
      const firstEqualIndex = trimmed.indexOf('=');

      if (firstEqualIndex > 0) {
        const key = trimmed.substring(0, firstEqualIndex);
        const value = trimmed.substring(firstEqualIndex + 1);
        if (key && value) {
          acc[key] = value;
        }
      }

      return acc;
    }, {} as Record<string, string>);

    const authCookie = cookies['user_auth'];
    if (!authCookie) {
      return null;
    }

    let decoded = decodeURIComponent(authCookie);

    if (decoded.startsWith('eyJ')) {
      const payload = atob(decoded.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'));
      const jwtData = JSON.parse(payload);
      if (jwtData.username) {
        return {
          username: jwtData.username,
          timestamp: Date.now(),
          loginTime: Date.now()
        };
      }
    }

    if (decoded.includes('%')) {
      decoded = decodeURIComponent(decoded);
    }

    const authData = JSON.parse(decoded);
    return authData;
  } catch {
    return null;
  }
}

export async function generateSignature(
  data: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifySignature(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBuffer = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    return await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      messageData
    );
  } catch {
    return false;
  }
}

export async function generateAuthCookie(
  username: string,
  password: string
): Promise<string> {
  const authData: AuthInfo = {
    username,
    timestamp: Date.now(),
    loginTime: Date.now(),
  };

  if (password) {
    authData.signature = await generateSignature(username, password);
  }

  return encodeURIComponent(JSON.stringify(authData));
}
