## ADDED Requirements

### Requirement: Admins can manage personal compensation periods
The system SHALL allow admins to create, edit, list, and delete compensation periods for a personal record.

#### Scenario: Create compensation period
- **WHEN** an admin creates a compensation period with personal, start date, monthly salary, and at least one shift
- **THEN** the system stores the period and associates it with that personal record

#### Scenario: List compensation history
- **WHEN** an admin opens a personal record
- **THEN** the system shows that person's compensation periods ordered by start date descending

### Requirement: Compensation periods capture effective salary and shifts
Each compensation period SHALL store the monthly salary and shifts that are valid for that person during the period date range.

#### Scenario: Open-ended current period
- **WHEN** an admin saves a compensation period without an end date
- **THEN** the system treats the period as valid from its start date onward

#### Scenario: Historical closed period
- **WHEN** an admin saves a compensation period with an end date after or equal to the start date
- **THEN** the system treats the period as valid only through that end date

### Requirement: Compensation periods must not overlap
The system SHALL prevent overlapping compensation periods for the same personal record.

#### Scenario: Overlapping period rejected
- **WHEN** an admin tries to save a compensation period whose date range overlaps an existing period for the same person
- **THEN** the system rejects the save and explains that the period overlaps existing compensation history

#### Scenario: Adjacent periods accepted
- **WHEN** an admin saves a period that starts after another period's end date
- **THEN** the system accepts the period

### Requirement: Compensation period shifts determine base daily hours
The system SHALL derive base daily hours from selected shifts using 4 hours per shift.

#### Scenario: One shift derives four daily hours
- **WHEN** a compensation period has one selected shift
- **THEN** the system uses 4 base daily hours for cost calculations in that period

#### Scenario: Two shifts derive eight daily hours
- **WHEN** a compensation period has two selected shifts
- **THEN** the system uses 8 base daily hours for cost calculations in that period

### Requirement: Current personal summary fields do not define historical cost
The system SHALL calculate historical project cost from compensation periods, not from current salary or shift fields on the personal record.

#### Scenario: Personal current salary changes
- **WHEN** a person's current profile salary is edited after prior work logs exist
- **THEN** prior project cost calculations continue to use the compensation periods effective on each work log date
