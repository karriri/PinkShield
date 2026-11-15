# PINK SHIELD — Accounts, Cloud data, Reminders, Real Community, Moderation

Same six pages, same design. Adds sign-in, cloud storage, a notification center, community rules and an admin moderation page.

## What is wrong today (found in the code)
- All planner, community, profile and saved data lives in one browser's local storage. Clearing the browser, another device or private mode loses it.
- There is no notion of a user, so the community cannot be shared — every visitor only sees their own copy of the demo posts.
- Appointments have only "completed: yes/no". Past unfinished appointments are lumped into history with completed ones; there is no "missed" or "cancelled", and nothing records reminders.
- AI recommendations: the instructions ask only for "doctor's recommendations", so the AI skips diet/lifestyle advice (e.g. protein intake). The safety filter then demands an exact text match, so a quote with slightly different punctuation, line breaks or hyphenation is silently thrown away.

## 1. Accounts
- Sign-in page with email + password and Google. Email confirmation stays on.
- Only a pseudonym is asked for at sign-up (no real name, age or phone).
- All six pages stay viewable when signed out with demo content; saving, posting and the calendar ask to sign in.

## 2. Data model
```text
profiles            (own row)       pseudonym, language, timezone
user_roles          (protected)     admin role
appointments        (owner only)    type, date/time, place, notes, status, remind_day_before, remind_same_day
notifications       (owner only)    appointment, kind (day_before|same_day), due_at, read_at, dismissed_at  — unique per appointment+kind
saved_articles      (owner only)    article id
posts               (signed-in read) author, category, text, edited_at, removed_at
comments            (signed-in read) post, parent comment (replies), author, text, removed_at
post_likes          (signed-in read) post, user — unique
blocks              (blocker only)  blocker, blocked
content_reports     (reporter insert, admin read) target post/comment, reason, note, status
moderation_actions  (admin only)    action, target, report, admin, note
account_restrictions(admin write)   user, kind (suspended|muted), until
```
- Public author info is only the pseudonym (via a safe view); emails, timezones and private data never leave the owner's rows.
- Report text and AI answers are not stored anywhere.

## 3. Security rules
- Every table has row-level access rules; private tables are readable and writable only by their owner.
- Admin is a separate role table checked by a database function — never a flag in the profile or the browser. Moderation functions check it on the server too.
- Suspended/muted accounts cannot post or comment (enforced in the database).
- Blocks: the blocker never sees the blocked person's posts/comments; the blocked person cannot reply to or comment on the blocker's posts. Nobody can see who blocked or reported them.
- The first admin is assigned to your account by me directly after you sign up (tell me which email).

## 4. Appointments and reminders
- Statuses: upcoming, completed, missed (shown automatically when the date passed and it wasn't marked), cancelled. Tabs for each; nothing is ever auto-deleted. Only the user can delete.
- Edit any details and change status manually; original creation date kept.
- Two reminder choices per appointment: one day before (09:00 her local time) and on the day.
- Reminders are created by the database when an appointment is saved or edited, computed from her timezone; one per appointment+kind, so no duplicates. Editing the date reschedules unread ones; dismissed/read ones are never recreated. Cancelling or completing removes pending ones.
- A bell in the header (notification center) and a dashboard card show reminders that are due, with "mark as read" / "dismiss".
- Push notifications: not in this stage. They need permission prompts, a background service, and work poorly on iPhone unless installed to home screen. The app will keep saying only in-app reminders exist.

## 5. Community
- Shared feed from the database, with categories, pseudonyms, create/edit/delete own posts, comments with one level of replies, like/unlike, "My posts" tab in the profile.
- Demo posts become real rows by a "PINK SHIELD demo" author, still labeled «демо».
- Rules page section (no bullying, threats, others' medical data, guaranteed advice, misinformation; be respectful; not a substitute for a doctor). Shown before first post with an "I agree" checkbox.

## 6. Reporting, blocking, moderation
- Report button on posts and comments: reason list (bullying, insults, threats, spam/ads, medical misinformation, harmful content, other) + optional note.
- Block / unblock from a post menu; blocked list in Profile settings.
- New admin page `/moderation` (hidden from non-admins, protected on server): open reports, see content and reason, remove content, suspend/mute account, resolve or dismiss, history log of all actions.

## 7. AI recommendations fix
- Instructions widened: capture every explicit recommendation — follow-up, extra consultations, diet (e.g. protein), lifestyle, other — each tagged with a type, quoted as written.
- Matching made tolerant of punctuation, quotes, line breaks and hyphenation, and accepts a quote if it is a contiguous piece of one source sentence. Still rejects anything not in the text.
- Shows «В тексте заключения рекомендации не найдены» when empty. Dietary items get a note that general nutrition advice is not cancer treatment.

## 8. Existing browser data
- On first sign-in, if the browser has appointments, own posts/comments or saved articles, a one-time card offers «Перенести в аккаунт». Demo items are skipped. After transfer the local copy is cleared. Nothing is moved without the click.

## 9. Stages and testing
1. Accounts + database + rules  2. Appointments & reminders  3. Community  4. Reports, blocks, moderation  5. AI fix  6. Security scan.
Tests: automated rule tests (status split, reminder times across timezones, no duplicate reminders, quote matching incl. protein example, no invented recommendation). Browser checks with two test accounts: persistence after refresh and new session, edit/complete/cancel/delete, post seen by second account, comments/replies/likes/edit, report, block/unblock, normal user denied `/moderation`, admin reviews report. I will report anything I could not check.

## Risks and limits
- Reminders appear when she opens the app (no push, no email in this stage).
- Moderation is manual; no automatic offensive-text filter.
- No claims of medical-grade security or regulatory compliance.
- Demo/sample content and article texts still need review by you and a doctor.
