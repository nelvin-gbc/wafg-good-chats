import { NextResponse } from 'next/server';
import { createClient, adminClient } from '@/lib/supabase-server';
import { createRoom } from '@/lib/daily';

// POST /api/sessions/:id/start  — flip from draft → live and provision the main daily room
export async function POST(_request, { params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('not authenticated', { status: 401 });

  const admin = adminClient();
  const { data: session, error } = await admin
    .from('sessions')
    .select('*')
    .eq('id', params.id)
    .single();
  if (error || !session) return new NextResponse('session not found', { status: 404 });
  if (session.host_id !== user.id) return new NextResponse('forbidden', { status: 403 });
  if (session.status !== 'draft' && session.status !== 'live') {
    return new NextResponse('session already started', { status: 400 });
  }

  // create the main daily room if not already
  let mainRoomName = session.main_room_name;
  if (!mainRoomName) {
    const room = await createRoom({
      name: `wafg-main-${session.code}-${Date.now().toString(36)}`,
      expMinutes: Math.max(120, (session.rounds_total + 2) * Math.ceil(session.round_seconds / 60) + 30),
      isMain: true,
    });
    mainRoomName = room.name;
  }

  await admin
    .from('sessions')
    .update({ status: 'live', main_room_name: mainRoomName })
    .eq('id', session.id);

  return NextResponse.json({ ok: true, mainRoomName });
}
