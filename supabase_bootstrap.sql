-- Supabase bootstrap for Kumasci Panel
-- Bootstrap superadmin email: leventkrdg4@gmail.com
-- If you want a different bootstrap superadmin later, replace this email before running.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'viewer',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('viewer', 'depo', 'dokuma', 'boyahane', 'admin', 'superadmin')),
  constraint profiles_status_check check (status in ('approved', 'pending', 'rejected'))
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role text default 'viewer';
alter table public.profiles add column if not exists status text default 'pending';
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

update public.profiles
set
  role = coalesce(nullif(role, ''), 'viewer'),
  status = coalesce(nullif(status, ''), 'pending'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.profiles alter column role set default 'viewer';
alter table public.profiles alter column status set default 'pending';
alter table public.profiles alter column created_at set default now();
alter table public.profiles alter column updated_at set default now();

alter table public.profiles alter column role set not null;
alter table public.profiles alter column status set not null;
alter table public.profiles alter column created_at set not null;
alter table public.profiles alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('viewer', 'depo', 'dokuma', 'boyahane', 'admin', 'superadmin'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_status_check
      check (status in ('approved', 'pending', 'rejected'));
  end if;
end
$$;

create unique index if not exists profiles_email_lower_unique
  on public.profiles ((lower(email)))
  where email is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_role text := 'viewer';
  next_status text := 'pending';
begin
  if lower(coalesce(new.email, '')) = lower('leventkrdg4@gmail.com') then
    next_role := 'superadmin';
    next_status := 'approved';
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    status,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    next_role,
    next_status,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    role = case
      when lower(coalesce(excluded.email, '')) = lower('leventkrdg4@gmail.com') then 'superadmin'
      else public.profiles.role
    end,
    status = case
      when lower(coalesce(excluded.email, '')) = lower('leventkrdg4@gmail.com') then 'approved'
      else public.profiles.status
    end,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_created on auth.users;
create trigger on_auth_user_profile_created
after insert on auth.users
for each row
execute function public.handle_auth_user_profile();

insert into public.profiles (
  id,
  email,
  full_name,
  role,
  status,
  created_at,
  updated_at
)
select
  u.id,
  u.email,
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
  case
    when lower(coalesce(u.email, '')) = lower('leventkrdg4@gmail.com') then 'superadmin'
    else 'viewer'
  end,
  case
    when lower(coalesce(u.email, '')) = lower('leventkrdg4@gmail.com') then 'approved'
    else 'pending'
  end,
  coalesce(u.created_at, now()),
  now()
from auth.users as u
on conflict (id) do update
set
  email = excluded.email,
  full_name = coalesce(excluded.full_name, public.profiles.full_name),
  role = case
    when lower(coalesce(excluded.email, '')) = lower('leventkrdg4@gmail.com') then 'superadmin'
    else public.profiles.role
  end,
  status = case
    when lower(coalesce(excluded.email, '')) = lower('leventkrdg4@gmail.com') then 'approved'
    else public.profiles.status
  end,
  updated_at = now();

update public.profiles
set
  role = 'superadmin',
  status = 'approved',
  updated_at = now()
where lower(coalesce(email, '')) = lower('leventkrdg4@gmail.com');

create or replace function public.is_approved_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'superadmin'
      and status = 'approved'
  );
$$;

revoke all on function public.is_approved_superadmin() from public;
grant execute on function public.is_approved_superadmin() to authenticated;

alter table public.profiles enable row level security;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists profiles_superadmin_read on public.profiles;
create policy profiles_superadmin_read
  on public.profiles
  for select
  to authenticated
  using (public.is_approved_superadmin());

drop policy if exists profiles_superadmin_update on public.profiles;
create policy profiles_superadmin_update
  on public.profiles
  for update
  to authenticated
  using (public.is_approved_superadmin())
  with check (public.is_approved_superadmin());

drop policy if exists profiles_superadmin_delete on public.profiles;
create policy profiles_superadmin_delete
  on public.profiles
  for delete
  to authenticated
  using (public.is_approved_superadmin());

create table if not exists public.system_settings (
  key text primary key,
  value text not null default 'true',
  updated_at timestamptz not null default now()
);

alter table public.system_settings add column if not exists value text default 'true';
alter table public.system_settings add column if not exists updated_at timestamptz default now();

update public.system_settings
set
  value = coalesce(value, 'true'),
  updated_at = coalesce(updated_at, now());

alter table public.system_settings alter column value set default 'true';
alter table public.system_settings alter column updated_at set default now();
alter table public.system_settings alter column value set not null;
alter table public.system_settings alter column updated_at set not null;

insert into public.system_settings (key, value)
values ('dyehouse_to_depot_enabled', 'true')
on conflict (key) do nothing;

drop trigger if exists system_settings_set_updated_at on public.system_settings;
create trigger system_settings_set_updated_at
before update on public.system_settings
for each row
execute function public.set_updated_at();

alter table public.system_settings enable row level security;

drop policy if exists system_settings_read on public.system_settings;
create policy system_settings_read
  on public.system_settings
  for select
  to authenticated
  using (true);

drop policy if exists system_settings_superadmin_write on public.system_settings;
create policy system_settings_superadmin_write
  on public.system_settings
  for all
  to authenticated
  using (public.is_approved_superadmin())
  with check (public.is_approved_superadmin());

create table if not exists public.patterns (
  id text primary key,
  created_at timestamptz not null default now(),
  fabric_code text not null unique,
  fabric_name text not null,
  weave_type text,
  warp_count text,
  weft_count text,
  total_ends text,
  current_stage text not null default 'DEPO',
  total_produced_meters numeric not null default 0,
  stock_meters numeric not null default 0,
  defect_meters numeric not null default 0,
  in_dyehouse_meters numeric not null default 0,
  variants jsonb not null default '[]'::jsonb,
  parti_nos jsonb not null default '[]'::jsonb,
  gramaj_gm2 numeric,
  fire_orani numeric,
  musteri text,
  depo_no text,
  kg numeric,
  eni_cm numeric,
  tarak_eni_cm numeric,
  color text,
  image_digital text,
  image_final text,
  note text,
  archived boolean not null default false
);

alter table public.patterns add column if not exists created_at timestamptz default now();
alter table public.patterns add column if not exists fabric_code text;
alter table public.patterns add column if not exists fabric_name text;
alter table public.patterns add column if not exists weave_type text;
alter table public.patterns add column if not exists warp_count text;
alter table public.patterns add column if not exists weft_count text;
alter table public.patterns add column if not exists total_ends text;
alter table public.patterns add column if not exists current_stage text default 'DEPO';
alter table public.patterns add column if not exists total_produced_meters numeric default 0;
alter table public.patterns add column if not exists stock_meters numeric default 0;
alter table public.patterns add column if not exists defect_meters numeric default 0;
alter table public.patterns add column if not exists in_dyehouse_meters numeric default 0;
alter table public.patterns add column if not exists variants jsonb default '[]'::jsonb;
alter table public.patterns add column if not exists parti_nos jsonb default '[]'::jsonb;
alter table public.patterns add column if not exists gramaj_gm2 numeric;
alter table public.patterns add column if not exists fire_orani numeric;
alter table public.patterns add column if not exists musteri text;
alter table public.patterns add column if not exists depo_no text;
alter table public.patterns add column if not exists kg numeric;
alter table public.patterns add column if not exists eni_cm numeric;
alter table public.patterns add column if not exists tarak_eni_cm numeric;
alter table public.patterns add column if not exists color text;
alter table public.patterns add column if not exists image_digital text;
alter table public.patterns add column if not exists image_final text;
alter table public.patterns add column if not exists note text;
alter table public.patterns add column if not exists archived boolean default false;

update public.patterns
set
  created_at = coalesce(created_at, now()),
  current_stage = coalesce(nullif(current_stage, ''), 'DEPO'),
  total_produced_meters = coalesce(total_produced_meters, 0),
  stock_meters = coalesce(stock_meters, 0),
  defect_meters = coalesce(defect_meters, 0),
  in_dyehouse_meters = coalesce(in_dyehouse_meters, 0),
  variants = coalesce(variants, '[]'::jsonb),
  parti_nos = coalesce(parti_nos, '[]'::jsonb),
  archived = coalesce(archived, false);

alter table public.patterns alter column created_at set default now();
alter table public.patterns alter column current_stage set default 'DEPO';
alter table public.patterns alter column total_produced_meters set default 0;
alter table public.patterns alter column stock_meters set default 0;
alter table public.patterns alter column defect_meters set default 0;
alter table public.patterns alter column in_dyehouse_meters set default 0;
alter table public.patterns alter column variants set default '[]'::jsonb;
alter table public.patterns alter column parti_nos set default '[]'::jsonb;
alter table public.patterns alter column archived set default false;

alter table public.patterns enable row level security;

drop policy if exists patterns_authenticated_access on public.patterns;
create policy patterns_authenticated_access
  on public.patterns
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.fabric_rolls (
  id text primary key,
  pattern_id text not null,
  variant_id text,
  color_name text,
  meters numeric not null check (meters >= 0),
  roll_no text,
  status text not null default 'IN_STOCK',
  in_at timestamptz not null,
  out_at timestamptz,
  reserved_at timestamptz,
  reserved_for text,
  counterparty text,
  note text
);

alter table public.fabric_rolls add column if not exists pattern_id text;
alter table public.fabric_rolls add column if not exists variant_id text;
alter table public.fabric_rolls add column if not exists color_name text;
alter table public.fabric_rolls add column if not exists meters numeric default 0;
alter table public.fabric_rolls add column if not exists roll_no text;
alter table public.fabric_rolls add column if not exists status text default 'IN_STOCK';
alter table public.fabric_rolls add column if not exists in_at timestamptz default now();
alter table public.fabric_rolls add column if not exists out_at timestamptz;
alter table public.fabric_rolls add column if not exists reserved_at timestamptz;
alter table public.fabric_rolls add column if not exists reserved_for text;
alter table public.fabric_rolls add column if not exists counterparty text;
alter table public.fabric_rolls add column if not exists note text;

update public.fabric_rolls
set
  meters = coalesce(meters, 0),
  status = coalesce(nullif(status, ''), 'IN_STOCK'),
  in_at = coalesce(in_at, now());

alter table public.fabric_rolls alter column meters set default 0;
alter table public.fabric_rolls alter column status set default 'IN_STOCK';
alter table public.fabric_rolls alter column in_at set default now();

create index if not exists fabric_rolls_pattern_id_idx on public.fabric_rolls (pattern_id);
create index if not exists fabric_rolls_status_idx on public.fabric_rolls (status);

alter table public.fabric_rolls enable row level security;

drop policy if exists fabric_rolls_authenticated_access on public.fabric_rolls;
create policy fabric_rolls_authenticated_access
  on public.fabric_rolls
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.depo_transactions (
  id text primary key,
  type text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  customer_id text,
  customer_name_snapshot text,
  note text,
  total_tops integer,
  total_metres numeric,
  pattern_count integer,
  target_transaction_id text,
  reversed_at timestamptz,
  reversed_by_transaction_id text
);

alter table public.depo_transactions add column if not exists type text;
alter table public.depo_transactions add column if not exists status text default 'ACTIVE';
alter table public.depo_transactions add column if not exists created_at timestamptz default now();
alter table public.depo_transactions add column if not exists customer_id text;
alter table public.depo_transactions add column if not exists customer_name_snapshot text;
alter table public.depo_transactions add column if not exists note text;
alter table public.depo_transactions add column if not exists total_tops integer;
alter table public.depo_transactions add column if not exists total_metres numeric;
alter table public.depo_transactions add column if not exists pattern_count integer;
alter table public.depo_transactions add column if not exists target_transaction_id text;
alter table public.depo_transactions add column if not exists reversed_at timestamptz;
alter table public.depo_transactions add column if not exists reversed_by_transaction_id text;

update public.depo_transactions
set
  status = coalesce(nullif(status, ''), 'ACTIVE'),
  created_at = coalesce(created_at, now());

alter table public.depo_transactions alter column status set default 'ACTIVE';
alter table public.depo_transactions alter column created_at set default now();

create index if not exists depo_transactions_created_at_idx on public.depo_transactions (created_at desc);

alter table public.depo_transactions enable row level security;

drop policy if exists depo_transactions_authenticated_access on public.depo_transactions;
create policy depo_transactions_authenticated_access
  on public.depo_transactions
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.depo_transaction_lines (
  id text primary key,
  transaction_id text not null references public.depo_transactions(id) on delete cascade,
  pattern_id text not null,
  pattern_no_snapshot text not null,
  pattern_name_snapshot text not null,
  color text not null,
  metre_per_top numeric not null,
  top_count integer not null,
  total_metres numeric not null,
  roll_ids text[]
);

alter table public.depo_transaction_lines add column if not exists transaction_id text;
alter table public.depo_transaction_lines add column if not exists pattern_id text;
alter table public.depo_transaction_lines add column if not exists pattern_no_snapshot text;
alter table public.depo_transaction_lines add column if not exists pattern_name_snapshot text;
alter table public.depo_transaction_lines add column if not exists color text;
alter table public.depo_transaction_lines add column if not exists metre_per_top numeric;
alter table public.depo_transaction_lines add column if not exists top_count integer;
alter table public.depo_transaction_lines add column if not exists total_metres numeric;
alter table public.depo_transaction_lines add column if not exists roll_ids text[];

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'depo_transaction_lines'
      and column_name = 'roll_ids'
      and udt_name = 'jsonb'
  ) then
    alter table public.depo_transaction_lines
      alter column roll_ids type text[]
      using (
        case
          when roll_ids is null then null
          else array(select jsonb_array_elements_text(roll_ids))
        end
      );
  end if;
