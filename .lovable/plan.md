# PINK SHIELD — Breast Health Companion

Interactive Russian-language FemTech prototype: tracker, AI report assistant, community, knowledge base, profile.

## Design
- Palette: warm white/cream background, soft pink surfaces, muted burgundy accents, dark plum for headings and primary buttons.
- Fonts: Cormorant Garamond (headings) + Manrope (body).
- Rounded cards, soft shadows, thin borders, tasteful line icons (lucide), one generated hero illustration.
- Desktop sidebar; mobile top bar + bottom tab navigation.

## Pages (six routes)
- `/` Главная — greeting, next appointment card, «Добавить обследование», AI quick card, community preview, health fact, recent activity.
- `/calendar` Мой календарь — add/edit/delete, type select, date/time, clinic/doctor, notes, mark completed; upcoming + history, month calendar, empty state, in-app reminder tip (no push claims), note that schedules are agreed with a doctor.
- `/assistant` AI-помощник — textarea, .txt upload, 3 demo reports, «Объяснить заключение», structured result, visible disclaimer.
- `/community` Сообщество — category filter, create post, comments, likes, report button, safety notice, “демо-контент” label, pseudonymous profiles.
- `/knowledge` База знаний — 7 articles in simple language with source names and links (WHO, NCI, ACR, American Cancer Society); save to profile; general info vs. individual advice clearly separated.
- `/profile` Профиль — pseudonym, language, upcoming/history, saved materials.

## AI medical safety
- Explains only what is explicitly in the provided text. Never invents findings, BI-RADS categories or recommendations; no diagnosis, probabilities or treatment.
- Result sections, visually distinct:
  1. Кратко о заключении (plain-language explanation)
  2. Медицинские термины (only terms found in the text)
  3. BI-RADS — shown only if present in the text; otherwise «В тексте не указано»
  4. Рекомендации из заключения — quoted verbatim from the report, labeled «Из исходного текста»
  5. Что спросить у врача — labeled as suggestions, not medical advice
- Server-side check: BI-RADS value and quoted recommendations returned by the AI are verified against the input text; anything not found is dropped.

## Red-flag handling
- No keyword-only triggers. The AI returns a flag only when the user describes a new/current personal change (e.g. «я нащупала уплотнение»), not when terms appear in report descriptions or negations («уплотнений не выявлено»).
- Always-visible general notice: new or unusual breast changes should be discussed with a doctor.

## File support
- Pasted text and .txt files only. PDF/JPG/PNG not supported and not claimed (shown as «скоро»). PDF text extraction deferred.

## Privacy
- Fictional demo data only. Report text and AI results are never saved to browser storage — kept in memory for the session only.
- Before sending to AI, a consent checkbox: text is sent to an external AI service; remove names and personal data.
- Calendar notes hint not to enter sensitive details.

## Demo reports
- Three fictional examples (e.g. BI-RADS 1 ultrasound, BI-RADS 2 mammography with benign cyst, BI-RADS 3 with follow-up recommendation) with prepared deterministic explanations, labeled «Демо-пример». They do not call the AI.

## Data
- Appointments, posts, comments, likes, profile, saved articles in browser storage, seeded with demo data.

## Technical details
- Existing stack confirmed: TanStack Start v1 with server functions, so createServerFn is used for the AI call; key stays server-side via Lovable Cloud + AI Gateway (no user accounts).
- Structured JSON output, zod-validated input, length limit.
- Unit tests: BI-RADS/recommendation verification against source text, upcoming/history split.
- Per-route Russian head() metadata.
