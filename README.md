# ZoCo MVP

ZoCo helps travelers discover the right Zostel stay based on their persona and trip vibe, then hands them off to the existing Zostel booking flow.

---

## Stack

| Layer      | Choice                   |
| ---------- | ------------------------ |
| Framework  | Next.js 16 (App Router)  |
| Language   | TypeScript               |
| Styling    | Tailwind CSS             |
| Database   | Postgres via Drizzle ORM |
| AI         | OpenAI Responses API     |
| Validation | Zod                      |

---

## Getting started

### 1. Prerequisites

- Node.js 20+
- A running Postgres instance (local or remote)
- An OpenAI API key

### 2. Clone and install

```bash
git clone https://github.com/pratyushs8/zovo-mvp.git
cd zovo-mvp
npm install
```

### 3. Configure environment

```bash
cp .env.example .env.local
# Fill in DATABASE_URL and OPENAI_API_KEY
```

### 4. Run database migrations

```bash
npm run db:generate   # generate migration files from schema
npm run db:migrate    # apply migrations to your database
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

| Script                  | What it does                           |
| ----------------------- | -------------------------------------- |
| `npm run dev`           | Start local dev server with hot reload |
| `npm run build`         | Production build                       |
| `npm start`             | Serve the production build             |
| `npm run lint`          | Run ESLint                             |
| `npm run lint:fix`      | Run ESLint and auto-fix                |
| `npm run format`        | Format all files with Prettier         |
| `npm run format:check`  | Check formatting without writing       |
| `npm run typecheck`     | TypeScript type check (no emit)        |
| `npm test`              | Run Jest tests                         |
| `npm run test:watch`    | Jest in watch mode                     |
| `npm run test:coverage` | Jest with coverage report              |
| `npm run db:generate`   | Generate Drizzle migration files       |
| `npm run db:migrate`    | Apply pending migrations               |

---

## Project structure

```
src/
├── app/              # Next.js App Router — pages and API routes
│   └── api/          # API route handlers
├── components/
│   └── ui/           # Shared UI primitives
├── db/
│   ├── client.ts     # Drizzle + pg connection pool
│   └── schema/       # Table definitions (one file per domain)
├── lib/
│   └── env.ts        # Zod-validated env — throws on startup if vars are missing
├── services/         # Business logic: AI calls, search, recommendations
└── types/
    └── index.ts      # Shared domain types (TravelerPersona, TripVibe, etc.)
```

---

## Environment variables

See [`.env.example`](.env.example) for all required variables. Never commit `.env` or `.env.local`.

---

## Commit conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>
```

**Types:**

| Type       | When to use                               |
| ---------- | ----------------------------------------- |
| `feat`     | New user-facing feature                   |
| `fix`      | Bug fix                                   |
| `chore`    | Tooling, deps, config — no product change |
| `refactor` | Code restructure with no behavior change  |
| `test`     | Adding or updating tests                  |
| `docs`     | Documentation only                        |
| `ci`       | CI/CD pipeline changes                    |

**Examples:**

```
feat(recommendation): add persona-based stay ranking
fix(db): handle null location field in stays schema
chore(deps): bump openai to 6.44
test(services): add unit tests for vibe matching logic
```

**Rules:**

- Summary is lowercase, imperative, no period at the end
- Keep the subject line under 72 characters
- Reference a GitHub issue in the body if one exists: `Closes #12`

---

## Branch strategy

| Branch    | Purpose                                 |
| --------- | --------------------------------------- |
| `main`    | Always deployable; protected — PRs only |
| `feat/*`  | New features                            |
| `fix/*`   | Bug fixes                               |
| `chore/*` | Tooling, deps, config                   |

CI (lint + typecheck + format check) must pass before merging to `main`.
