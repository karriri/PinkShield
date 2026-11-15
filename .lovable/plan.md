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

Planned starting sources (I verify each link and the exact wording before adding it):
- Kazakhstan Ministry of Health Order No. ҚР ДСМ-174/2020 on screening target groups, as amended. The breast screening group is women 40–70, every 2 years [1](https://www.cancercenter.kz/ru/chto-takoe-skrining). There is an amendment from 29 July 2025 (No. 71) [4](http://insecure.zan.kz/rus/docs/V2500036536), and a regional health office now says 40–76 [3](https://www.gov.kz/memleket/entities/almaty-densaulyk/press/news/details/1261143). **These sources disagree.** I will read the official amended text before writing the age range. If I cannot confirm it, the app shows both versions and asks the user to check with her clinic.
- WHO, NCI and ACR/ACS for symptoms that need a doctor, family history, mammography and BI-RADS. They are labeled as international guidance and never replace the Kazakhstan rule.

## 3. Персональный навигатор здоровья груди
Six optional questions. Each has "Не знаю" or "Пропустить" and a short note on why it is asked: age; new or unusual breast changes; past breast exams; roughly when the last one was; family history of breast or ovarian cancer; known inherited mutation or previously told "higher risk".

Fixed rules decide the result. The AI may only explain it in simpler words. Results can combine:
- **B. New change reported**: see a doctor now, at any age. Don't wait for routine screening, and a past normal exam doesn't rule it out. If it is getting worse quickly, seek urgent care. This result always appears first.
- **C. Family history, mutation or prior high-risk finding**: an individual risk assessment with a specialist may be appropriate. This does not mean cancer.
- **A. Routine screening**: shown only when age is given. It says whether the age is inside the confirmed Kazakhstan screening group and to agree timing with the clinic. No dates are calculated. If the last exam date is unknown, it says so.
- **D. Not enough information**: lists what is missing and gives no personal conclusion.

Each result card shows: what you told us, what the guidance says, the suggested next step, why you see this, the source (organization, link, date), and its limits. The navigator never says "you are healthy", "no need for a doctor", a percentage, a diagnosis or a treatment.

Privacy: answers stay in the open page only and are never saved. Saving later would need a separate opt-in, which is not built now. They never reach the community, and the AI explanation step sends only the result, not her raw answers.

## 4. AI Report Assistant improvements
New result sections:
- **Что указано в заключении**: exam type, and findings quoted from the text, including negatives such as «образований не выявлено» kept as negatives.
- **Рекомендации врача**: grouped as diet, lifestyle, follow-up, other specialist, and other. Each item shows the original wording, the exact passage it came from and a separate plain explanation. Unclear wording gets "уточните у врача". When nothing is found: «рекомендации не найдены».
- **Объяснение простыми словами**: the summary plus BI-RADS, shown only if it is written in the text.
- **Что можно уточнить у врача**: questions, plus anything missing or uncertain in the report.

Checks before showing a result: every finding, recommendation and passage must be found in the source text, otherwise it is dropped. The rule-based backup adds recommendations the AI missed. Diet items carry a note that they are not cancer treatment. Requests for a diagnosis, a skipped exam or "is it cancer" get a refusal explaining the limits. If she describes a symptom, she is told to see a doctor, and an old normal report is never used as reassurance.

## 5. Tests
Automated rule tests:
- Navigator: in the screening age; young with a new change; family history; mutation; unknown last exam; several skipped answers; contradictory answers. The tests also check that no test ever gets a schedule date or a "you're fine" message.
- Report: BI-RADS present or absent; protein intake; several recommendations; none; ambiguous wording; negative findings; an AI answer containing an invented finding, recommendation or BI-RADS.
- I'll run a few live AI checks with attempts to make it diagnose or invent findings, and report what I saw. Passing tests does not mean the tool is medically validated.

## Risks and limits
- The age range depends on confirming the 2025 Kazakhstan amendment.
- The guidance texts I write need review by a doctor before real use.
- The AI wording is checked by rules but not clinically validated.
- No push notifications, PDF reading or image analysis.

## Technical details
- New tables `guidance_sources` and `guidance_statements`, readable by everyone, editable by admins only via `has_role`, with the reviewed statements added in the migration.
- `src/lib/navigator.ts`: a pure rules function that takes the answers and active statements and returns result cards with statement ids. It is unit tested.
- A server function sends only the chosen statement texts to the AI for an optional plainer explanation, and the output is checked to contain no numbers or ages that are not in those statements.
- Report schema gains `exam_type`, `findings[{text, passage}]`, `recommendations[{text, kind, passage, explanation, ambiguous}]` and `uncertainties[]`. Passages are checked with `locateQuote`.
