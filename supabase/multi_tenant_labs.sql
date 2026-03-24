-- =====================================
-- CHEMTRACK MULTI-TENANT LAB UPGRADE
-- =====================================

create extension if not exists pgcrypto;

-- 1) Core tenant tables
create table if not exists public.labs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.lab_members (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.labs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('student', 'faculty', 'lab_assistant', 'lab_manager')),
  joined_at timestamp with time zone not null default now(),
  unique (lab_id, user_id)
);

create index if not exists idx_lab_members_user_id on public.lab_members(user_id);
create index if not exists idx_lab_members_lab_role on public.lab_members(lab_id, role);

-- 2) Add lab_id to tenant-scoped tables
alter table public.chemicals add column if not exists lab_id uuid references public.labs(id) on delete cascade;
alter table public.chemical_containers add column if not exists lab_id uuid references public.labs(id) on delete cascade;
alter table public.inventory_transactions add column if not exists lab_id uuid references public.labs(id) on delete cascade;
alter table public.bookings add column if not exists lab_id uuid references public.labs(id) on delete cascade;
alter table public.chemical_documents add column if not exists lab_id uuid references public.labs(id) on delete cascade;
alter table public.notifications add column if not exists lab_id uuid references public.labs(id) on delete cascade;

create index if not exists idx_chemicals_lab_id on public.chemicals(lab_id);
create index if not exists idx_containers_lab_id on public.chemical_containers(lab_id);
create index if not exists idx_transactions_lab_id on public.inventory_transactions(lab_id);
create index if not exists idx_bookings_lab_id on public.bookings(lab_id);
create index if not exists idx_documents_lab_id on public.chemical_documents(lab_id);
create index if not exists idx_notifications_lab_id on public.notifications(lab_id);

-- 3) Backfill labs and memberships for existing data
insert into public.labs (name, department, created_by)
select
  (coalesce(nullif(trim(p.department), ''), 'General') || ' Main Lab') as name,
  coalesce(nullif(trim(p.department), ''), 'General') as department,
  min(p.id) as created_by
from public.profiles p
group by coalesce(nullif(trim(p.department), ''), 'General')
on conflict do nothing;

insert into public.lab_members (lab_id, user_id, role)
select
  l.id as lab_id,
  p.id as user_id,
  p.role
from public.profiles p
join public.labs l
  on l.department = coalesce(nullif(trim(p.department), ''), 'General')
on conflict (lab_id, user_id) do nothing;

-- Fallback lab for old global rows
with fallback_lab as (
  select id from public.labs order by created_at asc limit 1
)
update public.chemicals c
set lab_id = fallback_lab.id
from fallback_lab
where c.lab_id is null;

update public.chemical_containers cc
set lab_id = c.lab_id
from public.chemicals c
where cc.lab_id is null
  and cc.chemical_id = c.id;

with fallback_lab as (
  select id from public.labs order by created_at asc limit 1
)
update public.chemical_containers cc
set lab_id = fallback_lab.id
from fallback_lab
where cc.lab_id is null;

update public.inventory_transactions it
set lab_id = cc.lab_id
from public.chemical_containers cc
where it.lab_id is null
  and it.container_id = cc.id;

with fallback_lab as (
  select id from public.labs order by created_at asc limit 1
)
update public.inventory_transactions it
set lab_id = fallback_lab.id
from fallback_lab
where it.lab_id is null;

update public.bookings b
set lab_id = lm.lab_id
from public.lab_members lm
where b.lab_id is null
  and b.user_id = lm.user_id;

with fallback_lab as (
  select id from public.labs order by created_at asc limit 1
)
update public.bookings b
set lab_id = fallback_lab.id
from fallback_lab
where b.lab_id is null;

update public.chemical_documents d
set lab_id = c.lab_id
from public.chemicals c
where d.lab_id is null
  and d.chemical_id = c.id;

with fallback_lab as (
  select id from public.labs order by created_at asc limit 1
)
update public.chemical_documents d
set lab_id = fallback_lab.id
from fallback_lab
where d.lab_id is null;

update public.notifications n
set lab_id = lm.lab_id
from public.lab_members lm
where n.lab_id is null
  and n.user_id = lm.user_id;

with fallback_lab as (
  select id from public.labs order by created_at asc limit 1
)
update public.notifications n
set lab_id = fallback_lab.id
from fallback_lab
where n.lab_id is null;

-- Enforce not null after backfill
alter table public.chemicals alter column lab_id set not null;
alter table public.chemical_containers alter column lab_id set not null;
alter table public.inventory_transactions alter column lab_id set not null;
alter table public.bookings alter column lab_id set not null;
alter table public.chemical_documents alter column lab_id set not null;
alter table public.notifications alter column lab_id set not null;

