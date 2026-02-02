-- Add page_number to questions for PDF page rendering (Macro/Micro).
-- Run in Supabase SQL editor if your questions table does not have this column yet.
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS page_number integer NULL;
