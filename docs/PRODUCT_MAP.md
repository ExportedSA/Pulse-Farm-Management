# Pulse Farm Management - Product Map

> **Operating Cadence Document**  
> Last Updated: December 13, 2025

## Status Legend
- **Live** - Fully functional, integrated frontend + backend
- **Stub** - Backend route exists but returns mock/placeholder data
- **Patch** - Partial implementation, needs integration work
- **Missing** - No implementation exists

---

## Core Routes & Pages

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| `server/routes.ts` (main) | `App.tsx` router | Live |
| `server/auth.ts` | `login-page.tsx` | Live |

---

## Animal Management

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| `routes/animal-tags.ts` | `animals-list.tsx` | Live |
| `routes/animal-timeline.ts` | `animal-timeline-page.tsx` | Live |
| `routes/lineage.ts` | `animal-lineage-page.tsx` | Live |
| `routes/weight.ts` | `weight-tracking-dashboard.tsx`, `weight-growth-tracking.tsx` | Live |
| `routes/bulk-operations.ts` | `bulk-operations-page.tsx` | Live |
| `routes/groups.ts` | `groups-management.tsx`, `smart-groups-page.tsx` | Live |
| — | `animal-performance-page.tsx` | Live |
| — | `genetic-merit-page.tsx` | Live |

---

## Health & Veterinary

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| `routes/health-monitoring.ts` | `health-monitoring-dashboard.tsx` | Live |
| `routes/health-analytics.ts` | `health-analytics-dashboard.tsx` | Live |
| `routes/vaccination.ts` | `vaccination-dashboard.tsx` | Live |
| `routes/veterinary.ts` | `veterinary-dashboard.tsx` | Live |
| `routes/med.core.ts` | `medicines-inventory.tsx`, `Medicines.tsx` | Live |
| `routes/med.withhold.ts` | `Profile.withhold.badge.patch.tsx` | Live |
| `routes/med.withhold.ids.ts` | `List.withhold.chip.patch.tsx` | Live |
| — | `batch-treatment-page.tsx` | Live |
| — | `Treat.tsx` | Patch |
| — | `Inventory.tsx` | Patch |
| — | `Reports.tsx` (health) | Patch |
| — | `health-predictions-page.tsx` | Live |

---

## Reproduction

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| `routes/reproduction.ts` | `reproduction-dashboard.tsx` | Live |
| `routes/repro.extras.ts` | `RunSheet.tsx` | Live |
| `routes/repro.plan.ts` | `reproduction-planner.tsx` | Live |
| — | `PregQuick.tsx` | Live |
| — | `Planner.offline.patch.tsx` | Patch |

---

## Pasture & Feed

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| `routes/pasture-walks.ts` | `pasture-walk-page.tsx` | Live |
| — | `pastures-list.tsx` | Live |
| — | `pasture-rotation-planner.tsx` | Live |
| — | `feed-planning-page.tsx` | Live |
| — | `Wedge.withhold.patch.tsx` | Patch |

---

## Milk Production

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| `milk-routes.ts` | `milk-production-page.tsx` | Live |
| — | `milk-analytics-page.tsx` | Live |
| — | `lab-results-import.tsx` | Live |

---

## Tasks & Jobs

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| `routes/jobs.ts` | `jobs-page.tsx` | Live |
| `routes/recurring-tasks.ts` | `recurring-tasks-page.tsx` | Live |
| `routes/task-templates.ts` | `task-templates-page.tsx` | Live |
| `routes/task-dependencies.ts` | `task-dependencies-page.tsx` | Live |
| — | `farm-calendar-page.tsx` | Live |
| — | `task-calendar-page.tsx` | Live |
| — | `kanban-page.tsx` | Live |
| — | `map-tasks-page.tsx` | Live |

---

## Staff & HR

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| `routes/staff.ts` | `staff-management-page.tsx` | Live |
| `routes/contractors.ts` | `contractor-management-page.tsx` | Live |
| `routes/roster.ts` | `roster-scheduling-page.tsx` | Live |
| `routes/time-tracking.ts` | `timesheets-page.tsx` | Live |
| `routes/health-safety.ts` | `health-safety-page.tsx` | Live |

---

## Communication

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| `routes/chat.ts`, `chat-routes.ts` | `chat-page.tsx` | Live |
| `routes/voice-notes.ts` | (integrated in chat) | Live |
| `routes/notifications.ts` | `NotificationCenter.tsx` | Live |
| `routes/smart-alerts.ts` | `alerts-notifications-dashboard.tsx`, `alerts-page.tsx` | Live |

---

