# Supabase and Vercel migration status

The migration is incomplete and has not passed a production build. Earlier runtime validation does not validate this version.

## Prepared locally

- The supplied database connection is saved in ignored `.env.local`, with its password URL-encoded. Existing password hashes and the encryption key were preserved.
- Database access initializes lazily, supports queries with no parameters, and executes batches in a transaction.
- Delivery deduplication and login attempt upserts now use PostgreSQL syntax.
- Supabase Storage initializes lazily and accepts `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY`.
- Next.js has a Tailwind PostCSS configuration.

## Still required

1. Restore network access and install dependencies. The obsolete lockfile was removed; regenerate and commit it, then run TypeScript checks, API tests, and a production build.
2. Review the target database for existing tables before applying `supabase/schema.sql`. No migration has been applied remotely.
3. Supply a server-only Supabase API secret for Storage; the attached database password is not a Storage API key.
4. Check whether the Vercel runtime requires a Supabase pooler connection instead of the supplied direct database endpoint.
5. Adapt the existing 20 MB media transfer to direct signed Storage uploads/downloads before deploying on Vercel.
6. Validate the Vercel environment variables and OAuth callback origin. The retired runtime configuration, dependencies, and SQLite migrations have been removed; `pnpm db:migrate` now applies the Supabase schema.
7. Push the verified source to GitHub, then import it into Vercel and configure secrets in Vercel's environment settings. Never commit `.env.local` or `.dev.vars`.

The user reported pushing the preceding commits through CMD. This configuration cleanup is local. The database TCP probe failed. No Supabase tables, bucket, or Vercel deployment have been created by this cleanup.
