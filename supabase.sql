-- YummyStuff's Siege: initial Supabase schema
-- Run this in Supabase SQL Editor. Then add your project URL and anon key to config.js.
-- IMPORTANT: Enable Realtime for game_rooms and room_players if you later use Postgres Changes.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 20),
  level integer not null default 1,
  coins integer not null default 0,
  created_at timestamptz not null default now()
);


-- Automatically create a profile for each new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, username, level, coins)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), 1, 0)
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  unique(sender_id, receiver_id),
  check(sender_id <> receiver_id)
);

create table if not exists public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, friend_id),
  check(user_id <> friend_id)
);

create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null default upper(substr(encode(gen_random_bytes(5),'hex'),1,6)),
  status text not null default 'waiting' check(status in ('waiting','starting','playing','finished')),
  is_public boolean not null default true,
  max_players integer not null default 10 check(max_players between 2 and 10),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.room_players (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  team text check(team in ('attack','defend')),
  primary key(room_id, player_id)
);

create table if not exists public.lobby_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check(char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.game_rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.lobby_messages enable row level security;

create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "requests visible to participants" on public.friend_requests for select to authenticated using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "send friend request" on public.friend_requests for insert to authenticated with check (auth.uid() = sender_id);
create policy "receiver updates request" on public.friend_requests for update to authenticated using (auth.uid() = receiver_id) with check (auth.uid() = receiver_id);

create policy "friendships visible to owner" on public.friendships for select to authenticated using (auth.uid() = user_id);
create policy "friendships insert by owner" on public.friendships for insert to authenticated with check (auth.uid() = user_id);

create policy "public rooms readable" on public.game_rooms for select to authenticated using (is_public or created_by = auth.uid());
create policy "create own room" on public.game_rooms for insert to authenticated with check (created_by = auth.uid());
create policy "room creator updates room" on public.game_rooms for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "room players readable" on public.room_players for select to authenticated using (true);
create policy "join as self" on public.room_players for insert to authenticated with check (player_id = auth.uid());
create policy "leave as self" on public.room_players for delete to authenticated using (player_id = auth.uid());

create policy "lobby messages readable" on public.lobby_messages for select to authenticated using (true);
create policy "send lobby messages as self" on public.lobby_messages for insert to authenticated with check (player_id = auth.uid());

-- Atomic public-room join. Returns the room row. Does not yet start a match.
create or replace function public.join_public_room()
returns public.game_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen public.game_rooms;
begin
  if auth.uid() is null then raise exception 'You must be logged in'; end if;
  select r.* into chosen
  from public.game_rooms r
  where r.is_public = true and r.status = 'waiting'
    and (select count(*) from public.room_players rp where rp.room_id = r.id) < r.max_players
  order by r.created_at asc
  for update skip locked
  limit 1;

  if chosen.id is null then
    insert into public.game_rooms(created_by) values(auth.uid()) returning * into chosen;
  end if;

  insert into public.room_players(room_id, player_id)
  values(chosen.id, auth.uid())
  on conflict do nothing;

  return chosen;
end;
$$;
grant execute on function public.join_public_room() to authenticated;
