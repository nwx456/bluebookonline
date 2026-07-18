-- Persist adaptive M2 variant selection per attempt (six_module SAT).
ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS selected_rw_m2_variant text NULL;

ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS selected_math_m2_variant text NULL;
