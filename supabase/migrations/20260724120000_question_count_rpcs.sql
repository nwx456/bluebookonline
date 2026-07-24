-- Fast grouped question counts for published exams and library views.
-- Replaces paginated row scans in countQuestionsByUploadIds.

CREATE INDEX IF NOT EXISTS idx_questions_upload_id ON public.questions (upload_id);

CREATE OR REPLACE FUNCTION public.question_counts_by_upload(ids uuid[])
RETURNS TABLE (upload_id uuid, cnt bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.upload_id, count(*)::bigint AS cnt
  FROM public.questions q
  WHERE q.upload_id = ANY(ids)
  GROUP BY q.upload_id;
$$;

CREATE OR REPLACE FUNCTION public.frq_question_counts_by_upload(ids uuid[])
RETURNS TABLE (frq_upload_id uuid, cnt bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fq.frq_upload_id, count(*)::bigint AS cnt
  FROM public.frq_questions fq
  WHERE fq.frq_upload_id = ANY(ids)
  GROUP BY fq.frq_upload_id;
$$;

GRANT EXECUTE ON FUNCTION public.question_counts_by_upload(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.frq_question_counts_by_upload(uuid[]) TO service_role;
