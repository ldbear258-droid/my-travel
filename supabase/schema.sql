-- My Travel family-shared database schema
-- Run in Supabase Dashboard > SQL Editor.
-- After creating Auth users, add each family member to the same household_members household_id.

create extension if not exists pgcrypto;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  country text,
  city text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  place_name text not null,
  country text,
  city text,
  region text,
  category text not null default '其他',
  address text,
  source_url text,
  notes text,
  image_path text,
  created_at timestamptz not null default now()
);

create index if not exists trips_user_created_idx on public.trips(user_id, created_at desc);
create index if not exists collections_user_created_idx on public.collections(user_id, created_at desc);
create index if not exists collections_trip_idx on public.collections(trip_id);
create index if not exists collections_place_name_idx on public.collections using gin (to_tsvector('simple', place_name));

-- Private household membership map. A user's membership is readable only by that user.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.household_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists household_members_household_idx
  on public.household_members(household_id);

alter table public.household_members enable row level security;
revoke all on public.household_members from anon, authenticated;
grant select on public.household_members to authenticated;

drop policy if exists "Members can read their own membership" on public.household_members;
create policy "Members can read their own membership"
on public.household_members
for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function private.is_same_household(target_user_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as current_member
    join public.household_members as target_member
      on target_member.household_id = current_member.household_id
    where current_member.user_id = (select auth.uid())
      and target_member.user_id::text = target_user_id
      and (select auth.uid()) is not null
  );
$$;

revoke all on function private.is_same_household(text) from public;
grant execute on function private.is_same_household(text) to authenticated;

alter table public.trips enable row level security;
alter table public.collections enable row level security;

grant select, insert, update, delete on public.trips to authenticated;
grant select, insert, update, delete on public.collections to authenticated;

drop policy if exists "Users manage their own trips" on public.trips;
drop policy if exists "Family members manage shared trips" on public.trips;
create policy "Family members manage shared trips"
on public.trips
for all to authenticated
using (private.is_same_household(user_id::text))
with check (private.is_same_household(user_id::text));

drop policy if exists "Users manage their own collections" on public.collections;
drop policy if exists "Family members manage shared collections" on public.collections;
create policy "Family members manage shared collections"
on public.collections
for all to authenticated
using (private.is_same_household(user_id::text))
with check (
  private.is_same_household(user_id::text)
  and (
    trip_id is null
    or exists (
      select 1
      from public.trips
      where trips.id = collections.trip_id
        and private.is_same_household(trips.user_id::text)
    )
  )
);

-- Private image bucket. Storage authorization follows household membership too.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('collection-media', 'collection-media', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "Users upload own collection media" on storage.objects;
drop policy if exists "Users read own collection media" on storage.objects;
drop policy if exists "Users delete own collection media" on storage.objects;
drop policy if exists "Family members upload shared collection media" on storage.objects;
drop policy if exists "Family members read shared collection media" on storage.objects;
drop policy if exists "Family members delete shared collection media" on storage.objects;

create policy "Family members upload shared collection media"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'collection-media'
  and private.is_same_household((storage.foldername(name))[1])
);

create policy "Family members read shared collection media"
on storage.objects
for select to authenticated
using (
  bucket_id = 'collection-media'
  and private.is_same_household((storage.foldername(name))[1])
);

create policy "Family members delete shared collection media"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'collection-media'
  and private.is_same_household((storage.foldername(name))[1])
);

-- Enroll each family member in the same household using a shared household_id:
-- insert into public.household_members (household_id, user_id)
-- select '<HOUSEHOLD_UUID>'::uuid, id
-- from auth.users
-- where email in ('member1@example.com', 'member2@example.com')
-- on conflict (user_id) do update set household_id = excluded.household_id;
