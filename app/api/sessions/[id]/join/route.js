import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase-server';

// POST /api/sessions/:id/join  body: { name }  — participant joins (no auth)
export async function POST(request, { params }) {
  const { name } = await request.json();
  if (!name || !name.trim()) return new NextResponse('name required', { status: 400 });

  const admin = adminClient();
  const { data: session } = await admin
    .from('sessions')
    .select('id, status')
    .eq('id', params.id)
    .single();
  if (!session) return new NextResponse('session not found', { status: 404 });
  if (session.status === 'ended') return new NextResponse('this session already ended', { status: 400 });

  const { data, error } = await admin
    .from('participants')
    .insert({
      session_id: session.id,
      name: name.trim().slice(0, 48),
      is_present: true,
    })
    .select('id')
    .single();

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ participantId: data.id });
}
