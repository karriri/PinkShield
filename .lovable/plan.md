# PINK SHIELD — Breast Health Navigator and grounded AI Report Assistant

Continuation of the current app. Same six pages and design. Adds one guided Navigator inside the AI-помощник page and a sourced guidance library. No diagnosis, no risk scores, no image analysis.

## 0. Finish the work already in progress
The accounts, cloud calendar, reminders, shared community and moderation work is mostly written. One automated test file still uses the old appointment format and must be updated. Then I run the end-to-end checks promised in the previous plan, and assign the admin role once you tell me which email to use.

## 1. How the AI works today (checked in the code)
- Model: one call through Lovable AI Gateway, made on the server only. The key is never sent to the browser, and the service keeps no copy of the text.
- Flow: report text goes to the AI, which returns structured JSON (summary, terms, BI-RADS, recommendations, questions, personal concern). The server then drops any BI-RADS value or term that is not in the text.
- Why recommendations were missed: the instructions only asked for "doctor's recommendations", and the filter required exact wording. Both are already improved in code (all recommendation types, tolerant matching, plus a rule-based backup that picks out recommendation sentences directly from the text). This stage extends that.
- The demo reports use ready-made answers and never call the AI.

## 2. Verified guidance library (instead of full search over documents)
Full search over large documents is more complex than this MVP needs. A small, structured guidance library in the database is more reliable and easier to review:
- **Sources**: title, organization, link, publication or update date, date we reviewed it, country, who it applies to.
- **Guidance statements**: short approved texts, each linked to one source, with a topic (screening, symptoms, family history, inherited risk, methods, BI-RADS, preparing for a visit, myths), country, kind (screening or symptom check) and version. Only active statements are used.
- Everyone can read it. Only admins can edit it, so guidance can change without touching the AI.
- The AI only rephrases the statements it is given. It never makes up a schedule or an age range.

Starting sources:
- **Kazakhstan (primary, current):** Order No. ҚР ДСМ-174/2020 as amended on 29 July 2025 (No. 71). Women who turn 40, 42, 44 ... 76 are screened once every two years, in the matching even-numbered years. Official text: https://zan.gov.kz/api/documents/212907/rus/download/pdf, plus the Ministry guidance page https://www.gov.kz/situations/331/858?lang=ru. The library stores the source, the date I checked it, who it applies to (women 40–76, even ages) and the interval (every 2 years). The older 40–70 range is kept only as an archived version and is never shown as current.
- **International (WHO, NCI, ACR/ACS):** used for what changes need a doctor's check, family history, mammography and BI-RADS. They are labeled as international and never replace the Kazakhstan rule.
- Every result also explains that being in the screening age group is not the same as a personal medical recommendation.

## 3. Персональный навигатор здоровья груди
Seven optional questions. Each has "Не знаю" or "Пропустить" and a short note on why it is asked: age; new or unusual breast changes; past breast exams; roughly when the last one was; whether she is already under a doctor's follow-up (past breast cancer, an existing breast condition being followed, a past abnormal result, or a known high-risk finding); family history of breast or ovarian cancer; known inherited mutation or previously told "higher risk".

Fixed rules decide the result. The AI may only explain it in simpler words. Results can combine:
- **B. New or unusual change reported**: calm wording advising a professional medical check of this change, without waiting for the next routine screening, at any age. A past normal exam does not rule a new change out. No guesses about what the change is, and no urgency levels unless reviewed guidance supports them. This result always appears first.
- **E. Already under medical follow-up**: if she reports past breast cancer, a condition being followed, a past abnormal result or a known high-risk finding, she is not sent down the routine screening path. Her follow-up plan is set by her own doctor.
- **C. Family history, mutation or prior high-risk finding**: an individual risk assessment with a specialist may be appropriate. This does not mean cancer.
- **A. Routine screening**: shown only when age is given and E does not apply. It says whether the age is inside the confirmed Kazakhstan screening group and to agree timing with the clinic. No dates are calculated. If the last exam date is unknown, it says so.
- **D. Not enough information**: lists what is missing and gives no personal conclusion.