exception
  when others then
    null;
end
$$;

create index if not exists depo_transaction_lines_transaction_id_idx
  on public.depo_transaction_lines (transaction_id);

alter table public.depo_transaction_lines enable row level security;

drop policy if exists depo_transaction_lines_authenticated_access on public.depo_transaction_lines;
create policy depo_transaction_lines_authenticated_access
  on public.depo_transaction_lines
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.weaving_plans (
  id text primary key,
  pattern_id text not null,
  pattern_no_snapshot text not null,
  pattern_name_snapshot text not null,
  planned_meters numeric not null default 0,
  ham_kumas_eni_cm numeric,
  tarak_eni_cm numeric,
  variants jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  note text,
  status text not null default 'ACTIVE',
  manual_completed_at timestamptz
);

alter table public.weaving_plans add column if not exists pattern_id text;
alter table public.weaving_plans add column if not exists pattern_no_snapshot text;
alter table public.weaving_plans add column if not exists pattern_name_snapshot text;
alter table public.weaving_plans add column if not exists planned_meters numeric default 0;
alter table public.weaving_plans add column if not exists ham_kumas_eni_cm numeric;
alter table public.weaving_plans add column if not exists tarak_eni_cm numeric;
alter table public.weaving_plans add column if not exists variants jsonb default '[]'::jsonb;
alter table public.weaving_plans add column if not exists created_at timestamptz default now();
alter table public.weaving_plans add column if not exists note text;
alter table public.weaving_plans add column if not exists status text default 'ACTIVE';
alter table public.weaving_plans add column if not exists manual_completed_at timestamptz;

