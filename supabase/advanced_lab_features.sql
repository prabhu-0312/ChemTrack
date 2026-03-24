-- =====================================
-- CHEMTRACK ADVANCED LAB MANAGEMENT
-- =====================================

-- 1) Chemical documents table
create table if not exists public.chemical_documents (
  id uuid primary key default gen_random_uuid(),
  chemical_id uuid not null references public.chemicals(id) on delete cascade,
  document_type text not null check (document_type in ('msds', 'safety_sheet', 'protocol')),
  file_url text not null,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_chemical_documents_chemical_id
  on public.chemical_documents(chemical_id);

-- 2) Barcode support for containers
alter table public.chemical_containers
add column if not exists barcode text unique;

create or replace function public.generate_container_barcode()
returns text
language plpgsql
as $$
begin
  return 'CT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
end;
$$;

alter table public.chemical_containers
alter column barcode set default public.generate_container_barcode();

update public.chemical_containers
set barcode = public.generate_container_barcode()
where barcode is null;

alter table public.chemical_containers
alter column barcode set not null;

-- 3) Booking conflict engine support
alter table public.bookings
add column if not exists time_slot text not null default '09:00-11:00';

create unique index if not exists uniq_booking_conflict_slot
  on public.bookings (lab_id, ((booking_date at time zone 'UTC')::date), time_slot)
  where status = 'approved';

