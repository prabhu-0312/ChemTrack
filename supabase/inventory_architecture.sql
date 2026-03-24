-- =====================================
-- CHEMTRACK INVENTORY ARCHITECTURE UPGRADE
-- =====================================

-- 1) Extend chemicals for low-stock threshold
alter table public.chemicals
add column if not exists low_stock_threshold numeric not null default 10;

-- 2) Chemical containers (one chemical -> many containers)
create table if not exists public.chemical_containers (
  id uuid primary key default gen_random_uuid(),
  chemical_id uuid not null references public.chemicals(id) on delete cascade,
  container_code text not null unique,
  batch_number text,
  quantity numeric not null default 0 check (quantity >= 0),
  unit text not null default 'units',
  location text not null,
  expiry_date date,
  opened_at timestamp with time zone,
  status text not null default 'available'
    check (status in ('available', 'empty', 'expired', 'disposed')),
  created_at timestamp with time zone not null default now()
);

-- 3) Inventory transaction ledger (audit trail)
create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references public.chemical_containers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('add', 'consume', 'adjust', 'dispose')),
  quantity_change numeric not null,
  notes text,
  created_at timestamp with time zone not null default now()
);

-- Helpful indexes
create index if not exists idx_chemical_containers_chemical_id on public.chemical_containers(chemical_id);
create index if not exists idx_chemical_containers_expiry_date on public.chemical_containers(expiry_date);
create index if not exists idx_inventory_transactions_container_id on public.inventory_transactions(container_id);
create index if not exists idx_inventory_transactions_user_id on public.inventory_transactions(user_id);
create index if not exists idx_inventory_transactions_created_at on public.inventory_transactions(created_at desc);

-- =====================================
-- RLS FOR NEW TABLES
-- =====================================
alter table public.chemical_containers enable row level security;
alter table public.inventory_transactions enable row level security;

-- -----------------------------
-- chemical_containers policies
-- students: read only
-- faculty: read only
-- lab_assistant: manage containers
-- lab_manager: full access
-- -----------------------------
drop policy if exists "Authenticated users can read containers" on public.chemical_containers;
create policy "Authenticated users can read containers"
on public.chemical_containers
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'approved'
  )
);

drop policy if exists "Assistants and managers can insert containers" on public.chemical_containers;
create policy "Assistants and managers can insert containers"
on public.chemical_containers
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'approved'
      and p.role in ('lab_assistant', 'lab_manager')
  )
);

drop policy if exists "Assistants and managers can update containers" on public.chemical_containers;
create policy "Assistants and managers can update containers"
on public.chemical_containers
for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'approved'
      and p.role in ('lab_assistant', 'lab_manager')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'approved'
      and p.role in ('lab_assistant', 'lab_manager')
  )
);

drop policy if exists "Managers can delete containers" on public.chemical_containers;
create policy "Managers can delete containers"
on public.chemical_containers
for delete
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'approved'
      and p.role = 'lab_manager'
  )
);

-- -----------------------------
-- inventory_transactions policies
-- students: read only (own)
-- faculty: read own + consume
-- lab_assistant: read all + add/adjust/dispose/consume
-- lab_manager: full access
-- -----------------------------
drop policy if exists "Users can read own transactions" on public.inventory_transactions;
create policy "Users can read own transactions"
on public.inventory_transactions
for select
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'approved'
  )
);

drop policy if exists "Assistants and managers can read all transactions" on public.inventory_transactions;
create policy "Assistants and managers can read all transactions"
on public.inventory_transactions
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'approved'
      and p.role in ('lab_assistant', 'lab_manager')
  )
);

drop policy if exists "Faculty can consume from transactions" on public.inventory_transactions;
create policy "Faculty can consume from transactions"
on public.inventory_transactions
for insert
with check (
  auth.uid() = user_id
  and action = 'consume'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'approved'
      and p.role = 'faculty'
  )
);

drop policy if exists "Assistants and managers can insert transactions" on public.inventory_transactions;
create policy "Assistants and managers can insert transactions"
on public.inventory_transactions
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'approved'
      and p.role in ('lab_assistant', 'lab_manager')
  )
);
