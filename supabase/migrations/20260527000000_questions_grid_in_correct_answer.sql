-- Allow SAT grid-in numeric answers in questions.correct_answer (e.g. "3", "3/2", "-2").
-- MCQ rows still require A–E when question_type is mcq or null.

ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_correct_answer_check;

ALTER TABLE questions ADD CONSTRAINT questions_correct_answer_check
CHECK (
  correct_answer IS NULL
  OR (
    COALESCE(question_type, 'mcq') = 'grid_in'
    AND correct_answer ~ '^-?[\d./]+$'
  )
  OR (
    COALESCE(question_type, 'mcq') = 'mcq'
    AND correct_answer IN ('A', 'B', 'C', 'D', 'E')
  )
);