create table if not exists public.apparatus (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.labs(id) on delete cascade,
  name text not null,
  category text not null,
  location text not null,
  status text not null default 'available' check (status in ('available', 'in_use', 'maintenance')),
  notes text not null default '',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_apparatus_lab_id on public.apparatus(lab_id);
create index if not exists idx_apparatus_status on public.apparatus(status);

alter table public.apparatus enable row level security;

drop policy if exists "Department members can read apparatus in lab" on public.apparatus;
create policy "Department members can read apparatus in lab"
on public.apparatus
for select
using (public.is_lab_member(lab_id));

drop policy if exists "Assistants and managers can insert apparatus in lab" on public.apparatus;
create policy "Assistants and managers can insert apparatus in lab"
on public.apparatus
for insert
with check (
  created_by = auth.uid()
  and public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager'])
);

drop policy if exists "Assistants and managers can update apparatus in lab" on public.apparatus;
create policy "Assistants and managers can update apparatus in lab"
on public.apparatus
for update
using (public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager']))
with check (public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager']));

drop policy if exists "Managers can delete apparatus in lab" on public.apparatus;
create policy "Managers can delete apparatus in lab"
on public.apparatus
for delete
using (public.lab_member_has_role(lab_id, array['lab_manager']));

create table if not exists public.apparatus_bookings (
  id uuid primary key default gen_random_uuid(),
  apparatus_id uuid not null references public.apparatus(id) on delete cascade,
  lab_id uuid not null references public.labs(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  booking_date timestamptz not null,
  time_slot text not null,
  purpose text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists idx_apparatus_bookings_lab_id on public.apparatus_bookings(lab_id);
create index if not exists idx_apparatus_bookings_apparatus_id on public.apparatus_bookings(apparatus_id);

create table if not exists public.apparatus_maintenance (
  id uuid primary key default gen_random_uuid(),
  apparatus_id uuid not null references public.apparatus(id) on delete cascade,
  lab_id uuid not null references public.labs(id) on delete cascade,
  scheduled_for timestamptz not null,
  maintenance_type text not null,
  notes text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_apparatus_maintenance_lab_id on public.apparatus_maintenance(lab_id);
create index if not exists idx_apparatus_maintenance_scheduled_for on public.apparatus_maintenance(scheduled_for desc);

create table if not exists public.lab_attendance (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.labs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_lab_attendance_lab_id on public.lab_attendance(lab_id);
create index if not exists idx_lab_attendance_user_id on public.lab_attendance(user_id);

alter table public.apparatus_bookings enable row level security;
alter table public.apparatus_maintenance enable row level security;
alter table public.lab_attendance enable row level security;

drop policy if exists "Department members can read apparatus bookings in lab" on public.apparatus_bookings;
create policy "Department members can read apparatus bookings in lab"
on public.apparatus_bookings
for select
using (
  exists (
    select 1
    from public.lab_members lm
    where lm.lab_id = apparatus_bookings.lab_id
      and lm.user_id = auth.uid()
  )
);

drop policy if exists "Members can create apparatus bookings in lab" on public.apparatus_bookings;
create policy "Members can create apparatus bookings in lab"
on public.apparatus_bookings
for insert
with check (
  requested_by = auth.uid()
  and exists (
    select 1
    from public.lab_members lm
    where lm.lab_id = apparatus_bookings.lab_id
      and lm.user_id = auth.uid()
      and lm.role in ('faculty', 'lab_assistant', 'lab_manager')
  )
);

drop policy if exists "Managers can update apparatus bookings in lab" on public.apparatus_bookings;
create policy "Managers can update apparatus bookings in lab"
on public.apparatus_bookings
for update
using (
  exists (
    select 1
    from public.lab_members lm
    where lm.lab_id = apparatus_bookings.lab_id
      and lm.user_id = auth.uid()
      and lm.role = 'lab_manager'
  )
)
with check (
  exists (
    select 1
    from public.lab_members lm
    where lm.lab_id = apparatus_bookings.lab_id
      and lm.user_id = auth.uid()
      and lm.role = 'lab_manager'
  )
);

drop policy if exists "Owners or managers can delete apparatus bookings in lab" on public.apparatus_bookings;
create policy "Owners or managers can delete apparatus bookings in lab"
on public.apparatus_bookings
for delete
using (
  requested_by = auth.uid()
  or exists (
    select 1
    from public.lab_members lm
    where lm.lab_id = apparatus_bookings.lab_id
      and lm.user_id = auth.uid()
      and lm.role = 'lab_manager'
  )
);

drop policy if exists "Department members can read maintenance in lab" on public.apparatus_maintenance;
create policy "Department members can read maintenance in lab"
on public.apparatus_maintenance
for select
using (
  exists (
    select 1
    from public.lab_members lm
    where lm.lab_id = apparatus_maintenance.lab_id
      and lm.user_id = auth.uid()
  )
);

drop policy if exists "Assistants and managers can create maintenance in lab" on public.apparatus_maintenance;
create policy "Assistants and managers can create maintenance in lab"
on public.apparatus_maintenance
for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.lab_members lm
    where lm.lab_id = apparatus_maintenance.lab_id
      and lm.user_id = auth.uid()
      and lm.role in ('lab_assistant', 'lab_manager')
  )
);

drop policy if exists "Assistants and managers can update maintenance in lab" on public.apparatus_maintenance;
create policy "Assistants and managers can update maintenance in lab"
on public.apparatus_maintenance
for update
using (
  exists (
    select 1
    from public.lab_members lm
    where lm.lab_id = apparatus_maintenance.lab_id
      and lm.user_id = auth.uid()
      and lm.role in ('lab_assistant', 'lab_manager')
  )
)
with check (
  exists (
    select 1
    from public.lab_members lm
    where lm.lab_id = apparatus_maintenance.lab_id
      and lm.user_id = auth.uid()
      and lm.role in ('lab_assistant', 'lab_manager')
  )
);

drop policy if exists "Managers can delete maintenance in lab" on public.apparatus_maintenance;
create policy "Managers can delete maintenance in lab"
on public.apparatus_maintenance
for delete
using (
  exists (
    select 1
    from public.lab_members lm
    where lm.lab_id = apparatus_maintenance.lab_id
      and lm.user_id = auth.uid()
      and lm.role = 'lab_manager'
  )
);

drop policy if exists "Members can read attendance in lab" on public.lab_attendance;
create policy "Members can read attendance in lab"
on public.lab_attendance
for select
using (
  exists (
    select 1
    from public.lab_members lm
    where lm.lab_id = lab_attendance.lab_id
      and lm.user_id = auth.uid()
  )
);

drop policy if exists "Members can create own attendance in lab" on public.lab_attendance;
create policy "Members can create own attendance in lab"
on public.lab_attendance
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.lab_members lm
    where lm.lab_id = lab_attendance.lab_id
      and lm.user_id = auth.uid()
  )
);

drop policy if exists "Owners or managers can update attendance in lab" on public.lab_attendance;
create policy "Owners or managers can update attendance in lab"
on public.lab_attendance
for update
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.lab_members lm
    where lm.lab_id = lab_attendance.lab_id
      and lm.user_id = auth.uid()
      and lm.role = 'lab_manager'
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.lab_members lm
    where lm.lab_id = lab_attendance.lab_id
      and lm.user_id = auth.uid()
      and lm.role = 'lab_manager'
  )
);

create table if not exists public.lab_incidents (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.labs(id) on delete cascade,
  reported_by uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('accident', 'spill', 'equipment_breakage', 'missing_item', 'near_miss', 'other')),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  location text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_lab_incidents_lab_id on public.lab_incidents(lab_id);
create index if not exists idx_lab_incidents_created_at on public.lab_incidents(created_at desc);

alter table public.lab_incidents enable row level security;

drop policy if exists "Non-students can read incidents in department labs" on public.lab_incidents;
create policy "Non-students can read incidents in department labs"
on public.lab_incidents
for select
using (
  exists (
    select 1
    from public.profiles p
    join public.labs l on l.department = p.department
    where p.id = auth.uid()
      and p.status = 'approved'
      and p.role in ('faculty', 'lab_assistant', 'lab_manager')
      and l.id = lab_incidents.lab_id
  )
);

drop policy if exists "Non-students can insert incidents in department labs" on public.lab_incidents;
create policy "Non-students can insert incidents in department labs"
on public.lab_incidents
for insert
with check (
  reported_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    join public.labs l on l.department = p.department
    where p.id = auth.uid()
      and p.status = 'approved'
      and p.role in ('faculty', 'lab_assistant', 'lab_manager')
      and l.id = lab_incidents.lab_id
  )
);

