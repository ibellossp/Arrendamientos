-- Ejecutar una sola vez en Supabase: SQL Editor > New query > pegar todo > Run

create table if not exists public.contratos (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.precios (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.contratos enable row level security;
alter table public.precios enable row level security;

-- Solo usuarios que iniciaron sesión pueden leer y modificar
drop policy if exists "usuarios leen y escriben contratos" on public.contratos;
create policy "usuarios leen y escriben contratos" on public.contratos
  for all to authenticated using (true) with check (true);
drop policy if exists "usuarios leen y escriben precios" on public.precios;
create policy "usuarios leen y escriben precios" on public.precios
  for all to authenticated using (true) with check (true);

-- Avisar cambios en vivo a los demás usuarios conectados
alter publication supabase_realtime add table public.contratos, public.precios;

-- Carpeta privada para PDFs de contratos y facturas
insert into storage.buckets (id, name, public) values ('archivos', 'archivos', false)
  on conflict (id) do nothing;

drop policy if exists "usuarios leen archivos" on storage.objects;
create policy "usuarios leen archivos" on storage.objects
  for select to authenticated using (bucket_id = 'archivos');
drop policy if exists "usuarios suben archivos" on storage.objects;
create policy "usuarios suben archivos" on storage.objects
  for insert to authenticated with check (bucket_id = 'archivos');
