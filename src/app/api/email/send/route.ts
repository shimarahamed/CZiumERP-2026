import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    { ok: false, error: 'Email sending has moved to Firebase Cloud Functions.' },
    { status: 410 }
  );
}
