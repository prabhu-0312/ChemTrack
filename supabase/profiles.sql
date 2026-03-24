create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  department text not null,
  role text not null check (role in ('student', 'faculty', 'lab_assistant', 'lab_manager')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Lab managers can read all profiles" on public.profiles;
create policy "Lab managers can read all profiles"
on public.profiles
for select
using (
  exists (
    select 1
    from public.profiles manager_profile
    where manager_profile.id = auth.uid()
      and manager_profile.role = 'lab_manager'
      and manager_profile.status = 'approved'
  )
);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "Lab managers can update profile status" on public.profiles;
create policy "Lab managers can update profile status"
on public.profiles
for update
using (
  exists (
    select 1
    from public.profiles manager_profile
    where manager_profile.id = auth.uid()
      and manager_profile.role = 'lab_manager'
      and manager_profile.status = 'approved'
  )
)
with check (
  exists (
    select 1
    from public.profiles manager_profile
    where manager_profile.id = auth.uid()
      and manager_profile.role = 'lab_manager'
      and manager_profile.status = 'approved'
  )
);

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
as $$
begin
  if old.role is distinct from new.role then
    raise exception 'Role cannot be changed after signup';
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_prevent_profile_role_change on public.profiles;
create trigger trigger_prevent_profile_role_change
before update on public.profiles
for each row
execute function public.prevent_profile_role_change();
