# SAT PDF fixtures

Place your test PDFs here for `npm run eval:sat` and `npm run eval:sat:live`.

## Quick start

1. Copy your R&W practice PDF to `fixtures/sat/rw-practice.pdf`
2. Run mock eval (no Gemini, seconds):

```bash
npm run eval:sat -- --pdf ./fixtures/sat/rw-practice.pdf --subject SAT_RW --format single_module --module-counts '{"rw1":27}'
```

3. After unit tests pass and mock eval returns `"ok": true`, run live validation:

```bash
npm run eval:sat:live -- --pdf ./fixtures/sat/rw-practice.pdf --subject SAT_RW --format single_module --module-counts '{"rw1":27}'
```

## Formats

| Subject | Format | Adaptive | Example module-counts |
|---------|--------|----------|----------------------|
| `SAT_RW` | `single_module` | `none` | `{"rw1":27}` |
| `SAT_RW` | `section_test` | `none` | `{"rw1":27,"rw2":27}` |
| `SAT_RW` | `section_test` | `six_module` | `{"rw1":27,"rw2easy":14,"rw2hard":14}` |
| `SAT_MATH` | `single_module` | `none` | `{"math1":22}` |
| `SAT_FULL_TEST` | `full_test` | `none` | `{"rw1":27,"rw2":27,"math1":22,"math2":22}` |

PDF files in this folder are gitignored — they are not committed.
