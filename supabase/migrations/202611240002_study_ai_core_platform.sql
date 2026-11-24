-- STUDY AI core schema (already applied to the linked Supabase project).
create extension if not exists vector with schema extensions;
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text, avatar_url text, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.subjects (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 100), color text not null default '#9b8cff',
 archived boolean not null default false, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(user_id,name)
);
create table if not exists public.study_tasks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 subject_id uuid references public.subjects(id) on delete set null,
 title text not null check(char_length(title) between 1 and 240), description text,
 due_at timestamptz, priority text not null default 'medium' check(priority in ('low','medium','high')),
 completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.study_materials (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 subject_id uuid references public.subjects(id) on delete set null,
 file_name text not null check(char_length(file_name) between 1 and 255), storage_path text not null unique,
 mime_type text, size_bytes bigint check(size_bytes is null or size_bytes between 0 and 52428800),
 extracted_text text, processing_status text not null default 'pending' check(processing_status in ('pending','processing','ready','failed')),
 processing_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.study_material_chunks (
 id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade,
 material_id uuid not null references public.study_materials(id) on delete cascade,
 chunk_index integer not null check(chunk_index>=0), content text not null, page_number integer,
 start_seconds numeric, end_seconds numeric, embedding extensions.vector(1536),
 created_at timestamptz not null default now(), unique(material_id,chunk_index)
);
create table if not exists public.study_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 subject_id uuid references public.subjects(id) on delete set null, started_at timestamptz not null default now(),
 ended_at timestamptz, duration_seconds integer check(duration_seconds is null or duration_seconds>=0),
 notes text, created_at timestamptz not null default now()
);
create table if not exists public.study_conversations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null default 'Nova conversa', mode text not null default 'professor',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.study_messages (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 conversation_id uuid not null references public.study_conversations(id) on delete cascade,
 role text not null check(role in ('user','assistant','system')), content text not null,
 citations jsonb not null default '[]'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.flashcard_decks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 subject_id uuid references public.subjects(id) on delete set null,
 title text not null check(char_length(title) between 1 and 160),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.flashcards (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 deck_id uuid not null references public.flashcard_decks(id) on delete cascade, front text not null, back text not null,
 due_at timestamptz, interval_days integer not null default 0 check(interval_days>=0),
 repetitions integer not null default 0 check(repetitions>=0), ease_factor numeric(4,2) not null default 2.50 check(ease_factor>=1.30),
 last_reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.quizzes (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 subject_id uuid references public.subjects(id) on delete set null, title text not null,
 difficulty text not null default 'medium' check(difficulty in ('easy','medium','hard','mixed')),
 question_count integer not null default 10 check(question_count between 1 and 100),
 time_limit_seconds integer check(time_limit_seconds is null or time_limit_seconds>0), created_at timestamptz not null default now()
);
create table if not exists public.quiz_questions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 quiz_id uuid not null references public.quizzes(id) on delete cascade, position integer not null check(position>0),
 question text not null, options jsonb not null default '[]'::jsonb, correct_answer jsonb, explanation text,
 created_at timestamptz not null default now(), unique(quiz_id,position)
);
create table if not exists public.quiz_attempts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 quiz_id uuid not null references public.quizzes(id) on delete cascade, started_at timestamptz not null default now(),
 finished_at timestamptz, score numeric(5,2) check(score is null or score between 0 and 100),
 total_questions integer not null default 0 check(total_questions>=0), correct_count integer not null default 0 check(correct_count>=0)
);
create table if not exists public.quiz_answers (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
 question_id uuid not null references public.quiz_questions(id) on delete cascade, answer jsonb, is_correct boolean,
 created_at timestamptz not null default now(), unique(attempt_id,question_id)
);
create table if not exists public.study_goals (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(title) between 1 and 180), target_minutes integer check(target_minutes is null or target_minutes>0),
 target_date date, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index if not exists study_tasks_user_due_idx on public.study_tasks(user_id,due_at);
create index if not exists study_materials_user_created_idx on public.study_materials(user_id,created_at desc);
create index if not exists study_chunks_material_idx on public.study_material_chunks(material_id,chunk_index);
create index if not exists study_chunks_embedding_idx on public.study_material_chunks using hnsw(embedding extensions.vector_cosine_ops);
create index if not exists study_sessions_user_started_idx on public.study_sessions(user_id,started_at desc);
create index if not exists study_messages_conversation_idx on public.study_messages(conversation_id,created_at);
create index if not exists flashcards_due_idx on public.flashcards(user_id,due_at);
create index if not exists quiz_attempts_user_idx on public.quiz_attempts(user_id,started_at desc);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,display_name) values(new.id,nullif(new.raw_user_meta_data->>'full_name','')) on conflict(id) do nothing;
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

