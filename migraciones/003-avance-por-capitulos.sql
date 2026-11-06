-- Avance por capítulos además de por páginas.
-- Ejecutar en Supabase → SQL Editor. Se puede correr más de una vez sin error.
alter table public.books
  add column if not exists progress_unit   text not null default 'paginas' check (progress_unit in ('paginas', 'capitulos')),
  add column if not exists chapters        int  check (chapters between 1 and 2000),
  add column if not exists current_chapter int  not null default 0 check (current_chapter >= 0);

-- Que la API vea las columnas nuevas de inmediato.
notify pgrst, 'reload schema';
