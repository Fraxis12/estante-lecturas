-- "Mi libro": manuscritos propios de cada usuario. Privados y sin relación con la racha.
-- Ejecutar en Supabase → SQL Editor. Se puede correr más de una vez.
create table if not exists public.my_books (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default '' check (char_length(title) <= 200),
  body        text not null default '' check (char_length(body) <= 2000000),
  word_count  int  not null default 0 check (word_count >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

grant select, insert, update, delete on public.my_books to authenticated;
alter table public.my_books enable row level security;

drop policy if exists "mi libro: leer propio"    on public.my_books;
drop policy if exists "mi libro: crear propio"   on public.my_books;
drop policy if exists "mi libro: editar propio"  on public.my_books;
drop policy if exists "mi libro: borrar propio"  on public.my_books;
create policy "mi libro: leer propio"   on public.my_books for select to authenticated using (user_id = auth.uid());
create policy "mi libro: crear propio"  on public.my_books for insert to authenticated with check (user_id = auth.uid());
create policy "mi libro: editar propio" on public.my_books for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "mi libro: borrar propio" on public.my_books for delete to authenticated using (user_id = auth.uid());

notify pgrst, 'reload schema';
