-- Notas privadas por libro: un cuaderno por persona y por libro.
-- Solo quien las escribe puede leerlas o cambiarlas.
-- Ejecutar en Supabase → SQL Editor. Se puede correr más de una vez sin error.
create table if not exists public.book_notes (
  book_id     uuid not null references public.books (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body        text not null default '' check (char_length(body) <= 50000),
  updated_at  timestamptz not null default now(),
  primary key (book_id, user_id)
);

grant select, insert, update, delete on public.book_notes to authenticated;
alter table public.book_notes enable row level security;

drop policy if exists "notas: leer propias"   on public.book_notes;
drop policy if exists "notas: crear propias"  on public.book_notes;
drop policy if exists "notas: editar propias" on public.book_notes;
drop policy if exists "notas: borrar propias" on public.book_notes;
create policy "notas: leer propias"   on public.book_notes for select to authenticated using (user_id = auth.uid());
create policy "notas: crear propias"  on public.book_notes for insert to authenticated with check (user_id = auth.uid());
create policy "notas: editar propias" on public.book_notes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notas: borrar propias" on public.book_notes for delete to authenticated using (user_id = auth.uid());

notify pgrst, 'reload schema';
