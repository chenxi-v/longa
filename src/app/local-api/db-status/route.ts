import { NextResponse } from 'next/server';
import { db, isCloudStorage } from '@/lib/db';

export async function GET() {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  
  if (!isCloudStorage()) {
    return NextResponse.json({
      connected: false,
      type: storageType,
      message: '使用本地浏览器存储',
    });
  }

  try {
    const latency = await db.ping();
    
    return NextResponse.json({
      connected: true,
      type: storageType,
      latency,
      message: '已连接云端数据库',
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      type: storageType,
      message: '云端数据库连接失败',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
