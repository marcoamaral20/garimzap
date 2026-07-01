# Contributing to Entrelinhas

Entrelinhas is an architecture-focused MVP. Contributions should preserve the product philosophy: deterministic first, provider agnostic, backend focused, and honest about current limitations.

## Project Philosophy

- Prefer small, readable modules over clever abstractions.
- Keep the webhook fast: validate, persist, enqueue, return.
- Keep parser behavior deterministic and explainable.
- Do not introduce AI, provider adapters, dashboard code, authentication, or new domains without a design discussion first.
- Structured business data should stay traceable to the Raw Message and Parser Result that produced it.

## Development Workflow

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Start PostgreSQL and Redis with Docker Compose.
4. Run `npm run db:migrate`.
5. Run the API with `npm run dev`.
6. Run the worker with `npm run dev:worker`.

Before submitting changes, run:

```bash
npm run db:migrate
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
npm audit --audit-level=high
```

## Coding Conventions

- Use TypeScript with explicit names.
- Validate external input with Zod.
- Keep business rules out of route handlers.
- Prefer repository methods over inline SQL in application code.
- Add tests for behavior that affects ingestion, processing, parsing, listings, statistics, or API contracts.
- Avoid broad refactors unless they directly improve clarity for the current change.

## Proposing Changes

For small fixes, open a focused pull request with a clear description and validation commands.

For larger changes, start with a short proposal that explains:

- the product problem;
- the scope;
- trade-offs;
- what remains out of scope;
- how the change fits the modular monolith.

Future features such as AI, provider adapters, dashboard, authentication, multi-domain parsing, and multi-tenancy should be discussed before implementation.
