-- RLS POLICIES FOR RAHI.AI
-- Run this in Supabase SQL editor.

-- TRIPS
alter table public.trips enable row level security;

create policy "Trips are viewable by owner"
on public.trips
for select
using (auth.uid() = user_id);

create policy "Public trips are viewable"
on public.trips
for select
using (is_public = true);

create policy "Trips are viewable by members"
on public.trips
for select
using (
  exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = trips.id
      and tm.user_id = auth.uid()
  )
);

create policy "Users can insert trips"
on public.trips
for insert
with check (auth.uid() = user_id);

create policy "Users can update their trips"
on public.trips
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their trips"
on public.trips
for delete
using (auth.uid() = user_id);

-- TRIP MEMBERS
alter table public.trip_members enable row level security;

create policy "Trip members visible to owner and members"
on public.trip_members
for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.trips t
    where t.id = trip_members.trip_id
      and t.user_id = auth.uid()
  )
);

create policy "Owners can add members"
on public.trip_members
for insert
with check (
  exists (
    select 1
    from public.trips t
    where t.id = trip_members.trip_id
      and t.user_id = auth.uid()
  )
);

create policy "Owners can remove members"
on public.trip_members
for delete
using (
  exists (
    select 1
    from public.trips t
    where t.id = trip_members.trip_id
      and t.user_id = auth.uid()
  )
);

create policy "Owners can update members"
on public.trip_members
for update
using (
  exists (
    select 1
    from public.trips t
    where t.id = trip_members.trip_id
      and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.trips t
    where t.id = trip_members.trip_id
      and t.user_id = auth.uid()
  )
);

-- PROFILES
alter table public.profiles enable row level security;

create policy "Users can view their profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can update their profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Optional profile columns for mobile + avatar
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_url text;
