'use client';
import { useEffect, useState } from 'react';
import { colorForName, initials } from '@/lib/brand';

export default function LiveControl({ session: initialSession }) {
  const [session, setSession] = useState(initialSession);
  const [participants, setParticipants] = useState([]);
  const [pairings, setPairings] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);

  // poll session state
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/sessions/${session.id}/state?host=1`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setSession((s) => ({ ...s, ...data.session }));
        setParticipants(data.participants || []);
        setPairings(data.pairings || []);
        if (data.session?.current_round_started_at) {
          const startedAt = new Date(data.session.current_round_started_at).getTime();
          const elapsed = Math.floor((Date.now() - startedAt) / 1000);
          setSecondsLeft(Math.max(0, session.round_seconds - elapsed));
        }
      } catch {}
    }
    poll();
    const id = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [session.id, session.round_seconds]);

  // local timer tick (between server polls)
  useEffect(() => {
    if (session.status !== 'running_round') return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [session.status]);

  async function action(path, body) {
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) alert(await res.text());
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  const isPre = session.status === 'draft' || session.status === 'live';
  const isRunning = session.status === 'running_round';
  const isBetween = session.status === 'between_rounds';
  const isEnded = session.status === 'ended';

  const promptIdx = (session.current_round || 1) - 1;
  const currentPrompt = session.prompts?.[promptIdx]?.text;
  const nextPrompt = session.prompts?.[(session.current_round || 0)]?.text;

  return (
    <main className="min-h-screen flex flex-col text-white" style={{ background: '#0a0a0a' }}>
      <header className="border-b border-neutral-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/host" className="text-xs text-neutral-500 hover:text-white">← dashboard</a>
          <span className="text-neutral-600">·</span>
          <span className="text-sm font-semibold">{session.name}</span>
          <span className="text-xs text-neutral-500">/r/{session.code}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded ${isRunning ? 'animate-pulse' : ''}`} style={{ background: isEnded ? '#444' : '#01ecf3', color: isEnded ? '#aaa' : '#000' }}>
            {session.status.replace(/_/g, ' ')}
          </span>
          <span className="text-sm text-neutral-400">
            <strong style={{ color: '#01ecf3' }}>{participants.filter((p) => p.is_present).length}</strong> here
          </span>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr,400px] overflow-hidden">

        {/* main */}
        <div className="p-8 overflow-y-auto">
          {isPre && (
            <div>
              <div className="display text-5xl mb-2">ready when you are.</div>
              <p className="text-neutral-400 mb-6">share <span className="font-mono" style={{ color: '#01ecf3' }}>wafg.app/r/{session.code}</span> · folks land in the main room with you.</p>
              <button onClick={() => action('start')} disabled={busy} className="btn-cyan px-8 py-5 rounded-md text-2xl">
                go live *
              </button>
              <p className="text-sm text-neutral-500 mt-4">[this opens the main room · then click "kick it off" once people are in]</p>
            </div>
          )}

          {(session.status === 'live' || isBetween) && (
            <div>
              <div className="display text-3xl mb-2">main room is open.</div>
              <p className="text-neutral-400 mb-6">
                {isBetween ? `round ${session.current_round} just wrapped · ${session.rounds_total - session.current_round} more to go.` : 'everyone\'s gathering · kick it off when ready.'}
              </p>
              {nextPrompt && (
                <div className="mb-6 p-5 rounded-md" style={{ background: 'rgba(1,236,243,0.1)', border: '1px solid rgba(1,236,243,0.3)' }}>
                  <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: '#01ecf3' }}>next prompt · round {(session.current_round || 0) + 1}</div>
                  <div className="display text-2xl">{nextPrompt}</div>
                </div>
              )}
              <button onClick={() => action('round', { action: 'start' })} disabled={busy} className="btn-cyan px-8 py-5 rounded-md text-2xl">
                {isBetween ? `start round ${session.current_round + 1} *` : 'kick it off *'}
              </button>
            </div>
          )}

          {isRunning && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold mb-2 animate-pulse" style={{ color: '#01ecf3' }}>round {session.current_round} of {session.rounds_total} · live</div>
              <div className="display text-9xl mb-6" style={{ color: secondsLeft <= 30 ? '#fbbf24' : '#01ecf3' }}>
                {fmtTime(secondsLeft)}
              </div>
              {currentPrompt && (
                <div className="mb-6 p-5 rounded-md" style={{ background: 'rgba(1,236,243,0.1)', border: '1px solid rgba(1,236,243,0.3)' }}>
                  <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: '#01ecf3' }}>this round's prompt</div>
                  <div className="display text-2xl">{currentPrompt}</div>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => action('round', { action: 'end' })} disabled={busy} className="btn-cyan px-6 py-4 rounded-md text-lg">end round early *</button>
                <button onClick={() => { if (confirm('end the whole session and bring everyone back to the main room?')) action('end'); }} disabled={busy} className="px-6 py-4 rounded-md border-2 border-red-500 text-red-400 hover:bg-red-500 hover:text-white font-semibold">end session early</button>
              </div>
            </div>
          )}

          {isEnded && (
            <div>
              <div className="display text-5xl mb-2">that's a wrap.</div>
              <p className="text-neutral-400 mb-6">{participants.length} people · {pairings.length} pairings.</p>
              <a href="/host" className="btn-cyan px-6 py-4 rounded-md text-lg inline-block no-underline">back to dashboard *</a>
            </div>
          )}
        </div>

        {/* right rail */}
        <aside className="bg-black border-l border-neutral-800 p-6 overflow-y-auto flex flex-col gap-5">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold mb-3 text-neutral-500">people in main room ({participants.filter((p) => p.is_present && !p.current_room_name).length})</div>
            <div className="grid grid-cols-4 gap-2">
              {participants.filter((p) => p.is_present && !p.current_room_name).map((p) => (
                <div key={p.id} className="text-center">
                  <div className="w-12 h-12 mx-auto rounded-full display flex items-center justify-center text-black text-base" style={{ background: colorForName(p.name) }}>
                    {initials(p.name)}
                  </div>
                  <div className="text-[10px] mt-1 text-neutral-400 truncate">{p.name?.split(' ')[0]}</div>
                </div>
              ))}
            </div>
          </div>

          {pairings.length > 0 && isRunning && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold mb-3 text-neutral-500">live pairings</div>
              <div className="space-y-2">
                {pairings.map((pa) => (
                  <div key={pa.id} className="bg-neutral-900 border border-neutral-800 rounded p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pa.participant_a_name}</span>
                        <span className="text-neutral-500">×</span>
                        <span className="font-medium">{pa.participant_b_name || <span className="italic text-neutral-500">sit out</span>}</span>
                      </div>
                      <span className="text-[10px]" style={{ color: '#01ecf3' }}>* {pa.room_label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-neutral-800 pt-5">
            <div className="text-[10px] uppercase tracking-widest font-bold mb-3 text-neutral-500">session info</div>
            <div className="text-sm space-y-1 text-neutral-300">
              <div className="flex justify-between"><span>rounds</span><span style={{ color: '#01ecf3' }}>{session.current_round}/{session.rounds_total}</span></div>
              <div className="flex justify-between"><span>per round</span><span style={{ color: '#01ecf3' }}>{Math.round(session.round_seconds / 60)} min</span></div>
              <div className="flex justify-between"><span>total joined</span><span style={{ color: '#01ecf3' }}>{participants.length}</span></div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
