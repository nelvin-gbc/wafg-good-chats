import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase-server';

// GET /api/sessions/:id/state?participantId=...  — returns current session + this participant's assignment
// also supports ?host=1  — returns all pairings for host control room
export async function GET(request, { params }) {
  const url = new URL(request.url);
  const participantId = url.searchParams.get('participantId');
  const isHostView = url.searchParams.get('host') === '1';

  const admin = adminClient();
  const { data: session } = await admin
    .from('sessions')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!session) return new NextResponse('not found', { status: 404 });

  const { data: participants = [] } = await admin
    .from('participants')
    .select('id, name, is_present, current_room_name, joined_at')
    .eq('session_id', session.id)
    .order('joined_at', { ascending: true });

  let assignment = null;
  if (participantId && session.status === 'running_round') {
    // find current pairing for this participant
    const { data: pairings = [] } = await admin
      .from('pairings')
      .select('id, participant_a_id, participant_b_id, room_name, room_label, round_id, rounds!inner(round_number, prompt_text, started_at)')
      .eq('session_id', session.id)
      .eq('rounds.round_number', session.current_round);

    const myPairing = pairings.find(
      (p) => p.participant_a_id === participantId || p.participant_b_id === participantId
    );
    if (myPairing && myPairing.room_name) {
      const partnerId = myPairing.participant_a_id === participantId
        ? myPairing.participant_b_id
        : myPairing.participant_a_id;
      const partner = participants.find((p) => p.id === partnerId);
      const startedAt = new Date(myPairing.rounds.started_at).getTime();
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      assignment = {
        pairingId: myPairing.id,
        roomName: myPairing.room_name,
        roomLabel: myPairing.room_label,
        partnerName: partner?.name || 'your match',
        prompt: myPairing.rounds.prompt_text,
        secondsRemaining: Math.max(0, session.round_seconds - elapsed),
      };
    }
  }

  let pairings = [];
  if (isHostView && (session.status === 'running_round' || session.status === 'between_rounds')) {
    const { data } = await admin
      .from('pairings')
      .select('id, room_name, room_label, participant_a_id, participant_b_id, rounds!inner(round_number)')
      .eq('session_id', session.id)
      .eq('rounds.round_number', session.current_round || 0);
    const idToName = Object.fromEntries(participants.map((p) => [p.id, p.name]));
    pairings = (data || []).map((p) => ({
      id: p.id,
      room_name: p.room_name,
      room_label: p.room_label,
      participant_a_name: idToName[p.participant_a_id],
      participant_b_name: p.participant_b_id ? idToName[p.participant_b_id] : null,
    }));
  }

  return NextResponse.json({
    session: {
      id: session.id,
      code: session.code,
      name: session.name,
      status: session.status,
      current_round: session.current_round,
      current_round_started_at: session.current_round_started_at,
      rounds_total: session.rounds_total,
      round_seconds: session.round_seconds,
      prompts: session.prompts,
      main_room_name: session.main_room_name,
    },
    participants,
    assignment,
    pairings,
  });
}
