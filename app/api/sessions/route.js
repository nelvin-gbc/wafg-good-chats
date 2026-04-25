import { NextResponse } from 'next/server';
import { createClient, adminClient } from '@/lib/supabase-server';

// POST /api/sessions  — host creates a new session
export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('not authenticated', { status: 401 });

  const body = await request.json();
  const { name, code, rounds_total, round_seconds, prompts, start_now } = body;

  if (!name || !code || !rounds_total || !round_seconds || !prompts) {
    return new NextResponse('missing fields', { status: 400 });
  }

  const admin = adminClient();
  const status = start_now ? 'live' : 'draft';

  const { data, error } = await admin
    .from('sessions')
    .insert({
      name,
      code,
      host_id: user.id,
      rounds_total,
      round_seconds,
      prompts,
      status,
    })
    .select('id, code')
    .single();

  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json({ id: data.id, code: data.code });
}
