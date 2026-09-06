# Clever Clouds Content Scheduler

This deployment target is Vercel + Supabase. Cloudflare D1/R2 are no longer used by the application runtime.

Internal social content workspace with Clever Clouds branding. Built with React, Vinext (Next.js App Router compatible), Cloudflare Workers, D1, and R2. This is the first implementation, not a complete automated publishing service.

## Implemented

- Server-authenticated, single-email sign-in with PBKDF2 password verification, expiring HttpOnly sessions, request-origin checks, and rate limiting.
- Calendar in Asia/Kolkata, drafts, planned dates, platform-specific caption overrides, server-side validation, optimistic edit concurrency, and private image/video attachments up to 20 MB.
- In-app credential management for Meta, YouTube, Google Business Profile, LinkedIn, and X. AES-GCM encrypted secrets and tokens; masked client identifiers; credential rotation invalidates affected connections.
- OAuth account authorization, session-bound one-time state, X PKCE, token refresh where supplied, and account discovery.
- Manual text-only publishing to Facebook Pages, LinkedIn personal profiles, and X, with per-account delivery records and duplicate-attempt protection.
- On-demand Google Business Profile review retrieval/replies and Meta conversation retrieval/replies. Platform credentials, permissions, approval, and account eligibility are required.

## Not yet implemented / validation limits

- Automatic background publishing. Calendar entries are plans, not guaranteed scheduled deliveries.
- Instagram/YouTube publishing, media publishing, LinkedIn organization publishing, and inbox support outside Meta/GBP.
- External platform flows have not been end-to-end tested against real accounts. No platform credentials were provided or real messages/posts sent during development.
- Meta discovery retrieves up to 100 pages. Google discovery retrieves up to 20 business accounts and 100 locations per account. Larger organizations need discovery pagination.
- Ambiguous publishing failures remain blocked for retry to prevent duplicates; check the social account manually.
- Optional WebMCP tools are feature-detected; a supported browser contract validation was not available during development.
- Hosted data uses D1/R2. The supplied Supabase database has not been accessed or migrated.

## Development

Use Node 22.13+ and pnpm. Run `pnpm install`, `pnpm dev`, and `pnpm build`. Run the SQL in `supabase/schema.sql` once in Supabase SQL Editor. Required native dependency scripts must be approved through the package manager.

Copy `.env.example` to ignored `.dev.vars` and configure the origin, password hash/salt, and a random 32-byte base64 encryption key. Password hashing uses PBKDF2 SHA-256, 100,000 iterations, 32-byte output, lowercase hex, and the UTF-8 salt. Do not put the password, app secrets, or database credentials into source control. Do not rotate the encryption key without migrating encrypted rows.

The Supabase schema lives in `supabase/schema.sql`. Hosted environment secrets are managed in Vercel, outside the source repository. The Supabase service-role key is server-only and must never be exposed as `NEXT_PUBLIC_*`.

## Connecting platforms

Sign in and open **Social accounts → Add credentials**. Each integration shows its exact callback URL and permissions. Save the app details, then click Connect to authorize accounts. Credentials can be added or replaced at any time.

Official references: [Meta developer portal](https://developers.facebook.com/apps/), [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Google Business Profile reviews](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list), [LinkedIn sharing](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin), [X OAuth](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code).

Postiz was reviewed as a functional reference. Its source code was not copied into this implementation.
