-- STUDY AI initial schema. Apply in Supabase SQL Editor before using real student data.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  subject text not null default 'Geral',
  due_at timestamptz,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.study_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint check (size_bytes >= 0),
  processing_status text not null default 'pending' check (processing_status in ('pending','processing','ready','failed')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.study_tasks enable row level security;
alter table public.study_materials enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "tasks_all_own" on public.study_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "materials_all_own" on public.study_materials for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Private bucket. Storage policies restrict every object to its authenticated owner folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('study-materials','study-materials',false,52428800,array['application/pdf','text/plain','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do nothing;
create policy "materials_storage_select_own" on storage.objects for select to authenticated using (bucket_id='study-materials' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "materials_storage_insert_own" on storage.objects for insert to authenticated with check (bucket_id='study-materials' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "materials_storage_update_own" on storage.objects for update to authenticated using (bucket_id='study-materials' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='study-materials' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "materials_storage_delete_own" on storage.objects for delete to authenticated using (bucket_id='study-materials' and (storage.foldername(name))[1]=auth.uid()::text);
