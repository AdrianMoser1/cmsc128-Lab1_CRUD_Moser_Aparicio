
-- Tables 
create table if not exists public.lists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(trim(name)) between 1 and 60),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.list_members (
  list_id  uuid not null references public.lists(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

alter table public.tasks
  add column if not exists list_id uuid references public.lists(id) on delete cascade;

create index if not exists tasks_list_id_idx on public.tasks(list_id);
create index if not exists list_members_user_idx on public.list_members(user_id);

-- Helper functions (SECURITY DEFINER avoids RLS recursion between lists/list_members)
create or replace function public.is_list_member(p_list_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.list_members m
                 where m.list_id = p_list_id and m.user_id = auth.uid());
$$;

create or replace function public.is_list_owner(p_list_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lists l
                 where l.id = p_list_id and l.owner_id = auth.uid());
$$;

revoke all on function public.is_list_member(uuid), public.is_list_owner(uuid) from public, anon;
grant execute on function public.is_list_member(uuid), public.is_list_owner(uuid) to authenticated;

-- The owner is automatically a member of their own list 
create or replace function public.add_owner_as_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.list_members (list_id, user_id) values (new.id, new.owner_id);
  return new;
end;
$$;

drop trigger if exists lists_add_owner on public.lists;
create trigger lists_add_owner after insert on public.lists
  for each row execute function public.add_owner_as_member();

-- RLS
alter table public.lists        enable row level security;
alter table public.list_members enable row level security;
alter table public.tasks        enable row level security;

-- lists: visible to members, writable only by the owner
create policy lists_select on public.lists for select to authenticated
  using (owner_id = auth.uid() or public.is_list_member(id));
create policy lists_insert on public.lists for insert to authenticated
  with check (owner_id = auth.uid());
create policy lists_update on public.lists for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy lists_delete on public.lists for delete to authenticated
  using (owner_id = auth.uid());

-- list_members: no direct INSERT policy (adding goes through add_list_member()).
-- Owner can remove others; a member can remove only themselves; the owner row is never removable.
create policy members_select on public.list_members for select to authenticated
  using (user_id = auth.uid() or public.is_list_owner(list_id));
create policy members_delete on public.list_members for delete to authenticated
  using (
    (user_id = auth.uid() and not public.is_list_owner(list_id))
    or (public.is_list_owner(list_id) and user_id <> auth.uid())
  );

-- tasks: drop whatever policies exist from Activity 1/2, then recreate.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'tasks' loop
    execute format('drop policy %I on public.tasks', p.policyname);
  end loop;
end $$;

-- Personal task (list_id NULL): only its owner. List task: any member of that list.
create policy tasks_select on public.tasks for select to authenticated
  using ((list_id is null and user_id = auth.uid())
      or (list_id is not null and public.is_list_member(list_id)));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (user_id = auth.uid()
      and (list_id is null or public.is_list_member(list_id)));
create policy tasks_update on public.tasks for update to authenticated
  using ((list_id is null and user_id = auth.uid())
      or (list_id is not null and public.is_list_member(list_id)))
  with check ((list_id is null and user_id = auth.uid())
      or (list_id is not null and public.is_list_member(list_id)));
create policy tasks_delete on public.tasks for delete to authenticated
  using ((list_id is null and user_id = auth.uid())
      or (list_id is not null and public.is_list_member(list_id)));

-- RPCs used by db_lists.js ----------------------------------------------
-- Plain "raise exception" (SQLSTATE P0001) = message that is safe to show the user.
create or replace function public.add_list_member(p_list_id uuid, p_identifier text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_ident text := lower(trim(coalesce(p_identifier, '')));
  v_user  uuid;
  v_count int;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if not public.is_list_owner(p_list_id) then raise exception 'Only the list owner can add members.'; end if;
  if v_ident = '' then raise exception 'Enter a username or email.'; end if;

  -- email match first (unique), then display name
  select u.id into v_user from auth.users u
   where lower(u.email) = v_ident and u.email_confirmed_at is not null;

  if v_user is null then
    select count(*), min(u.id::text)::uuid into v_count, v_user from auth.users u
     where lower(u.raw_user_meta_data ->> 'display_name') = v_ident
       and u.email_confirmed_at is not null;
    if v_count > 1 then
      raise exception 'More than one user has that username. Add them by email instead.';
    end if;
  end if;

  if v_user is null then raise exception 'No confirmed user found with that username or email.'; end if;

  insert into public.list_members (list_id, user_id) values (p_list_id, v_user)
  on conflict do nothing;
  if not found then raise exception 'That user is already a member of this list.'; end if;
end;
$$;

create or replace function public.get_list_members(p_list_id uuid)
returns table (user_id uuid, display_name text, is_owner boolean)
language sql stable security definer set search_path = public, auth as $$
  select m.user_id,
         coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1)),
         (m.user_id = l.owner_id)
    from public.list_members m
    join public.lists l on l.id = m.list_id
    join auth.users u   on u.id = m.user_id
   where m.list_id = p_list_id
     and public.is_list_member(p_list_id)   -- non-members get zero rows
   order by (m.user_id = l.owner_id) desc, 2;
$$;

revoke all on function public.add_list_member(uuid, text), public.get_list_members(uuid) from public, anon;
grant execute on function public.add_list_member(uuid, text), public.get_list_members(uuid) to authenticated;