update public.weaving_plans
set
  planned_meters = coalesce(planned_meters, 0),
  variants = coalesce(variants, '[]'::jsonb),
  created_at = coalesce(created_at, now()),
  status = coalesce(nullif(status, ''), 'ACTIVE');

alter table public.weaving_plans alter column planned_meters set default 0;
alter table public.weaving_plans alter column variants set default '[]'::jsonb;
alter table public.weaving_plans alter column created_at set default now();
alter table public.weaving_plans alter column status set default 'ACTIVE';

create index if not exists weaving_plans_pattern_id_idx on public.weaving_plans (pattern_id);

alter table public.weaving_plans enable row level security;

drop policy if exists weaving_plans_authenticated_access on public.weaving_plans;
create policy weaving_plans_authenticated_access
  on public.weaving_plans
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.weaving_progress (
  id text primary key,
  plan_id text not null,
  created_at timestamptz not null default now(),
  meters numeric not null default 0,
  meters_per_unit numeric,
  unit_count integer,
  variant_id text,
  note text
);

alter table public.weaving_progress add column if not exists plan_id text;
alter table public.weaving_progress add column if not exists created_at timestamptz default now();
alter table public.weaving_progress add column if not exists meters numeric default 0;
alter table public.weaving_progress add column if not exists meters_per_unit numeric;
alter table public.weaving_progress add column if not exists unit_count integer;
alter table public.weaving_progress add column if not exists variant_id text;
alter table public.weaving_progress add column if not exists note text;

