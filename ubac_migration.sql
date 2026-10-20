-- =====================================================================
-- CMSC 128 Activity 3 — UBAC + Collaborative lists
-- Run ONCE in Supabase → SQL Editor. Safe to re-run (idempotent).
--
-- IMPORTANT: ship this together with the updated db_connection.js /
-- db_fetch.js. These policies only trust the signed-in user's JWT
-- (auth.uid()). The old code sent the public anon key as the Bearer
-- token, which carries no user identity, so it will be denied by
-- every policy below.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. profiles: a public mirror of the bits of auth.users we need for
--    "add by username or email". The client can't query auth.users.
--    RLS lets a user read ONLY their own row; lookups of other people go
--    through the SECURITY DEFINER functions further down.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email        text
);
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

-- Keeps profiles in sync on sign-up AND when account.html changes the
-- display name or email.
create or replace function public.sync_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, new.raw_user_meta_data->>'display_name', lower(new.email))
  on conflict (id) do update
    set display_name = excluded.display_name, email = excluded.email;
  return new;
end $$;

drop trigger if exists on_auth_user_sync_profile on auth.users;
create trigger on_auth_user_sync_profile
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.sync_profile();

-- Backfill accounts that already exist (your two demo accounts).
insert into public.profiles (id, display_name, email)
select id, raw_user_meta_data->>'display_name', lower(email) from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Collaborative list tables
--    The owner lives in lists.owner_id; list_members holds everyone ELSE
--    who was added. (Normalized: no user data is copied into either.)
-- ---------------------------------------------------------------------
create table if not exists public.lists (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

create table if not exists public.list_members (
  list_id  uuid not null references public.lists(id) on delete cascade,
  user_id  uuid not null references auth.users(id)  on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
create index if not exists list_members_user_idx on public.list_members(user_id);

-- NULL list_id = a Personal task. Deleting a list deletes its tasks.
alter table public.tasks
  add column if not exists list_id uuid references public.lists(id) on delete cascade;
create index if not exists tasks_list_id_idx on public.tasks(list_id);

-- ---------------------------------------------------------------------
-- 3. Access helpers.
--    SECURITY DEFINER = they read lists/list_members WITHOUT re-triggering
--    those tables' own policies. That is what prevents the classic
--    "infinite recursion detected in policy" error when a policy on
--    table A needs to look at table B and B's policy looks back at A.
-- ---------------------------------------------------------------------
create or replace function public.is_list_owner(p_list_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lists
                 where id = p_list_id and owner_id = auth.uid());
$$;

create or replace function public.has_list_access(p_list_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.lists l
    where l.id = p_list_id
      and (l.owner_id = auth.uid()
           or exists (select 1 from public.list_members m
                      where m.list_id = l.id and m.user_id = auth.uid()))
  );
$$;

-- ---------------------------------------------------------------------
-- 4. RLS: lists
-- ---------------------------------------------------------------------
alter table public.lists enable row level security;
drop policy if exists lists_select on public.lists;
drop policy if exists lists_insert on public.lists;
drop policy if exists lists_update on public.lists;
drop policy if exists lists_delete on public.lists;

create policy lists_select on public.lists
  for select to authenticated using (public.has_list_access(id));
create policy lists_insert on public.lists
  for insert to authenticated with check (owner_id = auth.uid());
create policy lists_update on public.lists
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy lists_delete on public.lists
  for delete to authenticated using (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- 5. RLS: list_members
--    You see your own membership rows; an owner sees all rows of their list.
--    Only the owner adds/removes people; a member may remove THEMSELVES (leave).
-- ---------------------------------------------------------------------
alter table public.list_members enable row level security;
drop policy if exists members_select on public.list_members;
drop policy if exists members_insert on public.list_members;
drop policy if exists members_delete on public.list_members;

create policy members_select on public.list_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_list_owner(list_id));
create policy members_insert on public.list_members
  for insert to authenticated with check (public.is_list_owner(list_id));
create policy members_delete on public.list_members
  for delete to authenticated
  using (public.is_list_owner(list_id) or user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 6. RLS: tasks  (REPLACES whatever policies exist today)
--    Personal task (list_id IS NULL)  -> only its creator.
--    List task                        -> the list's owner and members.
--    client_id is cast to text so this works whether the column is
--    uuid or text.
-- ---------------------------------------------------------------------
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'tasks' loop
    execute format('drop policy %I on public.tasks', p.policyname);
  end loop;
end $$;

alter table public.tasks enable row level security;

create policy tasks_select on public.tasks
  for select to authenticated
  using ((list_id is null and client_id::text = auth.uid()::text)
      or (list_id is not null and public.has_list_access(list_id)));

-- On insert you must stamp YOUR id, and may only target a list you can access.
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (client_id::text = auth.uid()::text
              and (list_id is null or public.has_list_access(list_id)));

-- On update/delete, creator-only for personal tasks, any member for list tasks.
create policy tasks_update on public.tasks
  for update to authenticated
  using ((list_id is null and client_id::text = auth.uid()::text)
      or (list_id is not null and public.has_list_access(list_id)))
  with check ((list_id is null and client_id::text = auth.uid()::text)
           or (list_id is not null and public.has_list_access(list_id)));

create policy tasks_delete on public.tasks
  for delete to authenticated
  using ((list_id is null and client_id::text = auth.uid()::text)
      or (list_id is not null and public.has_list_access(list_id)));

-- ---------------------------------------------------------------------
-- 7. RPCs (the only way the client can look up OTHER users)
-- ---------------------------------------------------------------------

-- Owner adds someone by email (exact) or username/display name (exact,
-- case-insensitive, must be unambiguous).
create or replace function public.add_list_member(p_list_id uuid, p_identifier text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ident text := btrim(coalesce(p_identifier, ''));
  v_user  uuid;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if not public.is_list_owner(p_list_id) then
    raise exception 'Only the list owner can add members' using errcode = '42501';
  end if;
  if v_ident = '' then
    raise exception 'Enter a username or email';
  end if;

  select id into v_user from public.profiles where email = lower(v_ident);

  if v_user is null then
    select count(*) into v_count from public.profiles
      where lower(display_name) = lower(v_ident);
    if v_count > 1 then
      raise exception 'More than one user has that username. Use their email instead';
    end if;
    select id into v_user from public.profiles
      where lower(display_name) = lower(v_ident);
  end if;

  if v_user is null then raise exception 'No user found with that username or email'; end if;
  if v_user = auth.uid() then raise exception 'You already own this list'; end if;

  insert into public.list_members (list_id, user_id)
  values (p_list_id, v_user) on conflict do nothing;
end $$;

-- Anyone with access to a list may see who is on it (names only, no emails).
create or replace function public.get_list_members(p_list_id uuid)
returns table (user_id uuid, display_name text, is_owner boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_list_access(p_list_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select l.owner_id, coalesce(p.display_name, 'Unknown'), true
      from public.lists l left join public.profiles p on p.id = l.owner_id
     where l.id = p_list_id
    union all
    select m.user_id, coalesce(p.display_name, 'Unknown'), false
      from public.list_members m left join public.profiles p on p.id = m.user_id
     where m.list_id = p_list_id;
end $$;

-- Functions are executable by PUBLIC by default: lock them to signed-in users.
revoke all on function public.is_list_owner(uuid)           from public, anon;
revoke all on function public.has_list_access(uuid)         from public, anon;
revoke all on function public.add_list_member(uuid, text)   from public, anon;
revoke all on function public.get_list_members(uuid)        from public, anon;
grant execute on function public.is_list_owner(uuid)         to authenticated;
grant execute on function public.has_list_access(uuid)       to authenticated;
grant execute on function public.add_list_member(uuid, text) to authenticated;
grant execute on function public.get_list_members(uuid)      to authenticated;

commit;