-- 4) Tenant helper functions
create or replace function public.is_lab_member(lab_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.lab_members lm
    join public.profiles p on p.id = lm.user_id
    where lm.lab_id = lab_uuid
      and lm.user_id = auth.uid()
      and p.status = 'approved'
  );
$$;

create or replace function public.lab_member_has_role(lab_uuid uuid, allowed_roles text[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.lab_members lm
    join public.profiles p on p.id = lm.user_id
    where lm.lab_id = lab_uuid
      and lm.user_id = auth.uid()
      and p.status = 'approved'
      and lm.role = any(allowed_roles)
  );
$$;

-- 5) RLS
alter table public.labs enable row level security;
alter table public.lab_members enable row level security;
alter table public.chemicals enable row level security;
alter table public.chemical_containers enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.bookings enable row level security;
alter table public.chemical_documents enable row level security;
alter table public.notifications enable row level security;

-- labs
drop policy if exists "Members can read labs" on public.labs;
create policy "Members can read labs"
on public.labs for select
using (public.is_lab_member(id));

drop policy if exists "Managers can create labs" on public.labs;
create policy "Managers can create labs"
on public.labs for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'approved'
      and p.role = 'lab_manager'
  )
);

drop policy if exists "Managers can update labs" on public.labs;
create policy "Managers can update labs"
on public.labs for update
using (public.lab_member_has_role(id, array['lab_manager']))
with check (public.lab_member_has_role(id, array['lab_manager']));

-- lab_members
drop policy if exists "Users can read own lab memberships" on public.lab_members;
create policy "Users can read own lab memberships"
on public.lab_members for select
using (user_id = auth.uid() or public.lab_member_has_role(lab_id, array['lab_manager']));

drop policy if exists "Managers can manage memberships" on public.lab_members;
create policy "Managers can manage memberships"
on public.lab_members for all
using (public.lab_member_has_role(lab_id, array['lab_manager']))
with check (public.lab_member_has_role(lab_id, array['lab_manager']));

-- chemicals
drop policy if exists "Tenant members can read chemicals" on public.chemicals;
create policy "Tenant members can read chemicals"
on public.chemicals for select
using (public.is_lab_member(lab_id));

