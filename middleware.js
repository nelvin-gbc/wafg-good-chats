import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// guards /host/* routes. only authenticated AND approved hosts get in.
// participants on /r/[code] never hit this.
export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // only protect /host except /host/login
  if (!pathname.startsWith('/host') || pathname.startsWith('/host/login')) {
    return NextResponse.next();
  }

  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/host/login';
    return NextResponse.redirect(url);
  }

  // check approval flag
  const { data: host } = await supabase
    .from('hosts')
    .select('is_approved')
    .eq('id', user.id)
    .single();

  if (!host?.is_approved) {
    const url = request.nextUrl.clone();
    url.pathname = '/host/login';
    url.searchParams.set('pending', '1');
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/host/:path*'],
};
