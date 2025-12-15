# Pulse Farm Management - Architecture

> **Canonical Structure Decision**  
> Last Updated: December 13, 2025

## Canonical Directories

These are the **authoritative source** directories. All new development happens here:

| Directory | Purpose | Tech Stack |
|-----------|---------|------------|
| `client/src/` | Frontend application | React, TypeScript, Vite, TailwindCSS |
| `server/` | Backend API server | Node.js, Express, TypeScript |
| `shared/` | Shared schemas & types | TypeScript, Zod |
| `pulse-gateway/` | Hardware bridge (EID, scales, gates) | Python, FastAPI |

## Non-Canonical (Archived)

These directories are **deprecated** and should NOT receive new features:

| Directory | Status | Notes |
|-----------|--------|-------|
| `pulse/frontend/` | Archived | Legacy frontend - do not modify |
| `pulse/backend/` | Archived | Legacy backend - do not modify |

> **Warning**: The `pulse/` directory is gitignored and excluded from version control.

## Directory Structure

```
full-project/
├── client/                 # CANONICAL - Frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route pages
│   │   ├── lib/            # Utilities, contexts, hooks
│   │   ├── hooks/          # Custom React hooks
│   │   └── contexts/       # React contexts
│   └── public/             # Static assets
│
├── server/                 # CANONICAL - Backend
│   ├── routes/             # API route handlers
│   ├── services/           # Business logic
│   ├── middleware/         # Express middleware
│   ├── hardware/           # Hardware bridge connectors
│   ├── config/             # Configuration
│   ├── db/                 # Database migrations
│   ├── jobs/               # Background jobs
│   └── types/              # TypeScript types
│
├── shared/                 # CANONICAL - Shared Types
│   └── schema.ts           # Zod schemas & TypeScript types
│
├── pulse-gateway/          # CANONICAL - Hardware Bridge
│   └── app/                # Python FastAPI application
│
├── docs/                   # Documentation
│   ├── PRODUCT_MAP.md      # Route/page mapping
│   └── ARCHITECTURE.md     # This file
│
├── tests/                  # Test files
│   ├── e2e/                # End-to-end tests
│   └── setup/              # Test configuration
│
└── uploads/                # User uploads (gitignored content)
    ├── chat/
    ├── photos/
    └── voice-notes/
```

## Supporting Directories

| Directory | Purpose | Canonical? |
|-----------|---------|------------|
| `docs/` | Documentation | Yes |
| `tests/` | Test suites | Yes |
| `uploads/` | User file uploads | Yes (structure only) |
| `public/` | Static assets | Yes |
| `prisma/` | Database schema (if using Prisma) | Yes |
| `.vscode/` | Editor settings | Optional |
| `api/` | API client utilities | Review needed |
| `database/` | Database files | Review needed |
| `firmware-norvi-gate-feed/` | Hardware firmware | Specialized |

## Migration Notes

If you find code in `pulse/frontend/` or `pulse/backend/` that needs to be preserved:

1. **Do NOT** modify the legacy code
2. **Copy** the relevant logic to the canonical location
3. **Adapt** to match current patterns and conventions
4. **Test** thoroughly before removing legacy code

## Import Aliases

Frontend (`client/src/`):
- `@/` → `client/src/`
- `@/components/` → `client/src/components/`
- `@/lib/` → `client/src/lib/`
- `@/pages/` → `client/src/pages/`

Backend (`server/`):
- `@shared/` → `shared/`
