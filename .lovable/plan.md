
# Meu Querido — Rotina & Padrão

A mobile-first internal web app for restaurant operational checklists, built on the existing TanStack Start template with Lovable Cloud (Supabase) for auth, database, and storage.

## Scope

Phase 1 MVP covering: auth + roles, sectors (Salão / Cozinha / Bar), checklist templates with items, daily execution flow with photo evidence, automatic non-conformity creation, action plans, a dashboard, and an "IA Operacional" page wired with mock responses (real API deferred).

## Information needed before building

1. **User profile fields** — beyond role and sector, do you want `full_name`, `phone`, `avatar_url`? Any others (e.g. shift, hire date)?
2. **First admin user** — should the first signup automatically become Admin, or do you want to seed a specific email as Admin via migration?
3. **Sign-in methods** — email/password only (default), or also Google OAuth?
4. **Sector assignment for users** — can a Líder de Setor / Operador belong to multiple sectors, or exactly one?
5. **Checklist scheduling** — daily recurring for Abertura/Fechamento. Should "today's checklists" be filtered by the user's sector, or show all sectors for Admin/Gerente?
6. **Critical item photos** — single photo per item, or multiple? Max count?
7. **Non-conformity severity levels** — confirm: Baixa / Média / Alta / Crítica?
8. **Language** — confirm UI is Portuguese (BR) throughout.

I'll proceed with sensible defaults if you don't answer, noted in each section.

## Visual direction

Mobile-first, clean operational tool aesthetic (not consumer-app playful). Single accent color for actions, large tap targets, bottom navigation on mobile. I'll set up a coherent design system in `src/styles.css` (semantic tokens) before building screens. If you want to explore visual directions first, say so and I'll generate options.

## Data model (Lovable Cloud / Postgres)

All tables in `public` with explicit GRANTs, RLS enabled, policies scoped via a `has_role()` SECURITY DEFINER function and sector membership.

- `app_role` enum: `admin | gerente | lider_setor | operador`
- `sector_kind` enum: `salao | cozinha | bar`
- `moment_kind` enum: `abertura | fechamento`
- `response_kind` enum: `conforme | nao_conforme | na`
- `severity_kind` enum: `baixa | media | alta | critica`
- `nc_status` enum: `aberta | em_tratamento | resolvida | cancelada`
- `action_status` enum: `pendente | em_andamento | concluida | atrasada`

Tables:
- `users_profile` — `id` (PK = auth.users.id), name, phone, avatar_url, primary_sector_id
- `user_roles` — separate table, `(user_id, role)` unique (per security rules)
- `sectors` — id, name, kind
- `user_sectors` — many-to-many user↔sector
- `checklists` — id, sector_id, moment, title, description, active
- `checklist_items` — id, checklist_id, order, question, is_critical, requires_photo, help_text
- `checklist_executions` — id, checklist_id, executed_by, sector_id, scheduled_date, status (`em_andamento|finalizada`), started_at, finished_at
- `checklist_item_responses` — id, execution_id, item_id, response, observation, photo_urls[]
- `non_conformities` — id, response_id, execution_id, item_id, severity, responsible_user_id, due_date, status, description, evidence_urls[]
- `action_plans` — id, non_conformity_id, what, why, who, when_due, how, status, completed_at

Storage bucket `checklist-evidence` (private) with RLS for uploads scoped to authenticated users and reads scoped to involved sector members + Admin/Gerente.

Trigger: when a `checklist_item_responses` row is inserted/updated with `response = 'nao_conforme'`, auto-insert a `non_conformities` row (status `aberta`, severity defaulting to item criticality, responsible = sector leader fallback to executor).

Trigger: auto-create `users_profile` row on `auth.users` insert.

## Routes (TanStack Start)

Public:
- `/auth` — sign in / sign up

Authenticated (`src/routes/_authenticated/`):
- `/` — home: today's checklists list (filtered by user's sector or all for Admin/Gerente)
- `/checklist/$executionId` — execution flow (item-by-item, save progress, finalize)
- `/dashboard` — KPIs: completion rate, open NCs, NCs by severity/sector
- `/nao-conformidades` — list + filters
- `/nao-conformidades/$id` — detail, create/link action plan
- `/planos-acao` — list of action plans
- `/ia` — IA Operacional (mock)
- `/admin/checklists` — Admin/Gerente only: manage templates and items
- `/admin/usuarios` — Admin only: manage users, roles, sector assignments

Bottom nav (mobile): Hoje · NCs · Dashboard · IA · Mais.

## Checklist execution flow

1. Home shows today's executions (auto-created on first open per sector+moment+date, or pre-seeded by a daily job — MVP: lazy create on tap).
2. Tap a checklist → step-through items with response buttons (Conforme / Não conforme / N/A), observation field, photo upload (required when `is_critical` and response is `nao_conforme`, or when `requires_photo`).
3. "Salvar progresso" persists responses; status stays `em_andamento`.
4. "Finalizar" requires all items answered + required photos present → sets `finalizada`, `finished_at`.
5. Any `nao_conforme` triggers NC creation (DB trigger) and surfaces a toast: "NC criada".

## IA Operacional (mock)

`/ia` page with four action cards: Gerar checklist, Revisar checklist, Sugerir plano de ação, Resumo diário. Each calls a `createServerFn` that currently returns a canned response after a short delay. A clear `// TODO: replace mock with Lovable AI Gateway call` comment marks the integration seam. No API key wiring or secrets requested in this phase.

## Technical notes

- Enable Lovable Cloud (creates the Supabase project, env vars, integration files).
- One migration per concern: enums+tables+grants+RLS, then triggers, then seed sectors (Salão/Cozinha/Bar) and one example checklist per sector/moment.
- Storage bucket created via `supabase--storage_create_bucket` (not SQL), with RLS policies on `storage.objects`.
- Server fns under `src/lib/*.functions.ts` using `requireSupabaseAuth`; admin operations (user role changes) use `supabaseAdmin` imported inside the handler.
- Role checks use `has_role(auth.uid(), 'admin'::app_role)` in RLS policies — never read role client-side for authorization.
- Mobile-first: Tailwind, large touch targets, sticky bottom action bars on execution flow.
- Existing files (`__root.tsx`, `router.tsx`, `index.tsx` placeholder) will be modified minimally: index becomes a redirect to `/` authenticated home, root keeps its current shell. No unrelated code touched.

## Build order

1. Enable Lovable Cloud + configure email auth (and Google if requested).
2. Migration: enums, tables, grants, RLS, `has_role`, triggers, seed data.
3. Storage bucket + policies.
4. Auth page + `_authenticated` layout (integration-managed).
5. Profile/role bootstrap + bottom nav shell.
6. Home (today's checklists) + execution flow + photo upload.
7. NC list/detail + action plans.
8. Dashboard.
9. Admin pages (checklists, users).
10. IA Operacional with mocks.
11. Seed example data and smoke-test the full flow.

Please answer the questions above (or say "use defaults") and I'll move to build.
