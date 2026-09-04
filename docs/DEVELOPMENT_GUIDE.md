# Qubere Development Guide for Junior Engineers

This guide answers two questions before you edit code:

1. **Which file owns the behavior I need to change?**
2. **What must I update and verify so the change is safe?**

Use this as the starting point for implementation work. The root `README.md`
contains product and integration details; `docs/README.md` indexes feature and
architecture references; `DEVELOPMENT_WORKFLOW.md` adds database and Git advice.

> Never paste passwords, API keys, database URLs, customer data, or the contents
> of `.env` into source code, commits, screenshots, tickets, or chat. Only variable
> names and safe examples belong in documentation.

## 1. Mental model of the repository

This is an **npm-workspaces monorepo** orchestrated by Turborepo. It has three
Next.js 16 applications and shared TypeScript packages:

```text
app-frontend/
|-- apps/
|   |-- custom/      Customs and trade-compliance product (port 3000)
|   |-- tms/         Transportation Management System (port 3001)
|   `-- portal/      Customer/partner self-service portal (port 3002)
|-- packages/
|   |-- db/          Prisma client, schema, migrations, and shared DB services
|   |-- auth/        Shared authentication, authorization, and route guards
|   |-- billing/     Rating, costing, invoicing, and billing logic
|   |-- storage/     Object-storage abstraction
|   |-- assistant/   Shared assistant/tool primitives
|   |-- decisions/   Decision and audit types
|   |-- entry-proof/ Entry-proof assembly and shipment answers
|   |-- shipment-legs/ Shipment-leg inference
|   |-- tracking/    Tracking provider mapping and registry
|   |-- tracking-platform/ Tracking connections and webhook ingestion
|   `-- cloud-runtime/ Cloud runtime helpers
|-- schemas/         Versioned external JSON schemas; not Prisma tables
|-- docs/            Product, architecture, data, operations, and sales docs
|-- infrastructure/  Deployment and scheduled-job configuration
|-- package.json     Root workspace commands
`-- turbo.json       Task dependencies and cache rules
```

The usual request flow is:

```text
Browser
  -> app page or Client Component
  -> app/api/**/route.ts
  -> app-local domain service in src/modules or shared package
  -> @qubere/db / Prisma
  -> PostgreSQL
