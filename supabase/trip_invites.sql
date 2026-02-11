-- Trip invites table + RLS policies.
-- Run this in Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  token text not null unique,
  role text not null default 'viewer' check (role in ('viewer', 'editor')),
  email text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id)
);

create index if not exists trip_invites_trip_id_idx on public.trip_invites(trip_id);
create index if not exists trip_invites_email_idx on public.trip_invites(email);

alter table public.trip_invites enable row level security;

create policy "Trip owners can manage invites"
on public.trip_invites
for all
using (
  exists (
    select 1
    from public.trips t
    where t.id = trip_invites.trip_id
      and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.trips t
    where t.id = trip_invites.trip_id
      and t.user_id = auth.uid()
  )
);
