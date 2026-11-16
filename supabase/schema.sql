-- My Travel V1 database schema
-- Run this entire file in Supabase Dashboard > SQL Editor.

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

alter table public.trips enable row level security;
alter table public.collections enable row level security;

grant select, insert, update, delete on public.trips to authenticated;
grant select, insert, update, delete on public.collections to authenticated;

drop policy if exists "Users manage their own trips" on public.trips;
create policy "Users manage their own trips"
on public.trips for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage their own collections" on public.collections;
create policy "Users manage their own collections"
on public.collections for all to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    trip_id is null
    or exists (
      select 1 from public.trips
      where trips.id = collections.trip_id
        and trips.user_id = auth.uid()
    )
  )
);

-- Private-by-default image bucket. Storage object policies enforce per-user folders.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('collection-media', 'collection-media', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "Users upload own collection media" on storage.objects;
create policy "Users upload own collection media"
on storage.objects for insert to authenticated
with check (bucket_id = 'collection-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users read own collection media" on storage.objects;
create policy "Users read own collection media"
on storage.objects for select to authenticated
using (bucket_id = 'collection-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own collection media" on storage.objects;
create policy "Users delete own collection media"
on storage.objects for delete to authenticated
using (bucket_id = 'collection-media' and (storage.foldername(name))[1] = auth.uid()::text);