Each result card shows: what you told us, what the guidance says, the suggested next step, why you see this, the source (organization, link, date), and its limits. The navigator never says "you are healthy", "no need for a doctor", a percentage, a diagnosis or a treatment.

Privacy: answers stay in the open page only and are never saved. Saving later would need a separate opt-in, which is not built now. They never reach the community, and the AI explanation step sends only the result, not her raw answers.

## 4. AI Report Assistant improvements
New result sections:
- **Что указано в заключении**: exam type, and findings quoted from the text, including negatives such as «образований не выявлено» kept as negatives.
- **Рекомендации врача**: grouped as diet, lifestyle, follow-up, other specialist, and other. Each item shows the original wording, the exact passage it came from and a separate plain explanation. Unclear wording gets "уточните у врача". When nothing is found: «рекомендации не найдены».
- **Объяснение простыми словами**: the summary plus BI-RADS, shown only if it is written in the text.
- **Что можно уточнить у врача**: questions, plus anything missing or uncertain in the report.

Checks before showing a result: every finding, recommendation and passage must be found in the source text, otherwise it is dropped. The rule-based backup adds missed recommendations, but only explicit instructions; conditional or uncertain wording is labeled, and descriptions and negations are not counted. Diet items carry a note that they are not cancer treatment. Requests for a diagnosis, a skipped exam or "is it cancer" get a refusal explaining the limits. If she describes a symptom, she is told to see a doctor, and an old normal report is never used as reassurance.

## 5. Tests
Automated rule tests:
- Navigator: in the screening age; young with a new change; family history; mutation; unknown last exam; several skipped answers; contradictory answers. The tests also check that no test ever gets a schedule date or a "you're fine" message.
- Report: BI-RADS present or absent; protein intake; several recommendations; none; ambiguous wording; negative findings; an AI answer containing an invented finding, recommendation or BI-RADS.
- I'll run a few live AI checks with attempts to make it diagnose or invent findings, and report what I saw. Passing tests does not mean the tool is medically validated.

## Risks and limits
- Guidance must be re-checked whenever the Kazakhstan order changes; the "date checked" is shown to users.
- The guidance texts I write need review by a doctor before real use.
- The AI wording is checked by rules but not clinically validated.
- No push notifications, PDF reading or image analysis.

## Technical details
- New tables `guidance_sources` and `guidance_statements`, readable by everyone, editable by admins only via `has_role`, with the reviewed statements added in the migration.
- `src/lib/navigator.ts`: a pure rules function that takes the answers and active statements and returns result cards with statement ids. It is unit tested.
- A server function sends only the chosen statement texts to the AI for an optional plainer explanation. Checks before it is shown: every number, age, interval and instruction verb must also be in the approved statement; no new medical instructions; the meaning is kept (a second check pass by the model scores faithfulness, plus rule checks). If any check fails, the original approved statement is shown instead. The source line is always shown under the card, whatever the AI returns.
- Recommendations found by the rule-based backup are classed as: explicit instruction (shown as a doctor's recommendation), conditional ("при появлении…", "в случае…"), uncertain ("возможно", "может потребоваться", shown with "уточните у врача"), or a general description or negation (not shown as a recommendation). The full original sentence is kept as the passage.
- Tests cover false matches (for example "рекомендуемая доза облучения соблюдена" or "следует отметить, что…"), negations ("не рекомендовано", "образований не выявлено") and unclear wording.
- Admins can edit guidance sources and statements on the moderation page; each edit creates a new version.
- Report schema gains `exam_type`, `findings[{text, passage}]`, `recommendations[{text, kind, passage, explanation, ambiguous}]` and `uncertainties[]`. Passages are checked with `locateQuote`.
