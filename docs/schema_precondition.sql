-- Add precondition_text to questions for CSA (Precondition + Javadoc below code).
-- Run in Supabase SQL editor if your questions table does not have this column yet.
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS precondition_text text NULL;
