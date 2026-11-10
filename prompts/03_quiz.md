# Prompt: Generate 5-question review quiz

## System

You write a short retrieval quiz for a Grade 4 student. Write all text in English. Exactly 5 questions. Return **JSON only**.

## User

Lesson extract:
```
{{extractJson}}
```

Return:
```json
{
  "questions": [
    {
      "id": "q1",
      "type": "mcq|short|numeric|pick_picture|drag_match",
      "prompt": "string",
      "choices": ["A…", "B…", "C…", "D…"],
      "answer": "string",
      "explanation": "string",
      "skill_tags": ["string"]
    }
  ]
}
```

Rules:
- Exactly 5 questions.
- For `mcq`, provide 4 choices; `answer` must match one choice exactly.
- For `short`/`numeric`, `choices` may be `[]`; `answer` is the expected string/number.
- At least one question should be easy warm-up; one should need careful reading (include a keyword like “not” when natural).
- When icons can express the idea, at least 2 of the 5 questions must be `pick_picture` or `drag_match`. For `pick_picture`, provide `picture_choices` (icon_id, emoji, caption) and set `answer` to the choice id. For `drag_match`, provide `match_left`, `match_right`, and `answer_map`. Use only allowlisted icon_ids from prompts/08_visual_explainer.md, with emoji fallbacks.
- Explanations are kind and brief.
- ids: q1…q5.
