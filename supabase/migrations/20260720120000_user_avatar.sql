-- User profile avatar storage path and private avatars bucket.

ALTER TABLE public.usertable
  ADD COLUMN IF NOT EXISTS avatar_storage_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO NOTHING;