drop policy if exists "Assistants and managers can insert chemicals in lab" on public.chemicals;
create policy "Assistants and managers can insert chemicals in lab"
on public.chemicals for insert
with check (public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager']));

drop policy if exists "Assistants and managers can update chemicals in lab" on public.chemicals;
create policy "Assistants and managers can update chemicals in lab"
on public.chemicals for update
using (public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager']))
with check (public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager']));

drop policy if exists "Managers can delete chemicals in lab" on public.chemicals;
create policy "Managers can delete chemicals in lab"
on public.chemicals for delete
using (public.lab_member_has_role(lab_id, array['lab_manager']));

-- chemical_containers
drop policy if exists "Tenant members can read containers" on public.chemical_containers;
create policy "Tenant members can read containers"
on public.chemical_containers for select
using (public.is_lab_member(lab_id));

drop policy if exists "Assistants and managers can insert containers in lab" on public.chemical_containers;
create policy "Assistants and managers can insert containers in lab"
on public.chemical_containers for insert
with check (public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager']));

drop policy if exists "Assistants and managers can update containers in lab" on public.chemical_containers;
create policy "Assistants and managers can update containers in lab"
on public.chemical_containers for update
using (public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager']))
with check (public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager']));

drop policy if exists "Managers can delete containers in lab" on public.chemical_containers;
create policy "Managers can delete containers in lab"
on public.chemical_containers for delete
using (public.lab_member_has_role(lab_id, array['lab_manager']));

-- inventory_transactions
drop policy if exists "Tenant members can read transactions" on public.inventory_transactions;
create policy "Tenant members can read transactions"
on public.inventory_transactions for select
using (
  public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager'])
  or (public.is_lab_member(lab_id) and user_id = auth.uid())
);

drop policy if exists "Faculty can consume in own lab" on public.inventory_transactions;
create policy "Faculty can consume in own lab"
on public.inventory_transactions for insert
with check (
  user_id = auth.uid()
  and action = 'consume'
  and public.lab_member_has_role(lab_id, array['faculty'])
);

drop policy if exists "Assistants and managers can insert transactions in lab" on public.inventory_transactions;
create policy "Assistants and managers can insert transactions in lab"
on public.inventory_transactions for insert
with check (
  user_id = auth.uid()
  and public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager'])
);

-- bookings
drop policy if exists "Tenant members can read own bookings" on public.bookings;
create policy "Tenant members can read own bookings"
on public.bookings for select
using (
  public.lab_member_has_role(lab_id, array['lab_manager'])
  or (public.is_lab_member(lab_id) and user_id = auth.uid())
);

drop policy if exists "Faculty and managers can create bookings in lab" on public.bookings;
create policy "Faculty and managers can create bookings in lab"
on public.bookings for insert
with check (
  user_id = auth.uid()
  and public.lab_member_has_role(lab_id, array['faculty', 'lab_manager'])
);

drop policy if exists "Managers can update bookings in lab" on public.bookings;
create policy "Managers can update bookings in lab"
on public.bookings for update
using (public.lab_member_has_role(lab_id, array['lab_manager']))
with check (public.lab_member_has_role(lab_id, array['lab_manager']));

drop policy if exists "Managers can delete bookings in lab" on public.bookings;
create policy "Managers can delete bookings in lab"
on public.bookings for delete
using (public.lab_member_has_role(lab_id, array['lab_manager']));

-- chemical_documents
drop policy if exists "Tenant members can read chemical documents" on public.chemical_documents;
create policy "Tenant members can read chemical documents"
on public.chemical_documents for select
using (public.is_lab_member(lab_id));

drop policy if exists "Assistants and managers can upload documents in lab" on public.chemical_documents;
create policy "Assistants and managers can upload documents in lab"
on public.chemical_documents for insert
with check (
  uploaded_by = auth.uid()
  and public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager'])
);

drop policy if exists "Managers can delete documents in lab" on public.chemical_documents;
create policy "Managers can delete documents in lab"
on public.chemical_documents for delete
using (public.lab_member_has_role(lab_id, array['lab_manager']));

-- notifications
drop policy if exists "Users can read own notifications in lab" on public.notifications;
create policy "Users can read own notifications in lab"
on public.notifications for select
using (
  user_id = auth.uid()
  and public.is_lab_member(lab_id)
);

drop policy if exists "Users can update own notifications in lab" on public.notifications;
create policy "Users can update own notifications in lab"
on public.notifications for update
using (
  user_id = auth.uid()
  and public.is_lab_member(lab_id)
)
with check (
  user_id = auth.uid()
  and public.is_lab_member(lab_id)
);

drop policy if exists "Assistants and managers can insert notifications in lab" on public.notifications;
create policy "Assistants and managers can insert notifications in lab"
on public.notifications for insert
with check (
  user_id is not null
  and public.is_lab_member(lab_id)
  and public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager'])
);

-- profiles
alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "Lab managers can read all profiles" on public.profiles;
drop policy if exists "Lab managers can read lab profiles" on public.profiles;
create policy "Lab managers can read lab profiles"
on public.profiles for select
using (
  exists (
    select 1
    from public.lab_members target_member
    join public.lab_members manager_member
      on manager_member.lab_id = target_member.lab_id
    join public.profiles manager_profile
      on manager_profile.id = manager_member.user_id
    where target_member.user_id = public.profiles.id
      and manager_member.user_id = auth.uid()
      and manager_member.role = 'lab_manager'
      and manager_profile.status = 'approved'
  )
);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "Lab managers can update profile status" on public.profiles;
drop policy if exists "Lab managers can update lab profile status" on public.profiles;
create policy "Lab managers can update lab profile status"
on public.profiles for update
using (
  exists (
    select 1
    from public.lab_members target_member
    join public.lab_members manager_member
      on manager_member.lab_id = target_member.lab_id
    join public.profiles manager_profile
      on manager_profile.id = manager_member.user_id
    where target_member.user_id = public.profiles.id
      and manager_member.user_id = auth.uid()
      and manager_member.role = 'lab_manager'
      and manager_profile.status = 'approved'
  )
)
with check (
  exists (
    select 1
    from public.lab_members target_member
    join public.lab_members manager_member
      on manager_member.lab_id = target_member.lab_id
    join public.profiles manager_profile
      on manager_profile.id = manager_member.user_id
    where target_member.user_id = public.profiles.id
      and manager_member.user_id = auth.uid()
      and manager_member.role = 'lab_manager'
      and manager_profile.status = 'approved'
  )
);

create or replace function public.debug_rls_context()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'uid', auth.uid(),
    'role', auth.role(),
    'profile_status',
      (
        select p.status
        from public.profiles p
        where p.id = auth.uid()
      ),
    'labs',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'lab_id', lm.lab_id,
              'role', lm.role,
              'joined_at', lm.joined_at
            )
          )
          from public.lab_members lm
          where lm.user_id = auth.uid()
        ),
        '[]'::jsonb
      )
  );
$$;
