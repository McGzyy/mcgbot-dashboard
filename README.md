# McGBot dashboard

Next.js App Router app for the McGBot web terminal (Discord OAuth, Supabase, subscriptions, moderation, affiliates).

## Local dev

```bash
npm install
npm run dev
```

Copy env from Vercel or use `.env.local` — see repo `docs/ENVIRONMENT.md` and `docs/DEPLOYMENT.md`.

## Migrations

SQL lives in `supabase/migrations/`. Apply to the **same Supabase project** as production `SUPABASE_URL`, then `NOTIFY pgrst, 'reload schema';`.

## Related docs

- `docs/PROJECT_HANDOFF.md` — architecture and handoff
- `AGENTS.md` — agent notes and recent passes
