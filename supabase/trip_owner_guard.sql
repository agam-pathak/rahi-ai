-- Enforce trip ownership for new rows (permanent fix).
-- Run in Supabase SQL editor.

-- 1) Default owner from auth (for normal inserts)
alter table public.trips
  alter column user_id set default auth.uid();

-- 2) Trigger to prevent null owners (covers service role inserts)
create or replace function public.ensure_trip_owner()
returns trigger as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  if new.user_id is null then
    raise exception 'user_id required';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trips_owner_trigger on public.trips;
create trigger trips_owner_trigger
before insert on public.trips
for each row execute function public.ensure_trip_owner();

-- 3) Enforce non-null for new rows only (existing nulls are ignored)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trips_user_id_not_null'
      and conrelid = 'public.trips'::regclass
  ) then
    alter table public.trips
      add constraint trips_user_id_not_null
      check (user_id is not null) not valid;
  end if;
end;
$$;

-- NOTE:
-- Existing rows with null user_id must be manually backfilled.
-- After cleanup, you can run:
-- alter table public.trips validate constraint trips_user_id_not_null;
