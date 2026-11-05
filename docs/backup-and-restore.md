# Backups and restore

Pulse has two layers of backup.

## 1. The whole database (Neon)

The database runs on Neon, which keeps point-in-time history. To get the database back as it was at
a given moment:

1. In the Neon console, create a branch from the main branch at the chosen time.
2. Point a test copy of the app at the new branch's connection string and check the data.
3. If it's right, restore the main branch from the branch (or switch the app over to it).

Check the project's history retention in Neon. It sets how far back you can go.

## 2. One farm's map, jobs and records (`scripts/farm-backup.ts`)

This copies one farm's map, jobs and records:

- paddocks and boundary versions;
- layers, features, saved views, exclusions and rate plans;
- the farm's own products;
- jobs with their lines, tank mixes, restrictions, versions and dockets;
- records, attachment entries and the map edit history.

```bash
npx tsx scripts/farm-backup.ts export <farmId>                  # writes backups/farm-<id>-<time>.json
npx tsx scripts/farm-backup.ts restore <file> <emptyFarmId>     # restores into an empty farm, with new ids
```

- Restoring gives every row a new id, so a backup can be restored next to the original and checked
  before anything is switched over.
- It refuses a farm that already has paddocks or jobs.
- Users aren't copied. They're shared across farms and must already exist.
- Uploaded files (docket photos, PDFs) are referenced by their storage key, not copied. Back up the
  `uploads/` folder (or the S3 bucket) alongside the JSON.
- `backups/` is git-ignored. Keep the files somewhere safe and off the server.

## The restore check

```bash
npx tsx scripts/farm-backup-check.ts [farmId]
```

The check:

1. backs up the farm;
2. restores it into a new temporary farm;
3. compares every table's row count, the boundary area, the net hectares of every job, unresolved
   restrictions, records and their links to job lines;
4. confirms the copy doesn't point back at the original;
5. confirms a second restore over it is refused;
6. removes the temporary farm.

The original farm is only read. Run it after changing the database schema (new tables need adding
to `TABLES` in `farm-backup.ts`), and before relying on a backup.