update public.weaving_progress
set
  created_at = coalesce(created_at, now()),
  meters = coalesce(meters, 0);

alter table public.weaving_progress alter column created_at set default now();
alter table public.weaving_progress alter column meters set default 0;

create index if not exists weaving_progress_plan_id_idx on public.weaving_progress (plan_id);

alter table public.weaving_progress enable row level security;

drop policy if exists weaving_progress_authenticated_access on public.weaving_progress;
create policy weaving_progress_authenticated_access
  on public.weaving_progress
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.weaving_transfers (
  id text primary key,
  plan_id text not null,
  created_at timestamptz not null default now(),
  meters numeric not null default 0,
  variant_lines jsonb not null default '[]'::jsonb,
  destination text not null,
  dyehouse_id text,
  dyehouse_name_snapshot text,
  note text
);

alter table public.weaving_transfers add column if not exists plan_id text;
alter table public.weaving_transfers add column if not exists created_at timestamptz default now();
alter table public.weaving_transfers add column if not exists meters numeric default 0;
alter table public.weaving_transfers add column if not exists variant_lines jsonb default '[]'::jsonb;
alter table public.weaving_transfers add column if not exists destination text;
alter table public.weaving_transfers add column if not exists dyehouse_id text;
alter table public.weaving_transfers add column if not exists dyehouse_name_snapshot text;
alter table public.weaving_transfers add column if not exists note text;

