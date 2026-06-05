-- SAT module resume + scoring columns on attempts (idempotent).

ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS current_module_index integer DEFAULT 0;

ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS module_progress jsonb NULL;

ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS rw_scaled_score integer NULL;

ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS math_scaled_score integer NULL;

ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS total_scaled_score integer NULL;
