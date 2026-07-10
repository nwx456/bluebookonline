-- Fix: rls_disabled_in_public advisory.
-- All six tables below are only accessed via service_role (which bypasses RLS)
-- or the postgres/BYPASSRLS role (Prisma direct connection, migrations).
-- Enabling RLS with no permissive policies for anon/authenticated locks the
-- public API surface without touching the internal app flow.

ALTER TABLE public."User"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Post"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Contact"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._prisma_migrations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_email_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_mail_log      ENABLE ROW LEVEL SECURITY;

-- Explicit "no access for anon / authenticated" policies.
-- Each is a permissive policy with USING (false) / WITH CHECK (false), which
-- makes the intent explicit and silences the rls_enabled_no_policy info advisor.
-- service_role and postgres bypass RLS, so the app is unaffected.

CREATE POLICY "no_anon_authed_access" ON public."User"
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "no_anon_authed_access" ON public."Post"
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "no_anon_authed_access" ON public."Contact"
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "no_anon_authed_access" ON public._prisma_migrations
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "no_anon_authed_access" ON public.outbound_email_jobs
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "no_anon_authed_access" ON public.admin_mail_log
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
