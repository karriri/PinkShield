<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## PINK SHIELD
- User data (appointments, notifications, community, profile) lives in Lovable Cloud behind accounts and RLS; report text, AI results and navigator answers are never persisted — keeps sensitive health text off servers and devices.
- Reminders are created/updated by database triggers on appointments using the profile timezone — no duplicates and no client-side scheduling.
- Admin rights come only from `user_roles` + `has_role` checked in RLS — never trust frontend checks.
- Navigator results come from pure rules in `src/lib/navigator.ts` over admin-editable, versioned guidance rows (`guidance_statements`/`guidance_sources`); AI may only rephrase a statement via `src/lib/navigator.functions.ts`, checked by `src/lib/guidance-check.ts` plus a model faithfulness check, falling back to the original — keeps guidance traceable.
- Recommendation extraction classifies each source sentence (explicit/conditional/uncertain vs negated/descriptive) in `report-safety.ts` — avoids false-positive "recommendations".
- AI report explanations go through `src/lib/report.functions.ts` (server function); its output is post-filtered by `src/lib/report-safety.ts` so BI-RADS, terms and recommendation quotes must appear in the source text — prevents invented findings.
- Demo reports use prepared explanations in `src/lib/demo-reports.ts` and never call the AI — deterministic demos.
