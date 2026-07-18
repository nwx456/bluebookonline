-- Global privacy compliance: user region, consent audit trail, RLS hardening.

ALTER TABLE public.usertable
  ADD COLUMN IF NOT EXISTS country_code char(2),
  ADD COLUMN IF NOT EXISTS legal_region text NOT NULL DEFAULT 'ROW'
    CHECK (legal_region IN ('EU', 'TR', 'US', 'MENA', 'ROW')),
  ADD COLUMN IF NOT EXISTS age_confirmed_13_plus boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.pending_registrations
  ADD COLUMN IF NOT EXISTS country_code char(2),
  ADD COLUMN IF NOT EXISTS legal_region text DEFAULT 'ROW'
    CHECK (legal_region IN ('EU', 'TR', 'US', 'MENA', 'ROW')),
  ADD COLUMN IF NOT EXISTS age_confirmed_13_plus boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_encrypted text;

CREATE TABLE IF NOT EXISTS public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL REFERENCES public.usertable(email) ON DELETE CASCADE,
  consent_type text NOT NULL,
  legal_region text NOT NULL,
  policy_version text NOT NULL,
  granted boolean NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  ip_hash text,
  user_agent_hash text,
  context jsonb
);

CREATE INDEX IF NOT EXISTS idx_user_consents_email ON public.user_consents(user_email);
CREATE INDEX IF NOT EXISTS idx_user_consents_type ON public.user_consents(consent_type);
CREATE INDEX IF NOT EXISTS idx_user_consents_email_type ON public.user_consents(user_email, consent_type);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no_anon_authed_access" ON public.user_consents
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Lock down usertable and pending_registrations from public PostgREST access.
ALTER TABLE public.usertable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable insert for usertable" ON public.usertable;
DROP POLICY IF EXISTS "Enable select for usertable" ON public.usertable;
DROP POLICY IF EXISTS "Enable all for pending_registrations" ON public.pending_registrations;

CREATE POLICY "no_anon_authed_access" ON public.usertable
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "no_anon_authed_access" ON public.pending_registrations
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
