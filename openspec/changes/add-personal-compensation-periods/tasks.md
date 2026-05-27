## 1. Data Model

- [x] 1.1 Add `PersonalCompensationPeriod` and project labor cost types to `app/types.ts`.
- [x] 1.2 Create or update PocketBase schema tooling/documentation for the `personal_compensation_periods` collection.
- [x] 1.3 Add collection validation expectations for `personal_compensation_periods` to the PocketBase MCP/schema helper.
- [x] 1.4 Document the new collection and calculation fields in `docs/database_schema.md`.

## 2. Compensation Period Logic

- [x] 2.1 Add date-range helpers to detect overlapping compensation periods for the same personal record.
- [x] 2.2 Add compensation period query helpers for listing periods by personal and finding the effective period for a date.
- [x] 2.3 Add cost calculation helpers with centralized `HOURS_PER_SHIFT = 4` and `BASE_WORKING_DAYS_PER_MONTH = 22` constants.
- [x] 2.4 Add missing-compensation handling so uncosted work logs are reported without breaking totals.

## 3. Personal Management UI

- [x] 3.1 Add compensation period state loading to the personal management flow.
- [x] 3.2 Add admin UI to list, create, edit, and delete compensation periods for the selected person.
- [x] 3.3 Validate required salary, start date, selected shifts, date ordering, and overlapping periods before save.
- [x] 3.4 Keep current personal salary/shift summary display compatible with existing records.

## 4. Project Labor Cost UI

- [x] 4.1 Fetch project work logs with personal and project context for a selected project.
- [x] 4.2 Match work logs to effective compensation periods and calculate confirmed labor cost totals.
- [x] 4.3 Show cost breakdown with person, date, hours, salary period, derived hourly rate, and calculated cost.
- [x] 4.4 Show warnings for work logs missing compensation data.

## 5. Migration and Verification

- [x] 5.1 Add a backfill path for creating initial open-ended compensation periods from existing personal salary and shift data.
- [x] 5.2 Add focused unit tests for overlap detection and labor cost calculation.
- [x] 5.3 Run lint/build checks and fix regressions.
- [x] 5.4 Manually verify personal compensation management and project labor cost display in the app.