```

Some Server Component pages query the database directly. That is normal here;
do not add a browser-style API call just to move data between code that already
runs on the server.

## 2. First-day setup

### Prerequisites

- Node.js 20.9 or newer
- npm 10.x (the repository declares `npm@10.9.3`)
- Access to a development PostgreSQL/Supabase database
- Development Clerk credentials
- Git and an editor with TypeScript support

From the repository root:

```powershell
npm install
Copy-Item .env.example .env
npm --workspace @qubere/db run db:generate
```

Ask a project owner for secret values through the approved secret-sharing
channel. The minimum core setup generally needs Clerk keys, `DATABASE_URL`, and
`DIRECT_URL`; optional integrations need their own variables. The root README's
Environment Setup section is the source of truth for what each variable gates.

Do not commit `.env`. It is ignored by Git. Variables beginning with
`NEXT_PUBLIC_` can be included in browser bundles; all other secrets must remain
in server-only code.

Start one app while working on it:

```powershell
npm run dev --workspace=@qubere/custom
npm run dev --workspace=@qubere/tms
npm run dev --workspace=@qubere/portal
```

Run `npm run dev` only when you need all three apps. Stop a dev server with
`Ctrl+C` in its terminal.

## 3. How URLs map to files

All three apps use the Next.js **App Router** under `src/app`.

| File pattern | Meaning | Example |
| --- | --- | --- |
| `src/app/page.tsx` | Page at `/` | `apps/tms/src/app/page.tsx` |
| `src/app/orders/page.tsx` | Page at `/orders` | TMS orders |
| `src/app/app/shipments/page.tsx` | Page at `/app/shipments` | Customs shipments |
| `src/app/shipments/[id]/page.tsx` | Dynamic page | `/shipments/abc123` |
| `src/app/(portal)/shipments/page.tsx` | Route group; parentheses are omitted from URL | Portal `/shipments` |
| `src/app/api/shipments/route.ts` | API endpoint | `/api/shipments` |
| `src/app/api/shipments/[id]/route.ts` | Dynamic API endpoint | `/api/shipments/abc123` |
| `src/app/layout.tsx` | Shared wrapper for descendant pages | Providers, shell, navigation |
| `src/app/loading.tsx` | Loading state | Shown while a route streams |
| `src/app/error.tsx` | Route error boundary | Must be a Client Component |

Important Next.js 16 rules used by this repository:

- Pages and layouts are Server Components unless the file starts with
  `'use client'`.
- Add `'use client'` only when the component needs state, effects, event
  handlers, browser APIs, or a client-only library.
- Pass serializable values from Server Components to Client Components. Convert
  values such as dates or decimals when necessary.
- Dynamic `params` and `searchParams` are promises in current Next.js APIs;
  inspect a nearby route for the correct pattern and `await` them.
- API Route Handlers export HTTP functions such as `GET`, `POST`, `PATCH`, or
  `DELETE` and use Web `Request`/`Response` or `NextRequest`/`NextResponse`.
- Route Handlers are not cached by default. Do not add caching until you
  understand tenant scope and freshness requirements.
- `middleware.ts` is used by Customs and Portal. TMS uses the newer `proxy.ts`
  convention. Follow the convention already present in the app you edit.

The installed framework documentation is authoritative for this exact Next.js
version. Before changing routing, data fetching, caching, middleware/proxy, or
Server/Client boundaries, read the relevant file under:

```text
node_modules/next/dist/docs/01-app/
```

Start with `01-getting-started/02-project-structure.md`,
`05-server-and-client-components.md`, or `15-route-handlers.md`.

## 4. File-finding decision tree

Start with the visible symptom or requested behavior:

### “Change a screen”

1. Identify the product and URL.
2. Convert the URL into an App Router path using the table above.
3. Open its `page.tsx`.
4. Follow imports to a colocated `*Client.tsx` or `src/components/**` file.
5. Search visible text or component names if the owner is unclear.

Examples:

```powershell
rg -n "Create shipment" apps/custom/src
rg -n "ShipmentList" apps/portal/src
rg --files apps/tms/src/app | rg "shipments.*page\.tsx"
```

Develop in:

- the page when changing server-side loading, access decisions, or composition;
- a colocated Client Component when behavior is specific to one page;
- `src/components/` when the UI is reused by multiple pages in the same app;
- an existing `components/ui/` primitive when changing a shared control.

Do not put database calls in a Client Component.

### “Change data returned to the browser”

1. Open browser developer tools and find the request URL and HTTP method.
2. Map `/api/x/y` to `src/app/api/x/y/route.ts` in the same app.
3. Inspect the route's imports to find the actual domain service.
4. Update input validation, authorization, service logic, and response contract as
   one change.
5. Find callers before changing a response field.

```powershell
rg -n 'fetch\("?/api/shipments|fetch\(`/api/shipments' apps
rg -n "export (const|async function) (GET|POST|PUT|PATCH|DELETE)" apps/custom/src/app/api/shipments
```

Thin Route Handlers are preferred: parse and validate the HTTP request, call a
domain service, then translate the result to an HTTP response. Reusable business
rules belong in `src/modules/<domain>/` or a shared package.

### “Change a business rule”

Look first in the relevant app's `src/modules/<domain>/` directory. Examples:

- Customs: `filing`, `shipments`, `screening`, `documents`, `onboarding`,
  `compliance`, `billing`, `party`, `product`, `inbound`.
- TMS: `orders`, `shipments`, `movement`, `rating`, `tenders`, `invoices`,
  `carriers`, `tracking`, `agents`.

Search by exported function, error message, database model, or API route import:

```powershell
rg -n "functionName|Exact error text|ModelName" apps packages
rg -n "from .+modules/.+" apps/custom/src/app/api
```

If the logic is genuinely used by more than one application, place it in the
matching `packages/*` workspace and export it through that package's `src/index.ts`
or declared package export. Do not move app-specific code to a shared package in
anticipation of reuse that does not exist.

### “Change database fields or relationships”

The canonical database model is:

```text
packages/db/prisma/schema.prisma
```

The matching migration belongs in:

```text
packages/db/prisma/migrations/<timestamp>_<descriptive_name>/migration.sql
```

Before editing, search all reads, writes, types, tests, seeds, and serialized API
responses that use the model or field:

```powershell
rg -n "fieldName|ModelName" apps packages
```

Use a migration for permanent schema changes:

```powershell
npm --workspace @qubere/db run db:migrate:dev -- --name describe_the_change
npm --workspace @qubere/db run db:generate
npm --workspace @qubere/db run db:check-migration-timestamps
```

Review the generated SQL. Commit both `schema.prisma` and the migration folder.
Never use `prisma db pull` to resolve a merge conflict: it overwrites the schema
from the database. Do not use `db push` as a substitute for a committed migration.
Never use reset or `--force-reset` against a database unless a project owner has
confirmed that the exact database is disposable.

### “Change authentication, roles, or permissions”

Start in:

- `packages/auth/src/` for behavior shared between applications;
- `apps/custom/src/lib/api/auth-guards.ts` for Customs route integration;
- each app's `middleware.ts` or `proxy.ts` for request-level route protection;
- the closest existing route with the same permission requirements.

Protected Customs routes commonly use `withAuthenticatedRoute`. Preserve its
permission and `write: true` options. Public and cron routes must use their
purpose-built wrappers. UI hiding is not authorization; the server must enforce
the permission too.

### “Change uploads, background jobs, or integrations”

- App worker entry points: `apps/*/src/worker/`
- Event/background orchestration: app `src/inngest/` or `src/lib/inngest/`
- Storage implementation: `packages/storage/`
- Tracking adapters: `packages/tracking/` and `packages/tracking-platform/`
- App integration code: the closest `src/modules/` or `src/lib/integrations/`
- Deployment/scheduler config: `infrastructure/gcp/`

An upload change usually affects validation, storage, provenance/database state,
malware handling, API responses, and tests. Trace the whole lifecycle before
editing only the visible upload component.

### “Change a script, seed, or reference schema”

- App-specific one-off scripts: `apps/<app>/scripts/`
- Database seeds: `packages/db/prisma/seeds/` and `packages/db/prisma/seed.ts`
- Versioned customs message JSON Schema: `schemas/customs-filing/`
- Prisma database schema: `packages/db/prisma/schema.prisma`

JSON Schemas and Prisma schemas solve different problems. Do not edit one while
intending to change the other.

## 5. Which application owns the feature?

| User or workflow | Primary location |
| --- | --- |
| Broker/customs operator, filing, classification, compliance | `apps/custom` |
| Freight planner, carrier, quote, tender, movement, freight invoice | `apps/tms` |
| Customer/partner viewing shipments, entries, proofs, requests | `apps/portal` |
| Behavior used in two or more apps | Matching `packages/*` workspace |
| Tables, relationships, migrations, shared DB services | `packages/db` |
| Deployment or scheduled cloud execution | `infrastructure/` |
| Product/reference documentation | `docs/apps/<product>/` |

Some concepts, especially Shipment and Document, appear in all three apps. Do
not assume similarly named screens have the same owner. Start at the app serving
the reported URL, then follow imports.

## 6. Coding rules that prevent common incidents

### Tenant isolation is mandatory

Most business records belong to an account. Every query and write must be scoped
through the authenticated account context and/or the repository's context
wrappers. Typical direct filters include `accountId: ctx.accountId`.

Before finishing a database change, ask:

- Can a user supply an ID belonging to another account?
- Does the lookup verify both the record ID and `accountId`?
- Does a nested create write `accountId` where the schema requires it?
- Is a background job deliberately scoped, or is a cross-tenant operation
  explicitly justified and audited?
- Is there an existing tenant-isolation test that should be extended?

Never accept `accountId` from a browser body as authority for the active tenant.
Derive it from authenticated server context.

### Validate at the boundary

Route Handlers should validate body, query, and path inputs. The repository uses
Zod widely. Prefer `safeParse`, return a clear 4xx error, and do not pass an
unchecked request body into Prisma or a service.

### Keep server-only concerns on the server

Database clients, secrets, Node-only libraries, Clerk server APIs, and storage
credentials must not enter a Client Component dependency graph. Watch for
`'use client'` at the top of a file. Prefer narrow imports; `packages/db/src/index.ts`
even documents a server-only storage service that must be imported from its
dedicated package export rather than the barrel.

### Preserve auditability and idempotency

For state-changing operations, copy the nearest comparable route's audit logging,
permission guard, write-access check, and idempotency pattern. Customs and billing
operations can be regulated workflows; a successful database update alone may
not be a complete implementation.

### Keep dependencies pointing inward

```text
page/component -> API or service -> domain logic -> shared package -> database
```

Avoid importing a page or Route Handler into domain code. Avoid copying shared
logic between apps. Avoid a broad barrel export when it would pull Node-only code
into a browser bundle.

## 7. Step-by-step feature workflow

### Step 1: Translate the ticket into behavior

Write down:

- actor and product;
- starting URL;
- action performed;
- expected visible result;
- expected database or side effect;
- roles allowed and denied;
- empty, loading, error, and retry behavior.

If these are unclear, inspect existing behavior and ask targeted questions before
making a risky product assumption.

### Step 2: Find the smallest existing vertical slice

Locate the page, its client component, its API call, its Route Handler, service,
Prisma model, and nearest test. Read all of them before editing. Use Git history
only to understand intent, never to overwrite current uncommitted work.

```powershell
git status --short
git log --oneline --all -- apps/custom/src/modules/<domain>
git blame apps/custom/src/modules/<domain>/<file>.ts
```

The worktree may contain another developer's changes. Do not reformat, delete,
reset, or “clean up” unrelated files.

### Step 3: Choose the change locations

A normal vertical feature can include:

1. Prisma schema plus migration, if persistence changes.
2. Domain service or shared package logic.
3. Route Handler validation, authentication, and response mapping.
4. Server page data loading and/or Client Component interaction.
5. Unit/integration test near the existing domain tests.
6. Documentation when behavior or operations change.

Not every feature needs every layer. Avoid empty abstraction files.

### Step 4: Implement from the domain outward

Start with data invariants and business behavior, then expose the API, then wire
the UI. Reuse nearby patterns for naming, errors, response shapes, styling,
authorization, and test setup.

### Step 5: Test the smallest scope first

```powershell
# One workspace
npm run typecheck --workspace=@qubere/custom
npm run lint --workspace=@qubere/custom
npm run test --workspace=@qubere/custom

# One Vitest file
npm exec --workspace=@qubere/custom vitest run tests/<name>.test.ts

# Portal or TMS: replace the workspace name
npm run test --workspace=@qubere/portal
npm run test --workspace=@qubere/tms
```

For a shared package:

```powershell
npm run typecheck --workspace=@qubere/auth
npm run test --workspace=@qubere/auth
```

Then verify the affected app manually: allowed role, denied role, happy path,
invalid input, empty state, refresh, and server error.

### Step 6: Run broader checks before handoff

```powershell
npm run lint
npm run typecheck:workspaces
npm run test
npm run build
git diff --check
git status --short
git diff --stat
```

The full suite can be expensive. At minimum, run targeted tests and typecheck for
the changed workspace, then clearly report any broader check you did not run.

### Step 7: Review the diff as a reviewer would

Confirm that:

- only intended files changed;
- no secret or customer data is present;
- no debug log, temporary script, or commented-out implementation remains;
- new writes are tenant-scoped, authorized, validated, and audited;
- schema changes include reviewed migrations;
- API response changes have all callers updated;
- tests prove the new behavior and an important failure/denial case;
- docs and operational config are updated when needed.

Stage specific files rather than blindly staging the whole repository.

## 8. Testing map

| Scope | Location | Tool |
| --- | --- | --- |
| Customs unit/integration | `apps/custom/tests/` | Vitest |
| Customs browser E2E | `apps/custom/e2e/` | Playwright |
| TMS unit/integration | `apps/tms/tests/` | Vitest |
| Portal unit/integration | `apps/portal/tests/` | Vitest |
| Shared package tests | Beside package source as `*.test.ts` | Vitest |

Test observable behavior. For a Route Handler, cover validation, authorization,
tenant isolation, status code, response shape, and important side effects. For a
UI component, cover what the user sees and can do rather than internal state.

Useful test-name searches:

```powershell
rg -n "shipments|tenant|permission|upload" apps/*/tests packages -g "*.test.ts" -g "*.test.tsx"
```

## 9. Debugging cookbook

### “I cannot find the file”

Search in this order:

1. Exact text visible in the UI.
2. URL segment beneath the correct app's `src/app`.
3. API URL from the browser Network panel.
4. Function or component name from imports.
5. Prisma model/field name.
6. Related tests and documentation.

```powershell
rg -n -i "visible words" apps docs
rg --files apps packages | rg -i "shipment|filing|invoice"
```

### “The page shows no data”

Check authentication/account context, active data mode, tenant filters, product
workspace/entitlement filters, database configuration, seed state, and the
request's status/response. An empty collection is not automatically a UI bug.

### “The database column/model is missing”

Generate the client and check migration state. Do not repair the symptom with
`db pull` or an uncommitted `db push`.

```powershell
npm --workspace @qubere/db run db:generate
npm --workspace @qubere/db run db:migrate:deploy
```

Only run deployment migrations against a database you are authorized to modify.

### “TypeScript still sees the old Prisma type”

Run `db:generate`, restart the TypeScript server in the editor, then rerun the
affected workspace's typecheck.

### “Port 3000/3001/3002 is already in use”

On Windows, identify the owning process before stopping it:

```powershell
Get-NetTCPConnection -LocalPort 3000,3001,3002 -State Listen
Get-Process -Id <OwningProcessId>
```

Stop only the process you confirmed belongs to your development server.

### “A Client Component fails after importing a helper”

Inspect the helper's dependency tree for Prisma, `node:*`, secrets, filesystem,
storage, or Clerk server imports. Move the server operation behind a Server
Component, Server Action already established by the app, or Route Handler.

### “It works for an admin but not another role”

Check both UI capability gating and server authorization. Inspect account type,
role names, explicit permission, product entitlement, data mode, ownership, and
assignment filters. Do not weaken the guard merely to make the test user pass.

## 10. Pull request handoff template

```markdown
## What changed
- <user-visible behavior>
- <important implementation or migration>

