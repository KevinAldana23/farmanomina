import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const hasDbUrl = !!process.env.DATABASE_URL;
  const dbUrlHost = process.env.DATABASE_URL ? (process.env.DATABASE_URL.split('@')[1] || '').split('/')[0] : 'none';

  try {
    const count = await prisma.employee.count();
    return NextResponse.json({
      status: 'ok',
      hasDbUrl,
      dbHost: dbUrlHost,
      employeeCount: count,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({
      status: 'error',
      hasDbUrl,
      errorMessage: error.message,
      errorName: error.name,
      errorCode: (err as { code?: string })?.code,
    }, { status: 500 });
  }
}