## Compliance & Reporting

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| `routes/compliance.ts` | `compliance-page.tsx`, `compliance-docs.tsx` | Live |
| `routes/compliance-tags.ts` | `compliance-tags-page.tsx` | Live |
| `routes/nait.ts` | `nait-compliance-page.tsx`, `nait-records.tsx` | Live |
| `routes/nait.core.ts` | (NAIT API integration) | Stub |
| `nzfap-routes.ts` | `nzfap-compliance-page.tsx` | Live |
| `routes/reports.ts` | `reports-export-page.tsx` | Live |
| `routes/herd-reports.ts` | `herd-reports-page.tsx` | Live |
| — | `farm-compliance-page.tsx` | Live |
| — | `environmental-compliance-page.tsx` | Live |
| — | `freshwater-farm-plan-page.tsx` | Live |
| — | `RVMExportButton.tsx` | Patch |

---

## Financial

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| `financial-routes.ts` | `financial-page.tsx` | Live |
| `routes/financial-analytics.ts` | `financial-analytics-page.tsx` | Live |
| `budgeting-routes.ts` | `farm-finance-page.tsx` | Live |
| `routes/stock-transactions.ts` | `stock-reconciliation-page.tsx` | Live |

---

## Operations & Equipment

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| `routes/equipment.ts` | `equipment-page.tsx` | Live |
| `vehicle-routes.ts` | `vehicle-registry-page.tsx` | Live |
| `visitor-routes.ts` | `visitor-portal.tsx` | Live |
| — | `operations-page.tsx` | Live |
| — | `asset-registry-page.tsx` | Live |

---

## Hardware & IoT

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| `routes/hardware.ts` | `ShedPage.tsx` | Live |
| `routes/iot.ts` | `iot-dashboard-page.tsx` | Live |
| `gallagher-routes.ts` | (Gallagher integration) | Stub |
| — | `Drafting.withhold.patch.tsx` | Patch |

---

## Maps & GIS

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| `map-routes.ts` | `gis-mapping-page.tsx` | Live |
| — | `FarmMap.tsx` component | Live |

---

## External Integrations

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| `routes/external-apis.ts` | — | Stub |
| `weather-routes.ts` | `weather-page.tsx`, `weather-integration-page.tsx` | Live |
| `routes/benchmarking.ts` | `benchmarking-page.tsx`, `performance-benchmarking-page.tsx` | Live |
| `routes/multi-farm.ts` | `multi-farm-page.tsx`, `FarmSwitcher.tsx` | Live |

---

## Mobile & Offline

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| `routes/mobile-features.ts` | `mobile-scanner.tsx` | Live |
| `routes/sync.core.ts` | `lib/sync.ts`, `lib/idb.ts` | Patch |
| `routes/photos.ts` | `JobPhotoUpload.tsx` | Live |
| — | `field-mode-dashboard.tsx` | Live |
| — | `qr-code-management-page.tsx` | Live |
| — | `Bulk.offline.patch.tsx` | Patch |

---

## Dashboards & Landing

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| — | `landing-dashboard.tsx` | Live |
| — | `dashboard.tsx` | Live |
| — | `analytics-dashboard.tsx` | Live |
| — | `home.tsx` | Live |
| — | `NZFarmLandingPage.tsx` | Live |

---

## Setup & Configuration

| Route Group (Backend) | Frontend Page/Component | Status |
|----------------------|------------------------|--------|
| — | `settings-page.tsx` | Live |
| — | `csv-import-page.tsx` | Live |
| — | `OnboardingWizard.tsx` | Patch |

---

## Summary Statistics

| Status | Count |
|--------|-------|
| **Live** | ~75 |
| **Stub** | 3 |
| **Patch** | 14 |
| **Missing** | 0 |

---

## Priority Integration Tasks

### High Priority (Patch → Live)
1. `med.withhold.ts` / `med.withhold.ids.ts` - Complete withhold status integration
2. `sync.core.ts` - Finish offline sync implementation
3. `repro.plan.ts` / `repro.extras.ts` - Complete reproduction planning features

### Medium Priority (Stub → Live)
1. `nait.core.ts` - Implement real NAIT API integration
2. `external-apis.ts` - Connect external data sources
3. `gallagher-routes.ts` - Gallagher weighing/EID integration

### Low Priority (Polish)
1. Merge all `.patch.tsx` files into main components
2. Remove duplicate/legacy pages
3. Consolidate health pages (`Treat.tsx`, `Medicines.tsx`, `Inventory.tsx`, `Reports.tsx`)

---

## Notes

- Backend routes in `server/routes/` are modular and mounted via `routes.ts`
- Frontend pages in `client/src/pages/` are routed via `App.tsx`
- Patch files (`.patch.tsx`) contain code snippets to be integrated into existing components
- Service files in `server/services/` provide business logic for routes
