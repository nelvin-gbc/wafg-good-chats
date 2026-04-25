import { NextResponse } from 'next/server';
import { createMeetingToken, roomUrl } from '@/lib/daily';

// POST /api/daily/token  body: { roomName, userName, isOwner? }
// returns: { token, url }
export async function POST(request) {
  const { roomName, userName, isOwner = false } = await request.json();
  if (!roomName || !userName) return new NextResponse('missing fields', { status: 400 });

  try {
    const token = await createMeetingToken({
      roomName,
      userName,
      isOwner,
      expMinutes: 30,
    });
    return NextResponse.json({ token, url: roomUrl(roomName) });
  } catch (e) {
    return new NextResponse(e.message, { status: 500 });
  }
}
