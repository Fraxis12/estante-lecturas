-- Avance por capítulos además de por páginas.
-- Ejecutar una vez en Supabase → SQL Editor.
alter table public.books
  add column if not exists progress_unit   text not null default 'paginas',
  add column if not exists chapters        int,
  add column if not exists current_chapter int  not null default 0;

alter table public.books
  add constraint books_progress_unit_check   check (progress_unit in ('paginas', 'capitulos')),
  add constraint books_chapters_check        check (chapters between 1 and 2000),
  add constraint books_current_chapter_check check (current_chapter >= 0);
