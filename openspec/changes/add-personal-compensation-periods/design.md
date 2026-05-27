## Context

The current project uses PocketBase as the backend and stores personnel data in `personal`, project assignments in `project_assignments`, and worked hours in `work_logs`. The `personal` collection already has `monthly_salary`, `working_hours`, and `shift`, but those fields represent a current snapshot and cannot support historical project cost calculation when a person's salary or shifts change.

The cost model needs to answer: "What did this project cost for this work log date?" The answer depends on the compensation period that was active for that person on the work log date, not on the person's current salary or current shifts.

## Goals / Non-Goals

**Goals:**

- Add a historical compensation model per person.
- Store monthly salary and selected shifts for each effective period.
- Prevent overlapping compensation periods for the same person.
- Calculate labor cost for project work logs using the compensation period valid on each log date.
- Expose project cost totals and per-log/per-person calculation details for auditability.

**Non-Goals:**

- Replace time tracking or duplicate project hours outside `work_logs`.
- Implement payroll, payslip generation, taxes, benefits, bonuses, or deductions.
- Remove legacy salary or shift fields from `personal` in this change.
- Model variable shift lengths per shift catalog item unless future requirements require it.

## Decisions

### Add `personal_compensation_periods`

Create a PocketBase collection with:

- `personal`: required relation to `personal`
- `start_date`: required date
- `end_date`: optional date
- `monthly_salary`: required number, greater than or equal to zero
- `shifts`: required multi-relation to `shifts`
- `observations`: optional text

This keeps historical compensation separate from the current personal profile and avoids recalculating old costs from newly edited personal fields.

Alternative considered: update `personal.monthly_salary` and `personal.shift` directly. That is simpler for current state, but it loses history and produces incorrect historical project costs.

### Derive daily hours from selected shifts

Each selected shift represents 4 working hours per day. A person with one shift has a 4-hour day; a person with two shifts has an 8-hour day. The compensation period stores the selected shifts, and cost calculation derives:

```text
daily_hours = shifts.length * 4
```

Alternative considered: store `daily_hours` on each compensation period. We are avoiding it for now because the domain rule is currently tied to shifts, and the user called out that storing arbitrary hours felt redundant.

### Use a fixed monthly working-day base

The initial hourly cost formula will use a configurable constant:

```text
BASE_WORKING_DAYS_PER_MONTH = 22
hourly_rate = monthly_salary / (derived_daily_hours * BASE_WORKING_DAYS_PER_MONTH)
labor_cost = work_log.hours * hourly_rate
```

This makes project cost stable across months and avoids cost differences caused only by calendar shape. The constant should live in one calculation utility so a later change can move it to settings if needed.

Alternative considered: use real business days for each month. That is more calendar-accurate, but it can make the same salary and shift produce different hourly rates month to month, which is less predictable for management reporting.

### Match compensation by work log date

For each `work_logs` record, the system finds the matching compensation period where:

```text
period.personal = log.personal
period.start_date <= log.date
period.end_date is empty OR period.end_date >= log.date
```

If no matching compensation period exists, the log remains visible but is marked as missing cost data and excluded from the calculated cost total unless the UI explicitly shows an estimated or incomplete total.

### Keep current personal fields as summary data

Existing `personal.monthly_salary`, `personal.working_hours`, and `personal.shift` are left in place to avoid breaking existing UI. Implementation may update those summary fields from the latest open compensation period, but project cost calculation must not depend on them.

## Risks / Trade-offs

- Historical gaps -> Some logs may not have a matching compensation period. Mitigation: cost reports must show missing-compensation warnings and identify affected people/dates.
- Overlapping periods -> A log could match more than one salary. Mitigation: validate period creation and updates before saving.
- Shift duration assumption -> The rule assumes every shift is 4 hours. Mitigation: centralize `HOURS_PER_SHIFT = 4` and avoid scattering the value through UI code.
- PocketBase constraints -> Cross-record overlap validation may need application-level checks. Mitigation: implement frontend validation and server-side/admin validation helpers where PocketBase rules cannot express it directly.

## Migration Plan

1. Add the `personal_compensation_periods` collection.
2. Add frontend types and calculation helpers.
3. Backfill one open-ended compensation period per existing personal record that has a monthly salary or shifts, using the personal join date when available and existing salary/shift values.
4. Add UI for admins to maintain compensation periods from personal management.
5. Add project cost display based on `work_logs` and effective compensation periods.
6. Keep rollback simple by leaving existing `personal` fields untouched; disabling the new UI removes the new behavior without corrupting existing data.

## Open Questions

- Should the base working days per month remain fixed at 22 permanently, or become a configurable system setting later?
- Should backfilled periods be created only for active personnel, or for all personnel with salary data?
