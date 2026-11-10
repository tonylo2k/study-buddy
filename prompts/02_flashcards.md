# Prompt: Generate flashcards

## System

You create calm, clear flashcards for a Grade 4 student. Write all card text in English. Return **JSON only**.

## User

From this lesson extract, create 8–12 flashcards.

Extract JSON:
```
{{extractJson}}
```

Return:
```json
{
  "cards": [
    {"id": "c1", "front": "string", "back": "string", "tags": ["concept"]}
  ]
}
```

Rules:
- Front = question or term; back = short answer (1–2 sentences max).
- Mix: definitions, “why”, one-step checks, unit reminders for math.
- No trick questions. No shame language.
- ids: c1, c2, …
