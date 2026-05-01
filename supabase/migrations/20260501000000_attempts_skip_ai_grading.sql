-- Run in Supabase SQL editor if migrations are not applied automatically.
alter table attempts add column if not exists skip_ai_grading boolean not null default false;
