-- Store strengths and improvements from FRQ AI grading for review UI.

ALTER TABLE public.frq_responses
  ADD COLUMN IF NOT EXISTS strengths jsonb,
  ADD COLUMN IF NOT EXISTS improvements jsonb;
