# PINK SHIELD — Breast Health Companion

Interactive Russian-language FemTech prototype: tracker, AI report assistant, community, knowledge base, profile.

## Design
- Palette: warm white/cream background, soft pink surfaces, muted burgundy accents, dark plum for headings and primary buttons.
- Fonts: Cormorant Garamond (headings) + Manrope (body).
- Rounded cards, soft shadows, thin borders, tasteful line icons (lucide), one generated hero illustration.
- Desktop sidebar; mobile top bar + bottom tab navigation.

## Pages (separate routes)
- `/` Главная — greeting, next appointment card, «Добавить обследование», AI quick card, community preview, health fact, recent activity.
- `/calendar` Мой календарь — add/edit/delete, type select, date/time, clinic/doctor, notes, mark completed; upcoming + history lists, month calendar view, empty state, reminder tip (no push claims), note that schedules are agreed with a doctor.
- `/assistant` AI-помощник — textarea, .txt upload, 3 demo reports, «Объяснить заключение»; structured result (summary, terms, BI-RADS, recommendations from report, questions for doctor); visible disclaimer; red-flag notice when lumps/discharge/skin changes are mentioned.
- `/community` Сообщество — feed with category filter, create post, comments, likes, report button, safety notice, “demo content” label, pseudonymous profiles.
- `/knowledge` База знаний — 7 topic articles in simple language with sources (WHO, NCI, ACR, American Cancer Society) and links; save to profile.
- `/profile` Профиль — pseudonym, language, upcoming/history, saved materials.

## AI
- Real explanation via Lovable AI Gateway with a strict safety prompt (no diagnosis, no probabilities, no treatment, only recommendations present in the text), returning structured JSON.
- Demo reports also run through the AI; if AI is unavailable, show prepared explanations clearly labeled «Демо-пример».
- Requires enabling Lovable Cloud (for the server-side AI key only; no accounts).

## Data
- Appointments, posts, comments, likes, profile, saved articles persisted in browser storage with seeded sample data marked as demo.

## Technical details
- TanStack routes per page, shared layout in __root; state via a small localStorage store hook (hydration-safe).
- createServerFn calling the gateway; zod-validated input; text length limit.
- Unit tests for red-flag detection and appointment upcoming/history split.
- Per-route head() metadata in Russian.
