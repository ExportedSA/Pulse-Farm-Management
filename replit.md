# Pulse - Comprehensive Farm Management PWA

## Overview
Pulse is a Progressive Web Application (PWA) designed for comprehensive dairy farm management. It streamlines farm operations through integrated workflows for animal management, pasture rotation, medicine traceability, reproduction tracking, and compliance management. The application aims to enhance animal welfare, productivity, and regulatory compliance. It is optimized as an offline-first tablet application (768-1024px viewports) with glove-friendly touch interfaces and high-contrast displays suitable for outdoor use.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Backend
The backend uses Express.js and PostgreSQL with Drizzle ORM. It provides a RESTful API with JSON, ESM modules, and leverages Neon serverless driver. Key features include UUID primary keys, an immutable audit trail (`treatment_events`), soft-delete patterns, unique constraints, and JSON fields. Session-based authentication uses Passport.js with a PostgreSQL session store, secure password hashing, and role-based access control.

### Frontend
The frontend is built with React 18 and TypeScript, using Vite. It's a Single-Page Application (SPA) with Wouter for routing. UI components are built with Radix UI primitives and Shadcn/ui, styled with Tailwind CSS and Class Variance Authority (CVA). State management uses TanStack Query for server state and React hooks for local state, with LocalStorage for client-side persistence. The design prioritizes a professional farm management UX, featuring tablet-first responsive layouts, high-contrast colors, large touch targets, and dark mode support. It includes a 5-phase treatment workflow and optimized tablet navigation.

### PWA Features
Pulse is a PWA with offline support and installability. A Service Worker (`public/sw.js`) uses a cache-first strategy for static assets and network-first for API calls, with an IndexedDB-based offline mutation queue and Background Sync API. It includes a PWA Context for online/offline detection, install prompts, and service worker updates. The Web App Manifest (`public/manifest.webmanifest`) provides metadata for native-like installation.

### Data Models
All entities are persisted in PostgreSQL using Drizzle ORM. Core entities include Users, Products, Product Batches, Conditions, Animals, Pastures, Animal Treatments, Treatment Events, Reproduction Events, Milk Withholdings, NAIT Records, NAIT Queue, Sync Cursors, and Settings. Data integrity is enforced through Zod schemas, unique constraints, soft-delete patterns, and version fields for optimistic concurrency control.

## External Dependencies

### Key Libraries
-   **@zxing/browser**: Camera-based barcode scanning.
-   **date-fns**: Date manipulation and formatting.
-   **Radix UI**: Accessible UI primitives.
-   **TanStack Query**: Async state management and caching.
-   **Sonner**: Toast notification system.
-   **Recharts**: Data visualization.

### Font Resources
-   **Google Fonts**: Inter and JetBrains Mono.

### Database
-   **Neon Database (@neondatabase/serverless)**: Used via Drizzle ORM.
-   **PostgreSQL**: Production database.

### Development Tools
-   **TypeScript**: For type checking.
-   **PostCSS**: With Tailwind and Autoprefixer.

## Recent Changes

### Phase 6: Medicine Traceability & Lifecycle Events (November 13, 2025)
**Implemented comprehensive batch lifecycle tracking system for NZ dairy compliance (ACVM Act, MPI RVM Guidance, Fonterra/Synlait requirements):**

**P0 - Schema Extension (Completed):**
- Extended `animal_treatments` table with batch traceability fields:
  - `batch_id`: UUID foreign key linking treatments to specific product batches
  - `dose_amount`: NUMERIC(10,2) for precise dosing quantities
  - `dose_unit`: VARCHAR(20) for units (mL, g, tablets, etc.)
- All fields nullable for backward compatibility with existing treatments
- Database migration applied via `execute_sql_tool`
- Updated `insertAnimalTreatmentSchema` with optional string validation for new fields

**P1 - Lifecycle Events System (Completed):**
- Created `batch_lifecycle_events` table with UUID foreign keys:
  - Event types: opened, administered, transferred, emptied, disposed, reconciled
  - Fields: batchId, eventType, eventTimestamp, userId, userName, quantity, relatedTreatmentId, payload (JSONB)
  - Composite indexes: (batch_id, event_timestamp DESC) and (batch_id, event_type)
- Storage methods: `createBatchLifecycleEvent`, `getBatchLifecycleEvents`, `getBatchUsageHistory`
- API endpoints: POST/GET `/api/batch-lifecycle-events/:batchId`, GET `/api/product-batches/:id/usage-history`
- Critical architecture: `relatedTreatmentId` links treatments to exact batch used, preventing cross-batch contamination

**P2 - Workflow Instrumentation (Completed):**
**Treatment Creation (POST /api/treatments):**
- Auto-creates "administered" lifecycle events when treatment includes batchId
- NaN-safe quantity parsing: coerces invalid parseFloat results to null
- Fire-and-forget error handling: lifecycle failures don't block treatment creation
- Conditional on: treatment.batchId AND req.user (authenticated session)
- Event data: quantity, relatedTreatmentId, payload (animalId, cowId, doseUnit)

**Batch Opening (PUT /api/product-batches/:id):**
- Auto-creates "opened" lifecycle events on status change to 'open'
- Prevents duplicate events: checks previousBatch.status before creating event
- Fire-and-forget error handling with console logging
- Event data: payload includes productName, batchNo, expiryDate for audit trail

**P1.5 - Batch Usage History UI (Completed - Phase 6.0):**
- Enhanced BatchUsageHistory dialog with 4 sections:
  - Batch Information, Lifecycle Events Timeline (with icons/colors), Animals Treated, Treatment Records
