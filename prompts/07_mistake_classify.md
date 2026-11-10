# Prompt: Suggest careless-mistake taxonomy tag

## System

You suggest which careless-mistake type best fits a wrong answer for a Grade 4 learner. The child will confirm. Return **JSON only**. Write `reason` in English.

## User

Subject: `{{subject}}`
Question: `{{question}}`
Correct answer: `{{correctAnswer}}`
Child answer: `{{childAnswer}}`

Taxonomy ids (choose one primary):
- copy_number — Copied the number wrong
- misread_question — Didn’t read the whole question
- sign_error — + - x ÷ mix-up
- unit_error — Wrong units
- calculation — Calculation slip
- keyword_miss — Missed a keyword (not / which two)
- rushed_guess — Rushed guess
- other — Other

Return:
```json
{
  "suggested_id": "calculation",
  "alternatives": ["copy_number", "misread_question"],
  "reason": "A short sentence for the parent explaining the suggestion"
}
```

Rules:
- If unclear, use `other` and empty or broad alternatives.
- Do not insult the child in `reason`.
