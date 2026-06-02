import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_WORKING_DAYS_PER_MONTH,
  HOURS_PER_SHIFT,
  calculateProjectLaborCostSummary,
  doDateRangesOverlap,
  findEffectiveCompensationPeriod,
  findOverlappingCompensationPeriod,
} from '../app/utils/compensation.ts';

const period = (overrides = {}) => ({
  id: 'period-1',
  personal: 'person-1',
  start_date: '2026-01-01',
  end_date: null,
  monthly_salary: 880000,
  shifts: ['morning'],
  created: '',
  updated: '',
  ...overrides,
});

test('detects overlapping compensation periods for the same person', () => {
  const existing = [
    period({ id: 'old', start_date: '2026-01-01', end_date: '2026-03-31' }),
  ];

  const overlap = findOverlappingCompensationPeriod(
    period({ id: 'new', start_date: '2026-03-01', end_date: '2026-04-30' }),
    existing,
  );

  assert.equal(overlap?.id, 'old');
  assert.equal(
    doDateRangesOverlap(
      { start_date: '2026-01-01', end_date: '2026-03-31' },
      { start_date: '2026-04-01', end_date: null },
    ),
    false,
  );
});

test('finds the effective period by work date', () => {
  const periods = [
    period({ id: 'first', start_date: '2026-01-01', end_date: '2026-03-31' }),
    period({ id: 'second', start_date: '2026-04-01', end_date: null, monthly_salary: 1760000, shifts: ['morning', 'afternoon'] }),
  ];

  assert.equal(findEffectiveCompensationPeriod(periods, 'person-1', '2026-02-15')?.id, 'first');
  assert.equal(findEffectiveCompensationPeriod(periods, 'person-1', '2026-05-15')?.id, 'second');
});

test('calculates project labor costs and reports missing compensation', () => {
  const workLogs = [
    {
      id: 'log-1',
      personal: 'person-1',
      project: 'project-1',
      date: '2026-02-10',
      hours: 4,
      created: '',
      updated: '',
    },
    {
      id: 'log-2',
      personal: 'person-2',
      project: 'project-1',
      date: '2026-02-10',
      hours: 2,
      created: '',
      updated: '',
    },
  ];

  const summary = calculateProjectLaborCostSummary('project-1', workLogs, [period()]);
  const expectedHourlyRate = 880000 / (HOURS_PER_SHIFT * BASE_WORKING_DAYS_PER_MONTH);

  assert.equal(summary.totalHours, 6);
  assert.equal(summary.confirmedCost, 4 * expectedHourlyRate);
  assert.equal(summary.missingCostHours, 2);
  assert.equal(summary.missingCompensationCount, 1);
});

test('uses work log compensation snapshot when present', () => {
  const workLogs = [
    {
      id: 'log-snapshot',
      personal: 'person-1',
      project: 'project-1',
      date: '2026-02-10',
      hours: 1,
      compensation_period: 'current-period',
      compensation_monthly_salary: 2000000,
      compensation_shift_count: 1,
      compensation_hourly_rate: 2000000 / (HOURS_PER_SHIFT * BASE_WORKING_DAYS_PER_MONTH),
      created: '',
      updated: '',
    },
  ];

  const periods = [
    period({ id: 'old-period', start_date: '2026-01-01', end_date: '2026-06-01', monthly_salary: 1400000 }),
    period({ id: 'current-period', start_date: '2026-06-02', end_date: null, monthly_salary: 2000000 }),
  ];

  const summary = calculateProjectLaborCostSummary('project-1', workLogs, periods);

  assert.equal(summary.confirmedCost, 2000000 / (HOURS_PER_SHIFT * BASE_WORKING_DAYS_PER_MONTH));
  assert.equal(summary.lines[0].monthlySalary, 2000000);
  assert.equal(summary.lines[0].compensationPeriod.id, 'current-period');
});
