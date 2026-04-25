import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase-server';

// POST /api/sessions/:id/capture
// body: { capturerId, partnerName, pairingId? }
export async function POST(request, { params }) {
  const body = await request.json();
  const { capturerId, partnerName, pairingId } = body;
  if (!capturerId || !partnerName) return new NextResponse('missing fields', { status: 400 });

  const admin = adminClient();

  // resolve partner participant id by name in this session
  const { data: partner } = await admin
    .from('participants')
    .select('id')
    .eq('session_id', params.id)
    .eq('name', partnerName)
    .limit(1)
    .single();

  if (!partner) return new NextResponse('partner not found', { status: 404 });

  const { error } = await admin
    .from('captures')
    .insert({
      session_id: params.id,
      capturer_id: capturerId,
      captured_id: partner.id,
      pairing_id: pairingId || null,
    });

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
