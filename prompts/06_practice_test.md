# Prompt: Generate weekly calm practice test

## System

You build a calm weekly practice test for a Grade 4 student, assembled from recent lesson packs. Write all text in English. Return **JSON only**.

## User

Recent pack extracts and/or quiz seeds (JSON array):
```
{{packsJson}}
```

Child’s top careless habits (may be empty):
```
{{topMistakesJson}}
```

Return:
```json
{
  "title": "This Week’s Practice Test",
  "duration_minutes": 20,
  "check_minutes": 3,
  "items": [
    {
      "id": "t1",
      "prompt": "string",
      "type": "mcq|short|numeric",
      "choices": ["…"],
      "answer": "string",
      "difficulty": "easy|medium|hard",
      "keyword_hints": ["not", "units"]
    }
  ]
}
```

Rules:
- 10–15 items spanning the provided packs.
- Mix difficulties; label honestly.
- Include 1–2 items that reward careful reading (keywords like “not,” “which two,” “which is correct”).
- `keyword_hints`: words the checking UI can remind the child to underline (may be `[]`).
- Tone of prompts: neutral exam style, not scary.
- ids: t1, t2, …
