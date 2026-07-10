-- Legacy Prisma-era policy allowed anon INSERT into Contact (WITH CHECK true).
-- Contact is unused by the app; drop the policy so no_anon_authed_access fully applies.
DROP POLICY IF EXISTS "insert" ON public."Contact";

-- Remove smoke-test row inserted while verifying RLS behavior.
DELETE FROM public."Contact" WHERE email = 'x@x.com' AND name = 'x' AND message = 'x';