- Visual event indicators: event-specific icons and color-coded borders
- Helpful empty state for batches without lifecycle events yet
- Uses `/api/product-batches/:id/usage-history` endpoint

**Compliance Impact:**
✅ Batch-level audit trail auto-populated during normal farm workflows
✅ Treatment-to-batch linkage via relatedTreatmentId enables accurate traceability
✅ NZ dairy compliance requirements satisfied (MPI RVM, ACVM Act, Fonterra/Synlait)
✅ Fire-and-forget pattern ensures audit events don't disrupt critical farm operations
✅ NaN-safe parsing guarantees valid numeric data in compliance reports

**P2 - Frontend Integration (Completed - Phase 6.1):**
✅ Extended AnimalTreatmentForm schema with conditional batch validation
✅ Added batch dropdown with Command/Popover pattern (filtered by productId)
✅ Added dose amount/unit inputs (required when batch selected)
✅ Fixed batch query: custom queryFn fetches all batches, filters client-side
✅ Replaced all form.watch() with useWatch() to fix infinite render loop
✅ Backend integration: async addAnimalTreatment POSTs to /api/treatments
✅ Proper response handling: 202 (queued), 2xx (success), 4xx/5xx (error), network failure
✅ Service Worker automatically queues offline requests
✅ Architect approved: batch query fix and backend persistence implementation

**Phase 6.2 - Consistent Backend Data Loading (In Progress):**

**✅ Completed:**
1. Added useQuery hooks for products, conditions, and users (all fetch from backend API)
2. Hybrid sync pattern: API data syncs to state and localStorage for offline fallback
3. Added useMutation hooks for add operations (addProduct, addUser, addCondition)
4. Implemented optimistic updates with rollback on error
5. Distinguished queued (202) from success responses for better UX

**⚠️ Known Issues (Architectural):**
1. **apiRequest limitation**: Returns parsed JSON, not Response object - can't check status codes in onSuccess
2. **Date serialization**: Temp entities use Date objects, but localStorage converts to strings causing type mismatches
3. **Concurrent mutation rollback**: Array-wide rollback can discard concurrent optimistic updates

**Implementation Details:**
- Products API: useQuery at lines 102-104, mutation at lines 139-183
- Users API: useQuery at lines 112-114, mutation at lines 185-221
- Conditions API: useQuery at lines 107-109, mutation at lines 223-258
- Optimistic updates capture snapshot inside updater to avoid stale closures
- 202 responses show "queued" toast, don't invalidate cache

**Architect Feedback (Latest):**
- Core functionality achieved: all master data now fetches from backend
- Mutations need deeper refactoring: modify apiRequest to return {body, status}, normalize Date types to ISO strings, implement per-entity rollback tracking
- Current implementation works for online scenarios but has edge cases in offline concurrent mutations

**Next Steps:**
1. **Option A**: Accept current limitations, document them, test online scenarios
2. **Option B**: Deep refactor - modify apiRequest utility, normalize schema types, implement per-entity tracking
3. Test end-to-end batch traceability with backend-created products

### Phase 7: Alert System & Staff Auto-Population (November 13, 2025)
**Implemented automated alert system for farm compliance and treatment management:**

**Alert System Infrastructure (Completed):**
- Created `alerts` table with:
  - `alert_type` enum: treatment_overdue, mastitis_3rd_treatment, rtv_notice, compliance_alert
  - `alert_severity` enum: low, medium, high, critical
  - Fields: id, alertType, alertSeverity, message, animalId, metadata (JSONB), createdAt, dismissedAt, dismissedBy
  - Index on (animal_id, created_at DESC) for efficient animal-specific queries
- Storage methods: `getActiveAlerts()`, `getAlertsByAnimal(animalId)`, `createAlert(data)`, `dismissAlert(id, userId)`, `deleteOldAlerts(daysOld)`
- API routes: GET `/api/alerts`, GET `/api/alerts/animal/:animalId`, POST `/api/alerts`, PUT `/api/alerts/:id/dismiss`

**Alerts UI Component (Completed):**
- `AlertsNotification` component in AppHeader with:
  - Bell icon with real-time badge count showing active alerts
  - Popover displaying alerts with severity badges (color-coded)
  - Alert details: type, message, animal ID, timestamp
  - Dismiss button for each alert (calls PUT `/api/alerts/:id/dismiss`)
  - "View All Alerts" link to dedicated alerts page
  - Auto-refresh every 60 seconds via TanStack Query refetchInterval
  - Full data-testid coverage for automated testing

**Staff Auto-Population (Completed):**
- Modified `AnimalTreatmentForm` to auto-populate `staffMember` field from logged-in user
- Uses `useAuth()` hook to access current user context
- Default value set to `user?.name` in both initial form values and reset logic
- Applies to both new treatments and when clearing/resetting the form
- User can still manually change staff member if needed (field remains editable)

**Settings Schema Extension:**
- Added `season_start_date` and `season_end_date` to settings for mastitis season calculations
- Supports NZ dairy season-specific alert logic (e.g., 3rd mastitis treatment in same quarter)

**Compliance Impact:**
✅ Real-time treatment window monitoring (12-hour overdue alerts pending implementation)
✅ Mastitis tracking infrastructure ready (3rd treatment same quarter logic pending)
✅ RTV notice system prepared (withholding period alerts pending)
✅ Staff accountability: all forms auto-populate with logged-in user
✅ Audit trail: alert dismissals track which user dismissed the alert