create extension if not exists pgcrypto;

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

-- Enable RLS
alter table public.chemicals enable row level security;
alter table public.bookings enable row level security;

-- -----------------------------
-- CHEMICALS POLICIES
-- -----------------------------

drop policy if exists "Authenticated users can read chemicals" on public.chemicals;
drop policy if exists "Tenant members can read chemicals" on public.chemicals;
create policy "Tenant members can read chemicals"
on public.chemicals
for select
using (public.is_lab_member(lab_id));

drop policy if exists "Lab managers can insert chemicals" on public.chemicals;
drop policy if exists "Assistants and managers can insert chemicals in lab" on public.chemicals;
create policy "Assistants and managers can insert chemicals in lab"
on public.chemicals
for insert
with check (
  public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager'])
);

drop policy if exists "Lab assistants and managers can update chemicals" on public.chemicals;
drop policy if exists "Assistants and managers can update chemicals in lab" on public.chemicals;
create policy "Assistants and managers can update chemicals in lab"
on public.chemicals
for update
using (public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager']))
with check (public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager']));

drop policy if exists "Lab managers can delete chemicals" on public.chemicals;
drop policy if exists "Managers can delete chemicals in lab" on public.chemicals;
create policy "Managers can delete chemicals in lab"
on public.chemicals
for delete
using (public.lab_member_has_role(lab_id, array['lab_manager']));

-- -----------------------------
-- BOOKINGS POLICIES
-- -----------------------------

drop policy if exists "Approved users can create own bookings" on public.bookings;
drop policy if exists "Faculty and managers can create bookings in lab" on public.bookings;
create policy "Faculty and managers can create bookings in lab"
on public.bookings
for insert
with check (
  auth.uid() = user_id
  and public.lab_member_has_role(lab_id, array['faculty', 'lab_manager'])
);

drop policy if exists "Users can read own bookings" on public.bookings;
drop policy if exists "Lab managers can read all bookings" on public.bookings;
drop policy if exists "Tenant members can read own bookings" on public.bookings;
create policy "Tenant members can read own bookings"
on public.bookings
for select
using (
  public.lab_member_has_role(lab_id, array['lab_manager'])
  or (public.is_lab_member(lab_id) and auth.uid() = user_id)
);

drop policy if exists "Lab managers can update bookings" on public.bookings;
drop policy if exists "Managers can update bookings in lab" on public.bookings;
create policy "Managers can update bookings in lab"
on public.bookings
for update
using (public.lab_member_has_role(lab_id, array['lab_manager']))
with check (public.lab_member_has_role(lab_id, array['lab_manager']));

drop policy if exists "Lab managers can delete bookings" on public.bookings;
drop policy if exists "Managers can delete bookings in lab" on public.bookings;
create policy "Managers can delete bookings in lab"
on public.bookings
for delete
using (public.lab_member_has_role(lab_id, array['lab_manager']));
