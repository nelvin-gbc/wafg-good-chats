import { NextResponse } from 'next/server';
import { createClient, adminClient } from '@/lib/supabase-server';
import { deleteRoom } from '@/lib/daily';

// POST /api/sessions/:id/end  — host ends session early or after final round
export async function POST(_request, { params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('not authenticated', { status: 401 });

  const admin = adminClient();
  const { data: session } = await admin.from('sessions').select('*').eq('id', params.id).single();
  if (!session) return new NextResponse('session not found', { status: 404 });
  if (session.host_id !== user.id) return new NextResponse('forbidden', { status: 403 });

  // tear down all daily rooms (main + any active pair rooms)
  const { data: pairings = [] } = await admin.from('pairings').select('room_name').eq('session_id', session.id);
  const cleanupPromises = pairings.filter((p) => p.room_name).map((p) => deleteRoom(p.room_name).catch(() => {}));
  if (session.main_room_name) cleanupPromises.push(deleteRoom(session.main_room_name).catch(() => {}));
  await Promise.all(cleanupPromises);

  await admin
    .from('participants')
    .update({ current_room_name: null, is_present: false, left_at: new Date().toISOString() })
    .eq('session_id', session.id);

  await admin
    .from('sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', session.id);

  return NextResponse.json({ ok: true });
}
