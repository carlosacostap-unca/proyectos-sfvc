## Why

The system currently stores only the current salary and working-hours data on each personal record, which is not enough to calculate historical project costs when salaries or shifts change over time. Project cost needs to be derived from the salary and shift configuration that was valid on each worked date.

## What Changes

- Add historical compensation periods for each personal record, including start date, optional end date, monthly salary, and the shifts valid for that period.
- Preserve historical cost calculations by using compensation data effective on the work log date instead of current personal data.
- Validate compensation periods so the same person cannot have overlapping active date ranges.
- Calculate project labor cost from existing `work_logs` by matching each log to the personal compensation period valid on the log date.
- Surface project cost totals and enough detail to explain which hours, salaries, and periods contributed to the total.
- Keep existing `personal.monthly_salary`, `personal.working_hours`, and `personal.shift` fields as legacy/current summary data unless a later migration removes or repurposes them.

## Capabilities

### New Capabilities

- `personal-compensation-periods`: Manage historical salary and shift periods for personal records.
- `project-labor-costs`: Calculate project labor cost from work logs and effective personal compensation periods.

### Modified Capabilities

- None.

## Impact

- PocketBase schema: add a new collection for personal compensation periods and relation fields to `personal` and `shifts`.
- Frontend types: add a compensation period model and cost calculation result types.
- Personal management UI: add compensation period management for each person.
- Project detail/reporting UI: add cost totals derived from logged hours and effective compensation.
- Existing time tracking remains the source of project hours and should not duplicate salary data.