update public.weaving_transfers
set
  created_at = coalesce(created_at, now()),
  meters = coalesce(meters, 0),
  variant_lines = coalesce(variant_lines, '[]'::jsonb);

alter table public.weaving_transfers alter column created_at set default now();
alter table public.weaving_transfers alter column meters set default 0;
alter table public.weaving_transfers alter column variant_lines set default '[]'::jsonb;

create index if not exists weaving_transfers_plan_id_idx on public.weaving_transfers (plan_id);

alter table public.weaving_transfers enable row level security;

drop policy if exists weaving_transfers_authenticated_access on public.weaving_transfers;
create policy weaving_transfers_authenticated_access
  on public.weaving_transfers
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.weaving_dispatch_documents (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now(),
  destination text not null,
  doc_no text not null,
  transfer_id text,
  source_job_id text,
  source_dispatch_doc_id text,
  plan_id text not null,
  pattern_id text not null,
  pattern_no_snapshot text not null,
  pattern_name_snapshot text not null,
  destination_name_snapshot text not null,
  dyehouse_id text,
  variant_lines jsonb not null default '[]'::jsonb,
  meters_total numeric not null default 0,
  note text
);

alter table public.weaving_dispatch_documents add column if not exists type text;
alter table public.weaving_dispatch_documents add column if not exists created_at timestamptz default now();
alter table public.weaving_dispatch_documents add column if not exists destination text;
alter table public.weaving_dispatch_documents add column if not exists doc_no text;
alter table public.weaving_dispatch_documents add column if not exists transfer_id text;
alter table public.weaving_dispatch_documents add column if not exists source_job_id text;
alter table public.weaving_dispatch_documents add column if not exists source_dispatch_doc_id text;
alter table public.weaving_dispatch_documents add column if not exists plan_id text;
alter table public.weaving_dispatch_documents add column if not exists pattern_id text;
alter table public.weaving_dispatch_documents add column if not exists pattern_no_snapshot text;
alter table public.weaving_dispatch_documents add column if not exists pattern_name_snapshot text;
alter table public.weaving_dispatch_documents add column if not exists destination_name_snapshot text;
alter table public.weaving_dispatch_documents add column if not exists dyehouse_id text;
alter table public.weaving_dispatch_documents add column if not exists variant_lines jsonb default '[]'::jsonb;
alter table public.weaving_dispatch_documents add column if not exists meters_total numeric default 0;
alter table public.weaving_dispatch_documents add column if not exists note text;

update public.weaving_dispatch_documents
set
  created_at = coalesce(created_at, now()),
  variant_lines = coalesce(variant_lines, '[]'::jsonb),
  meters_total = coalesce(meters_total, 0);

alter table public.weaving_dispatch_documents alter column created_at set default now();
alter table public.weaving_dispatch_documents alter column variant_lines set default '[]'::jsonb;
alter table public.weaving_dispatch_documents alter column meters_total set default 0;

create index if not exists weaving_dispatch_documents_transfer_id_idx
  on public.weaving_dispatch_documents (transfer_id);
create index if not exists weaving_dispatch_documents_plan_id_idx
  on public.weaving_dispatch_documents (plan_id);

alter table public.weaving_dispatch_documents enable row level security;

drop policy if exists weaving_dispatch_documents_authenticated_access on public.weaving_dispatch_documents;
create policy weaving_dispatch_documents_authenticated_access
  on public.weaving_dispatch_documents
  for all
  to authenticated
  using (true)
  with check (true);
