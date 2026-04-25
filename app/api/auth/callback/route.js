import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// magic link callback: supabase redirects here after the user clicks the email link.
// we exchange the code in the URL for a session, then redirect to /host.
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/host';

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
