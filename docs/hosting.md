# Hosting Pulse

Proposed setup for running Pulse as a service. Nothing in this file has been deployed. Each step that creates
a cloud resource, spends money or deploys is for the owner to approve and do.

## Shape

One server does everything: the API, the chat and scanner WebSockets, scheduled jobs, and the built web
pages. That's why it suits Railway (a long-running Node process), and why Vercel can't be used for the
server (its functions don't keep WebSockets or scheduled jobs running).

```
browser ──https──> Railway service (npm start = node dist/index.js)
                     ├─ /api/*            Express routes
                     ├─ WebSockets        chat, scanner
                     ├─ everything else   dist/public (built by vite), index.html for app routes
                     ├──> Neon Postgres + PostGIS (branch: production, region aws-ap-southeast-2 / Sydney)
                     ├──> file storage (S3-compatible bucket, private)
                     ├──> SendGrid (email), Stripe (billing), Sentry (errors)
```

- **Build:** `npm run build` builds `dist/public` (vite) and `dist/index.js` (esbuild). `railway.json` uses
  Nixpacks, which runs the build script, then `npm run start`.
- **Health check:** `GET /api/health` (open, no database), already set in `railway.json`. `GET /api/health/db`
  also checks the database.
- **Vercel:** `vercel.json` only serves the static pages, with no API behind them. Once Railway serves the
  site, retire the Vercel project, or keep it only to redirect the old address.
- **Region:** the database is in Sydney. Pick the Railway region nearest to it. Pulse makes many small queries
  per screen, so each extra millisecond to the database adds up.

## Environment on Railway

| Variable | What it is |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon **production** branch. Pulse uses the direct (non-pooled) address itself, since row-level security needs real sessions |
| `JWT_SECRET`, `SESSION_SECRET` | new long random values, not the development ones |
| `APP_URL` | the public address, e.g. `https://app.<domain>`. Used for links in emails and allowed by CORS. Required live |
| `TRUST_PROXY` | `1` (Railway is a proxy; rate limits need the real client address) |
| `MAILTRAP_API_TOKEN`, `MAILTRAP_SANDBOX_ID`, `EMAIL_FROM` | email through Mailtrap (see Email below). `SENDGRID_API_KEY` still works instead |
| `SENTRY_DSN` | error tracking (optional, recommended) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | push notifications |
| `S3_BUCKET_NAME`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (+ `S3_ENDPOINT` for R2) | file storage (see below) |
| Stripe keys and price IDs | billing (see the billing section once built) |

## Email

Invites, password resets, reports and notification emails all go through `server/services/email-service.ts`.
It picks the provider on every send:

| Set | What happens |
|---|---|
| `MAILTRAP_API_TOKEN` + `MAILTRAP_SANDBOX_ID` | **Building and testing.** Emails are caught in that Mailtrap sandbox and never reach a real inbox. Open the sandbox in Mailtrap to read them and follow the links. No domain needed. Free plan: 50 test emails a month |
| `MAILTRAP_API_TOKEN` only | **Real sending** through Mailtrap. Needs a sending domain verified in Mailtrap (DNS records), and `EMAIL_FROM` on that domain. Free plan: 4,000 emails a month, 150 a day |
| `SENDGRID_API_KEY` (no Mailtrap token) | Real sending through SendGrid. `EMAIL_FROM` must be a sender verified there |
| none of these | Development: the email is written to the server log. Live: Pulse refuses to pretend an email went; invites are saved, and the screen says the email didn't go |

Mailtrap is called over HTTPS, not SMTP, because Railway's Hobby plan blocks outgoing SMTP. `MAILTRAP_SANDBOX_ID`
is the number in the sandbox's address in Mailtrap. `EMAIL_FROM_NAME` (default "Pulse") is the sender's display name.

To go from testing to real sending: verify the domain in Mailtrap, set `EMAIL_FROM` to an address on it, and
remove `MAILTRAP_SANDBOX_ID`. The token must be one that is allowed to send for that domain.

## Databases

- **production** (Neon branch `production`, default): live farms only.
- **dev** (Neon branch `dev`, `br-sweet-cherry-a79hn0z0`, made from production on 2026-11-12): local work and
  tests. `.env` points here. The old `.env` is in `.env.backup-production.local` (git-ignored).
- Older branches `development` and `vercel-dev` are archived and out of date. They can be deleted once nothing
  needs them.
- Migrations: try each one on `dev` (or a throwaway branch), then run `npx tsx scripts/run-migrations.ts` against
  production before deploying code that needs it.
- **Backups:** the Neon project is on the free plan, which keeps **6 hours** of history for restores. Before
  live farms join, move to a paid Neon plan with a longer restore window, and consider a scheduled `pg_dump` to
  storage you control.

## File storage

The Railway disk is wiped on every deploy, so live uploads (photos, voice notes, documents, chat files) go to a
**private** S3-compatible bucket: AWS S3 in Sydney (`ap-southeast-2`), or Cloudflare R2.

How it works (`server/services/fileStorage.ts`, the only code that saves, serves or deletes uploads):
- Every route that takes a file (attachments, jobs, photos, voice notes, chat) calls `saveUpload(farmId, area, file)`.
  Files are stored under a farm-prefixed key, `<area>/<farmId>/<time>-<random>-<name>`, and objects are written
  without any public ACL.
- The address saved in the database is always `/uploads/<key>`, with local disk or S3, so rows don't change if
  storage does.
- `GET /uploads/<key>` first checks the person: signed in (401 otherwise), and an active member of the farm in the
  key (404 otherwise, so other farms can't tell a file exists). Contractors get only files on dockets of jobs
  shared with them. Then, with S3, it redirects (302) to a signed bucket link that lasts 5 to 10 minutes; links are
  made for fixed 5-minute windows, so browsers can cache them. Without S3 it sends the file from disk.
- Files saved before keys carried the farm (`/uploads/photos/<name>`, `/uploads/chat/<name>` and so on) are served
  only when a row of the person's current farm links to that address (jobs, photo attachments, voice notes,
  chat messages, attachments). A file nothing links to answers 404.
- Without `S3_BUCKET_NAME` (development), files are kept in `./uploads` (or `UPLOADS_DIR`), served the same way.

Environment for live:

| Variable | AWS S3 | Cloudflare R2 |
|---|---|---|
| `S3_BUCKET_NAME` | the bucket | the bucket |
| `AWS_REGION` | `ap-southeast-2` | leave unset (`auto`) |
| `S3_ENDPOINT` | leave unset | `https://<account-id>.r2.cloudflarestorage.com` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | an IAM user's key | an R2 API token's key |

`S3_FORCE_PATH_STYLE=1` is there for other S3-compatible services that need it. If `S3_BUCKET_NAME` is set but the
keys or region are missing, the server refuses to start.

Setting up the bucket (not done yet; needs the account owner):
- Turn on **Block all public access** (S3) or leave public access off (R2). No bucket policy that allows public
  reads, and no CORS rule is needed (the browser only follows the redirect to load the file).
- Give the key access to this bucket only: `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on
  `arn:aws:s3:::<bucket>/*`. R2: an "Object Read & Write" token limited to the bucket.
- Files already on a developer's disk are not copied to the bucket. Live starts empty, so nothing needs moving.

Tested by `tests/backend/uploads-isolation.test.ts`: farm B and signed-out visitors can't fetch farm A's files,
with local disk and with S3 (a fake bucket in memory; the test sends nothing to AWS).

## Checked locally (2026-11-12)

The production build was built and run with `NODE_ENV=production` against the `dev` database. Health, the
database check, the web pages (including app routes such as `/app/setup`) and sign-in all worked. A request
from a foreign origin was refused. Four problems that would have stopped or harmed a live deploy were fixed:
- 11 packages were declared only in `server/package.json`, so the built server couldn't find them. They're now
  in the root `package.json`: pino, pino-http, pino-pretty, helmet, cors, express-rate-limit, the Sentry
  packages, the AWS S3 packages and ioredis.
- `twilio` was imported in a way that only works under `tsx`.
- The logger used `require('os')`, which the built (ESM) server can't do.
- Error logs and Sentry reports included request bodies with passwords in them. Passwords and link tokens are
  now hidden.

## Going live checklist

1. Create the Railway project and service from the GitHub repo, in the region nearest Sydney.
2. Set the environment above (new secrets, the production `DATABASE_URL`).
3. Create the private bucket and a key limited to it (see File storage), and set the storage variables.
4. Email (Mailtrap): for real sending, verify the sending domain (SPF/DKIM), set `EMAIL_FROM` and remove
   `MAILTRAP_SANDBOX_ID`. While it is set, emails are only caught in the sandbox.
5. Point the domain at Railway and set `APP_URL` to match.
6. Upgrade the Neon plan for a longer restore window.
7. Deploy. Then check `/api/health/db`, sign-up, an invite email, a password reset and a file upload
   (open it as a member, then check a member of another farm gets 404 and the bucket address alone is refused).
