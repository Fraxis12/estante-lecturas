-- Estantes personales: cada usuario solo ve y cambia sus propios libros, reseñas y nombre.
-- Sin sesión no se ve nada. Ejecutar en Supabase → SQL Editor. Se puede correr más de una vez.

alter table public.books alter column added_by set default auth.uid();

-- Libros: solo los propios
drop policy if exists "books: leer"              on public.books;
drop policy if exists "books: agregar"           on public.books;
drop policy if exists "books: editar"            on public.books;
drop policy if exists "books: eliminar"          on public.books;
drop policy if exists "books: eliminar propio"   on public.books;
drop policy if exists "books: leer propios"      on public.books;
drop policy if exists "books: agregar propios"   on public.books;
drop policy if exists "books: editar propios"    on public.books;
drop policy if exists "books: eliminar propios"  on public.books;
create policy "books: leer propios"     on public.books for select to authenticated using (added_by = auth.uid());
create policy "books: agregar propios"  on public.books for insert to authenticated with check (added_by = auth.uid());
create policy "books: editar propios"   on public.books for update to authenticated using (added_by = auth.uid()) with check (added_by = auth.uid());
create policy "books: eliminar propios" on public.books for delete to authenticated using (added_by = auth.uid());

-- Reseñas: solo las propias
drop policy if exists "reviews: leer"         on public.reviews;
drop policy if exists "reviews: leer propias" on public.reviews;
create policy "reviews: leer propias" on public.reviews for select to authenticated using (user_id = auth.uid());

-- Nombre: solo el propio
drop policy if exists "profiles: leer"        on public.profiles;
drop policy if exists "profiles: leer propio" on public.profiles;
create policy "profiles: leer propio" on public.profiles for select to authenticated using (id = auth.uid());

-- Sin sesión, la API no entrega nada de estas tablas
revoke select on public.books, public.reviews, public.profiles from anon;

notify pgrst, 'reload schema';
