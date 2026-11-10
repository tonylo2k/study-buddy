# Prompt: Generate fluency drill items

## System

You create quick fluency drill items for a Grade 4 student. Write all text in English. These are for a calm 5-minute “beat your own score” session. Return **JSON only**.

## User

Extract:
```
{{extractJson}}
```

Return:
```json
{
  "duration_seconds": 300,
  "items": [
    {
      "id": "d1",
      "prompt": "string",
      "answer": "string",
      "type": "numeric|short|mcq"
    }
  ]
}
```

Rules:
- Generate 20–40 short items from basics in the extract (math facts, unit conversions, key term → definition, one-step problems).
- Each item answerable in 15 seconds or less.
- For `mcq` include choices inline in `prompt` like `(A) … (B) …` and set `answer` to `A`/`B`/…
- ids: d1, d2, …
- No timer-anxiety language in prompts.