## Why
- <problem or acceptance criterion>

## How to verify
1. Sign in as <role> at <URL>.
2. <action>.
3. Confirm <result>.

## Automated checks
- `npm run typecheck --workspace=<workspace>`: passed
- `npm run test --workspace=<workspace>`: passed
- `npm run lint --workspace=<workspace>`: passed

## Risk and rollback
- Risk: <tenant/data/integration/UI risk>
- Rollback: <revert code; describe migration compatibility if applicable>
```

Do not claim a check passed unless you ran it. Include the failing command and a
short diagnosis for any known pre-existing or environment-dependent failure.

## 11. Quick “where do I edit?” reference

| Need | Start here |
| --- | --- |
| Add/change a Customs page | `apps/custom/src/app/app/<feature>/page.tsx` |
| Add/change a TMS page | `apps/tms/src/app/<feature>/page.tsx` |
| Add/change a Portal page | `apps/portal/src/app/(portal)/<feature>/page.tsx` |
| Add an API endpoint | Correct app's `src/app/api/<path>/route.ts` |
| Add interactive UI | Colocated `*Client.tsx` or app `src/components/` |
| Add reusable app business logic | App `src/modules/<domain>/` |
| Add cross-app business logic | Matching `packages/<domain>/src/` |
| Change DB model | `packages/db/prisma/schema.prisma` plus migration |
| Add shared DB service | `packages/db/src/services/` plus explicit export |
| Change auth/permission behavior | `packages/auth/src/` and app guard integration |
| Change file storage | `packages/storage/src/` |
| Change tracking provider behavior | `packages/tracking*/src/` |
| Change worker behavior | App `src/worker/` and job/event wiring |
| Add a seed | `packages/db/prisma/seeds/` or app `scripts/` |
| Change deployment | `infrastructure/gcp/` and relevant runbook |
| Document a feature | `docs/apps/<app>/` in the appropriate category |

## 12. Definition of done

A change is done when it is in the correct layer, handles the full request path,
protects tenant and permission boundaries, validates untrusted input, includes a
safe migration when needed, has useful tests, passes relevant checks, works in
the browser for expected and denied cases, changes no unrelated files, exposes
no secrets, and leaves enough verification notes for another engineer to repeat.