do $$ declare t text; begin
 foreach t in array array['profiles','subjects','study_tasks','study_materials','study_material_chunks','study_sessions','study_conversations','study_messages','flashcard_decks','flashcards','quizzes','quiz_questions','quiz_attempts','quiz_answers','study_goals']
 loop execute format('alter table public.%I enable row level security',t); end loop;
end $$;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using(id=(select auth.uid()));
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check(id=(select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));

do $$ declare t text; begin
 foreach t in array array['subjects','study_tasks','study_materials','study_sessions','study_conversations','study_messages','flashcard_decks','flashcards','quizzes','quiz_questions','quiz_attempts','quiz_answers','study_goals']
 loop
  execute format('drop policy if exists %I on public.%I',t||'_own',t);
  execute format('create policy %I on public.%I for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',t||'_own',t);
 end loop;
end $$;
drop policy if exists study_material_chunks_own on public.study_material_chunks;
create policy study_material_chunks_own on public.study_material_chunks for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.study_materials m where m.id=material_id and m.user_id=(select auth.uid())));

drop trigger if exists subjects_set_updated_at on public.subjects;
create trigger subjects_set_updated_at before update on public.subjects for each row execute procedure public.set_updated_at();
drop trigger if exists study_tasks_set_updated_at on public.study_tasks;
create trigger study_tasks_set_updated_at before update on public.study_tasks for each row execute procedure public.set_updated_at();
drop trigger if exists study_materials_set_updated_at on public.study_materials;
create trigger study_materials_set_updated_at before update on public.study_materials for each row execute procedure public.set_updated_at();
drop trigger if exists study_conversations_set_updated_at on public.study_conversations;
create trigger study_conversations_set_updated_at before update on public.study_conversations for each row execute procedure public.set_updated_at();
drop trigger if exists flashcard_decks_set_updated_at on public.flashcard_decks;
create trigger flashcard_decks_set_updated_at before update on public.flashcard_decks for each row execute procedure public.set_updated_at();
drop trigger if exists flashcards_set_updated_at on public.flashcards;
create trigger flashcards_set_updated_at before update on public.flashcards for each row execute procedure public.set_updated_at();
drop trigger if exists study_goals_set_updated_at on public.study_goals;
create trigger study_goals_set_updated_at before update on public.study_goals for each row execute procedure public.set_updated_at();

create or replace function public.match_study_material_chunks(query_embedding extensions.vector(1536),match_count integer default 8,filter_material_id uuid default null)
returns table(id bigint,material_id uuid,content text,page_number integer,similarity double precision)
language sql stable security invoker set search_path = '' as $$
 select c.id,c.material_id,c.content,c.page_number,1-(c.embedding OPERATOR(extensions.<=>) query_embedding)
 from public.study_material_chunks c where c.user_id=(select auth.uid()) and c.embedding is not null
 and(filter_material_id is null or c.material_id=filter_material_id)
 order by c.embedding OPERATOR(extensions.<=>) query_embedding limit greatest(1,least(match_count,30));
$$;
revoke all on function public.match_study_material_chunks(extensions.vector,integer,uuid) from public,anon;
grant execute on function public.match_study_material_chunks(extensions.vector,integer,uuid) to authenticated;
revoke all on function public.handle_new_user() from public,anon,authenticated;
revoke all on function public.set_updated_at() from public,anon,authenticated;
revoke all on function public.rls_auto_enable() from public,anon,authenticated;
grant usage on schema public to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('study-materials','study-materials',false,52428800,array['application/pdf','text/plain','text/csv','image/png','image/jpeg','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists study_materials_storage_select_own on storage.objects;
create policy study_materials_storage_select_own on storage.objects for select to authenticated using(bucket_id='study-materials' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists study_materials_storage_insert_own on storage.objects;
create policy study_materials_storage_insert_own on storage.objects for insert to authenticated with check(bucket_id='study-materials' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists study_materials_storage_update_own on storage.objects;
create policy study_materials_storage_update_own on storage.objects for update to authenticated using(bucket_id='study-materials' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='study-materials' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists study_materials_storage_delete_own on storage.objects;
create policy study_materials_storage_delete_own on storage.objects for delete to authenticated using(bucket_id='study-materials' and (storage.foldername(name))[1]=(select auth.uid())::text);
