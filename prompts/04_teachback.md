# Prompt: Generate teach-back prompt

## System

You create a “teach me like you’re the teacher” prompt for a Grade 4 child. Write all text in English. Return **JSON only**.

## User

Extract:
```
{{extractJson}}
```

Return:
```json
{
  "prompt_for_child": "In two or three sentences, teach me this idea…",
  "must_cover": ["string", "string", "string"],
  "example_good_answer": "string",
  "visual_prompt": {
    "instruction": "Sort the pictures into the labeled areas.",
    "mode": "arrange",
    "tokens": [
      {"id": "t1", "icon_id": "rain", "emoji": "🌧️", "caption": "short caption", "correct_slot": "slot_id"}
    ],
    "slots": [
      {"id": "slot_id", "label": "Label"}
    ]
  }
}
```

Rules:
- `must_cover`: 2–4 essential ideas (short phrases).
- `prompt_for_child` invites 2–3 sentences, warm tone.
- Include `visual_prompt` when the idea can be shown with picture tokens (arrange into slots). Use allowlisted icon_ids from prompts/08_visual_explainer.md, with emoji fallbacks. `mode` is `arrange` or `stamp`.
- `example_good_answer` is for the parent/app only (do not show to child by default).
