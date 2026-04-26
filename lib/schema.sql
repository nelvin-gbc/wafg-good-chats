-- ============================================================================
-- spread good chats · supabase schema
-- run this entire file in Supabase > SQL Editor > New query > Run
-- safe to run multiple times (uses IF NOT EXISTS / CREATE OR REPLACE)
-- ============================================================================

-- enable extensions
create extension if not exists "uuid-ossp";

-- ============================================================================
-- HOSTS · who's allowed to run sessions
-- ============================================================================
create table if not exists hosts (
  id uuid primary key references auth.users on delete cascade,
  email text unique not null,
  display_name text,
  is_approved boolean default false,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- auto-create a host record when someone signs up via magic link
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.hosts (id, email, display_name, is_approved)
  values (new.id, new.email, split_part(new.email, '@', 1), false)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- SESSIONS · a single speed networking event
-- ============================================================================
create table if not exists sessions (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,                  -- url slug, e.g. "november-gather"
  name text not null,
  host_id uuid references hosts(id) on delete set null,
  status text not null default 'draft',       -- draft | live | running_round | between_rounds | closing | ended
  rounds_total int not null default 6,
  round_seconds int not null default 300,
  break_seconds int not null default 15,      -- between rounds
  current_round int default 0,
  current_round_started_at timestamptz,       -- when the current round opened
  main_room_name text,                        -- daily.co room name for the main room
  prompts jsonb default '[]'::jsonb,          -- ordered list: [{ id, text, tag }]
  created_at timestamptz default now(),
  ended_at timestamptz,
  metadata jsonb default '{}'::jsonb
);
create index if not exists idx_sessions_code on sessions(code);
create index if not exists idx_sessions_status on sessions(status);

-- ============================================================================
-- PARTICIPANTS · people who joined a session (no auth required)
-- ============================================================================
create table if not exists participants (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null,
  joined_at timestamptz default now(),
  left_at timestamptz,
  is_present boolean default true,
  current_room_name text,                     -- the daily room they're currently in
  metadata jsonb default '{}'::jsonb
);
create index if not exists idx_participants_session on participants(session_id);
create index if not exists idx_participants_present on participants(session_id, is_present);

-- ============================================================================
-- ROUNDS · history of who paired with whom each round
-- ============================================================================
create table if not exists rounds (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  round_number int not null,
  prompt_text text,
  started_at timestamptz default now(),
  ended_at timestamptz,
  unique (session_id, round_number)
);
create index if not exists idx_rounds_session on rounds(session_id);

-- ============================================================================
-- PAIRINGS · individual matches within a round
-- ============================================================================
create table if not exists pairings (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid not null references rounds(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  participant_a_id uuid not null references participants(id) on delete cascade,
  participant_b_id uuid references participants(id) on delete cascade,  -- null if sit-out
  room_name text,                                                        -- daily.co room name
  room_label text,                                                       -- pretty name e.g. "mom's kitchen table"
  created_at timestamptz default now()
);
create index if not exists idx_pairings_round on pairings(round_id);
create index if not exists idx_pairings_session on pairings(session_id);
create index if not exists idx_pairings_a on pairings(participant_a_id);
create index if not exists idx_pairings_b on pairings(participant_b_id);

-- ============================================================================
-- CAPTURES · "save this connection" button taps
-- ============================================================================
create table if not exists captures (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  capturer_id uuid not null references participants(id) on delete cascade,
  captured_id uuid not null references participants(id) on delete cascade,
  pairing_id uuid references pairings(id) on delete set null,
  note text,
  created_at timestamptz default now()
);
create index if not exists idx_captures_session on captures(session_id);
create index if not exists idx_captures_capturer on captures(capturer_id);

-- ============================================================================
-- ROW LEVEL SECURITY · keep things locked down
-- ============================================================================
alter table hosts enable row level security;
alter table sessions enable row level security;
alter table participants enable row level security;
alter table rounds enable row level security;
alter table pairings enable row level security;
alter table captures enable row level security;

-- hosts: read self, no public read
drop policy if exists "hosts read self" on hosts;
create policy "hosts read self" on hosts
  for select using (auth.uid() = id);

-- sessions: hosts read+write own, anyone reads by code (anon participant flow)
drop policy if exists "sessions host all" on sessions;
create policy "sessions host all" on sessions
  for all using (auth.uid() = host_id);

drop policy if exists "sessions public read" on sessions;
create policy "sessions public read" on sessions
  for select using (true);  -- needed so anon participants can find session by code.

-- participants: anon can insert (joining a session) and read own session participants
drop policy if exists "participants public read" on participants;
create policy "participants public read" on participants
  for select using (true);

drop policy if exists "participants public insert" on participants;
create policy "participants public insert" on participants
  for insert with check (true);

-- rounds + pairings: public read (participants need to see who they're paired with)
drop policy if exists "rounds public read" on rounds;
create policy "rounds public read" on rounds for select using (true);

drop policy if exists "pairings public read" on pairings;
create policy "pairings public read" on pairings for select using (true);

-- captures: public insert + read (we'll filter at app level by participant id)
drop policy if exists "captures public" on captures;
create policy "captures public" on captures for all using (true) with check (true);

-- service role bypasses RLS for all our server-side mutations.
-- this is correct: server code is what creates rounds, pairings, ends sessions.

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================
create or replace view session_stats as
select
  s.id as session_id,
  s.code,
  s.name,
  s.status,
  count(distinct p.id) filter (where p.is_present) as live_count,
  count(distinct p.id) as total_joined,
  count(distinct pa.id) as total_pairings,
  count(distinct c.id) as total_captures
from sessions s
left join participants p on p.session_id = s.id
left join pairings pa on pa.session_id = s.id
left join captures c on c.session_id = s.id
group by s.id;

-- ============================================================================
-- APPROVAL · run this AFTER the host signs up via magic link the first time.
-- replace with real emails. only approved hosts can access /host/*.
-- ============================================================================
-- update hosts set is_approved = true, is_admin = true where email = 'nelvin@givingbridgeconsulting.com';
-- update hosts set is_approved = true where email = 'jon@weareforgood.com';
-- update hosts set is_approved = true where email = 'becky@weareforgood.com';
