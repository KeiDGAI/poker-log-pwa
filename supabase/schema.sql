create table if not exists public.sessions (
  id uuid primary key,
  date date not null,
  country text not null,
  venue_id uuid,
  venue_name text not null,
  play_unit_id uuid,
  play_unit_name text not null,
  rate_label text not null,
  small_blind_amount numeric not null,
  big_blind_amount numeric not null,
  amount_input_unit numeric not null,
  start_stack_amount numeric,
  end_stack_amount numeric,
  rake_percent numeric not null default 0,
  rake_cap_bb numeric not null default 0,
  memo text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.session_players (
  id uuid primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  player_profile_id uuid,
  display_name text not null,
  seat_number integer not null,
  is_hero boolean not null default false,
  is_active boolean not null default true,
  joined_at_game_number integer,
  left_at_game_number integer,
  left_at timestamptz,
  session_notes text,
  session_tendencies jsonb not null default '{}'::jsonb,
  seat_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.hands (
  id uuid primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  hand_number integer not null,
  participants jsonb not null default '[]'::jsonb,
  board jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  result_text text,
  moved_bb numeric,
  pot_amount numeric,
  rake_amount numeric,
  memo text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(session_id, hand_number)
);