drop policy if exists "Assistants and managers can update incidents in department labs" on public.lab_incidents;
create policy "Assistants and managers can update incidents in department labs"
on public.lab_incidents
for update
using (
  exists (
    select 1
    from public.profiles p
    join public.labs l on l.department = p.department
    where p.id = auth.uid()
      and p.status = 'approved'
      and p.role in ('lab_assistant', 'lab_manager')
      and l.id = lab_incidents.lab_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    join public.labs l on l.department = p.department
    where p.id = auth.uid()
      and p.status = 'approved'
      and p.role in ('lab_assistant', 'lab_manager')
      and l.id = lab_incidents.lab_id
  )
);

-- 4) Notification table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_notifications_user_created
  on public.notifications(user_id, created_at desc);

-- =====================================
-- RLS: chemical_documents
-- =====================================
alter table public.chemical_documents enable row level security;

drop policy if exists "Approved users can read chemical documents" on public.chemical_documents;
drop policy if exists "Tenant members can read chemical documents" on public.chemical_documents;
create policy "Tenant members can read chemical documents"
on public.chemical_documents
for select
using (public.is_lab_member(lab_id));

drop policy if exists "Assistants and managers can upload chemical documents" on public.chemical_documents;
drop policy if exists "Assistants and managers can upload documents in lab" on public.chemical_documents;
create policy "Assistants and managers can upload documents in lab"
on public.chemical_documents
for insert
with check (
  uploaded_by = auth.uid()
  and public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager'])
);

drop policy if exists "Managers can delete chemical documents" on public.chemical_documents;
drop policy if exists "Managers can delete documents in lab" on public.chemical_documents;
create policy "Managers can delete documents in lab"
on public.chemical_documents
for delete
using (public.lab_member_has_role(lab_id, array['lab_manager']));

-- =====================================
-- RLS: notifications
-- =====================================
alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
drop policy if exists "Users can read own notifications in lab" on public.notifications;
create policy "Users can read own notifications in lab"
on public.notifications
for select
using (auth.uid() = user_id and public.is_lab_member(lab_id));

drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Users can update own notifications in lab" on public.notifications;
create policy "Users can update own notifications in lab"
on public.notifications
for update
using (auth.uid() = user_id and public.is_lab_member(lab_id))
with check (auth.uid() = user_id and public.is_lab_member(lab_id));

drop policy if exists "System can insert notifications for approved users" on public.notifications;
drop policy if exists "Assistants and managers can insert notifications in lab" on public.notifications;
create policy "Assistants and managers can insert notifications in lab"
on public.notifications
for insert
with check (
  user_id is not null
  and public.is_lab_member(lab_id)
  and public.lab_member_has_role(lab_id, array['lab_assistant', 'lab_manager'])
);
