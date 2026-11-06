-- Con los registros abiertos, solo quien agregó un libro puede eliminarlo.
-- Ejecutar una vez en Supabase → SQL Editor si ya se había corrido supabase.sql antes de este cambio.
drop policy if exists "books: eliminar" on public.books;
create policy "books: eliminar propio" on public.books for delete to authenticated using (added_by = auth.uid());
