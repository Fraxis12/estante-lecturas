-- Racha de escritura: cuánto escribió cada persona en las notas de cada libro, por día.
-- Un día cuenta para la racha cuando la suma de (best_len - baseline_len) llega a 100.
-- baseline_len: largo de la nota al empezar ese día; best_len: el mayor largo guardado ese día
-- (así borrar y reescribir el mismo texto no suma dos veces). Los espacios no se cuentan.
-- Ejecutar en Supabase → SQL Editor. Se puede correr más de una vez.
create table if not exists public.note_activity (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day          date not null,
  book_id      uuid not null,
  baseline_len int  not null check (baseline_len >= 0),
  best_len     int  not null check (best_len >= 0),
  updated_at   timestamptz not null default now(),
  primary key (user_id, day, book_id)
);

grant select, insert, update, delete on public.note_activity to authenticated;
alter table public.note_activity enable row level security;

drop policy if exists "racha: leer propia"   on public.note_activity;
drop policy if exists "racha: crear propia"  on public.note_activity;
drop policy if exists "racha: editar propia" on public.note_activity;
create policy "racha: leer propia"   on public.note_activity for select to authenticated using (user_id = auth.uid());
create policy "racha: crear propia"  on public.note_activity for insert to authenticated with check (user_id = auth.uid());
create policy "racha: editar propia" on public.note_activity for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

notify pgrst, 'reload schema';
