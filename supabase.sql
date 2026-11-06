-- =====================================================================
-- Estante de Lecturas: tablas, reglas de seguridad y portadas
-- Pegar completo en Supabase → SQL Editor → New query → Run (una sola vez)
-- =====================================================================

-- ---------- Tablas ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  updated_at  timestamptz not null default now()
);

create table if not exists public.books (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 200),
  author        text check (char_length(author) <= 160),
  genre         text check (char_length(genre) <= 60),
  year          text check (char_length(year) <= 12),
  pages         int  check (pages between 1 and 20000),
  status        text not null default 'por-leer' check (status in ('por-leer', 'leyendo', 'leido')),
  current_page  int  not null default 0 check (current_page >= 0),
  progress_unit text not null default 'paginas' check (progress_unit in ('paginas', 'capitulos')),
  chapters      int  check (chapters between 1 and 2000),
  current_chapter int not null default 0 check (current_chapter >= 0),
  started_at    timestamptz,
  finished_at   timestamptz,
  audio_url     text check (audio_url ~* '^https?://' and char_length(audio_url) <= 600),
  cover_path    text,
  added_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists public.reviews (
  book_id     uuid not null references public.books (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rating      int  not null default 0 check (rating between 0 and 5),
  body        text not null default '' check (char_length(body) <= 4000),
  updated_at  timestamptz not null default now(),
  primary key (book_id, user_id)
);

-- Notas privadas: un cuaderno por persona y por libro (solo lo ve quien lo escribe).
create table if not exists public.book_notes (
  book_id     uuid not null references public.books (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body        text not null default '' check (char_length(body) <= 50000),
  updated_at  timestamptz not null default now(),
  primary key (book_id, user_id)
);

-- ---------- Permisos de la API ----------
grant select, insert, update, delete on public.book_notes to authenticated;
grant select on public.books, public.reviews, public.profiles to anon, authenticated;
grant insert, update, delete on public.books, public.reviews, public.profiles to authenticated;

-- ---------- Reglas (Row Level Security) ----------
-- Cualquiera con el enlace puede VER el estante.
-- Solo quien inició sesión puede agregar o cambiar libros, y solo quien agregó un libro puede eliminarlo.
-- Cada persona solo puede escribir su propia reseña y su propio nombre.
alter table public.profiles enable row level security;
alter table public.books    enable row level security;
alter table public.reviews  enable row level security;

create policy "profiles: leer"         on public.profiles for select using (true);
create policy "profiles: crear propio" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles: editar propio" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "books: leer"     on public.books for select using (true);
create policy "books: agregar"  on public.books for insert to authenticated with check (true);
create policy "books: editar"   on public.books for update to authenticated using (true) with check (true);
create policy "books: eliminar propio" on public.books for delete to authenticated using (added_by = auth.uid());

create policy "reviews: leer"          on public.reviews for select using (true);
create policy "reviews: crear propia"  on public.reviews for insert to authenticated with check (user_id = auth.uid());
create policy "reviews: editar propia" on public.reviews for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reviews: borrar propia" on public.reviews for delete to authenticated using (user_id = auth.uid());

alter table public.book_notes enable row level security;
create policy "notas: leer propias"   on public.book_notes for select to authenticated using (user_id = auth.uid());
create policy "notas: crear propias"  on public.book_notes for insert to authenticated with check (user_id = auth.uid());
create policy "notas: editar propias" on public.book_notes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notas: borrar propias" on public.book_notes for delete to authenticated using (user_id = auth.uid());

-- ---------- Cambios en vivo (se actualiza solo en todos los dispositivos) ----------
alter publication supabase_realtime add table public.books, public.reviews, public.profiles;

-- ---------- Portadas (Storage) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "covers: subir"    on storage.objects for insert to authenticated with check (bucket_id = 'covers');
create policy "covers: cambiar"  on storage.objects for update to authenticated using (bucket_id = 'covers');
create policy "covers: eliminar" on storage.objects for delete to authenticated using (bucket_id = 'covers');
