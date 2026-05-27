## ADDED Requirements

### Requirement: Project labor cost is calculated from work logs
The system SHALL calculate project labor cost by summing the cost of `work_logs` records associated with the project.

#### Scenario: Project has costed work logs
- **WHEN** a project has work logs with matching compensation periods
- **THEN** the system shows the sum of each work log's hours multiplied by the effective hourly rate

### Requirement: Effective hourly rate uses monthly salary and shifts
The system SHALL calculate the effective hourly rate from the compensation period active on the work log date.

#### Scenario: Calculate hourly rate for one shift
- **WHEN** a work log date matches a compensation period with monthly salary 880000 and one selected shift
- **THEN** the system calculates the hourly rate as 880000 divided by 88 monthly base hours

#### Scenario: Calculate hourly rate for two shifts
- **WHEN** a work log date matches a compensation period with monthly salary 1760000 and two selected shifts
- **THEN** the system calculates the hourly rate as 1760000 divided by 176 monthly base hours

### Requirement: Work log cost uses compensation period effective on log date
The system SHALL match each work log to the compensation period for the same person whose date range contains the work log date.

#### Scenario: Salary changes during project
- **WHEN** a person has work logs before and after a salary change
- **THEN** the system calculates each log using the salary period effective on that log's date

#### Scenario: Shift changes during project
- **WHEN** a person changes from one shift to two shifts during a project
- **THEN** the system calculates each log using the shift count effective on that log's date

### Requirement: Missing compensation is reported
The system SHALL identify work logs that cannot be costed because no compensation period matches the personal and date.

#### Scenario: Work log without compensation period
- **WHEN** a project has a work log for a person/date without a matching compensation period
- **THEN** the system shows the log as missing compensation data and excludes it from the confirmed cost total

### Requirement: Cost details are auditable
The system SHALL expose enough calculation detail to explain project labor cost totals.

#### Scenario: View cost breakdown
- **WHEN** an admin views project labor cost
- **THEN** the system shows the contributing person, date range or log date, hours, salary period, derived hourly rate, and calculated cost
