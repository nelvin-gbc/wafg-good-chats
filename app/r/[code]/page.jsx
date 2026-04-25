import { adminClient } from '@/lib/supabase-server';
import JoinForm from './JoinForm';

export default async function JoinPage({ params }) {
  const supabase = adminClient();
  const { data: session } = await supabase
    .from('sessions')
    .select('id, code, name, status, rounds_total, round_seconds')
    .eq('code', params.code)
    .single();

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8" style={{ background: '#f4f4f1' }}>
        <div className="max-w-md text-center">
          <div className="display text-5xl mb-4">we don't<br/>see this one.</div>
          <p className="text-neutral-600 mb-6">
            [the code doesn't match an event we know about. ask whoever sent you the link to double-check.]
          </p>
          <a href="/" className="text-sm underline">back home</a>
        </div>
      </main>
    );
  }

  return <JoinForm session={session} />;
}
