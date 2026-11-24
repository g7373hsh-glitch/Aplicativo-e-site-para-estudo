-- Index foreign keys to avoid sequential scans on joins/deletes.
create index if not exists flashcard_decks_user_idx on public.flashcard_decks(user_id);
create index if not exists flashcard_decks_subject_idx on public.flashcard_decks(subject_id);
create index if not exists flashcards_deck_fk_idx on public.flashcards(deck_id);
create index if not exists quiz_answers_question_fk_idx on public.quiz_answers(question_id);
create index if not exists quiz_answers_user_fk_idx on public.quiz_answers(user_id);
create index if not exists quiz_attempts_quiz_fk_idx on public.quiz_attempts(quiz_id);
create index if not exists quiz_questions_user_fk_idx on public.quiz_questions(user_id);
create index if not exists quizzes_subject_fk_idx on public.quizzes(subject_id);
create index if not exists quizzes_user_fk_idx on public.quizzes(user_id);
create index if not exists study_conversations_user_fk_idx on public.study_conversations(user_id);
create index if not exists study_goals_user_fk_idx on public.study_goals(user_id);
create index if not exists study_chunks_user_fk_idx on public.study_material_chunks(user_id);
create index if not exists study_materials_subject_fk_idx on public.study_materials(subject_id);
create index if not exists study_messages_user_fk_idx on public.study_messages(user_id);
create index if not exists study_sessions_subject_fk_idx on public.study_sessions(subject_id);
create index if not exists study_tasks_subject_fk_idx on public.study_tasks(subject_id);
