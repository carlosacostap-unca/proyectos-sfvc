import type { PersonalCompensationPeriod, ProjectLaborCostLine, ProjectLaborCostSummary, WorkLog } from '@/app/types';

export const HOURS_PER_SHIFT = 4;
export const BASE_WORKING_DAYS_PER_MONTH = 22;

export const normalizeDateKey = (value: string | Date | null | undefined) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = typeof value === 'string' ? new Date(value.replace(' ', 'T')) : value;
  if (Number.isNaN(date.getTime())) return '';

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const getShiftCount = (period: Pick<PersonalCompensationPeriod, 'shifts'>) => {
  return Array.isArray(period.shifts) ? period.shifts.length : 0;
};

export const deriveDailyHours = (period: Pick<PersonalCompensationPeriod, 'shifts'>) => {
  return getShiftCount(period) * HOURS_PER_SHIFT;
};

export const deriveMonthlyBaseHours = (period: Pick<PersonalCompensationPeriod, 'shifts'>) => {
  return deriveDailyHours(period) * BASE_WORKING_DAYS_PER_MONTH;
};

export const calculateHourlyRate = (period: Pick<PersonalCompensationPeriod, 'monthly_salary' | 'shifts'>) => {
  const monthlyBaseHours = deriveMonthlyBaseHours(period);
  if (monthlyBaseHours <= 0) return 0;
  return period.monthly_salary / monthlyBaseHours;
};

export const isDateInPeriod = (
  date: string | Date,
  period: Pick<PersonalCompensationPeriod, 'start_date' | 'end_date'>,
) => {
  const dateKey = normalizeDateKey(date);
  const startKey = normalizeDateKey(period.start_date);
  const endKey = normalizeDateKey(period.end_date);

  if (!dateKey || !startKey) return false;
  return dateKey >= startKey && (!endKey || dateKey <= endKey);
};

export const doDateRangesOverlap = (
  first: Pick<PersonalCompensationPeriod, 'start_date' | 'end_date'>,
  second: Pick<PersonalCompensationPeriod, 'start_date' | 'end_date'>,
) => {
  const firstStart = normalizeDateKey(first.start_date);
  const firstEnd = normalizeDateKey(first.end_date) || '9999-12-31';
  const secondStart = normalizeDateKey(second.start_date);
  const secondEnd = normalizeDateKey(second.end_date) || '9999-12-31';

  if (!firstStart || !secondStart) return false;
  return firstStart <= secondEnd && secondStart <= firstEnd;
};

export const findOverlappingCompensationPeriod = (
  candidate: Pick<PersonalCompensationPeriod, 'id' | 'personal' | 'start_date' | 'end_date'>,
  periods: Array<Pick<PersonalCompensationPeriod, 'id' | 'personal' | 'start_date' | 'end_date'>>,
) => {
  return periods.find((period) => {
    if (period.personal !== candidate.personal) return false;
    if (period.id && candidate.id && period.id === candidate.id) return false;
    return doDateRangesOverlap(candidate, period);
  });
};

export const findEffectiveCompensationPeriod = (
  periods: PersonalCompensationPeriod[],
  personalId: string,
  date: string | Date,
) => {
  return periods.find((period) => period.personal === personalId && isDateInPeriod(date, period));
};

export const calculateWorkLogCostLine = (
  workLog: WorkLog,
  periods: PersonalCompensationPeriod[],
): ProjectLaborCostLine => {
  const date = normalizeDateKey(workLog.date);
  const snapshotHourlyRate = Number(workLog.compensation_hourly_rate) || 0;
  const snapshotMonthlySalary = Number(workLog.compensation_monthly_salary) || 0;
  const snapshotShiftCount = Number(workLog.compensation_shift_count) || 0;
  const snapshotPeriod = workLog.compensation_period
    ? periods.find(period => period.id === workLog.compensation_period)
    : undefined;
  const hours = Number(workLog.hours) || 0;

  if (snapshotHourlyRate > 0 && snapshotMonthlySalary > 0) {
    return {
      id: workLog.id,
      workLog,
      personal: workLog.expand?.personal,
      compensationPeriod: snapshotPeriod,
      date,
      hours,
      monthlySalary: snapshotMonthlySalary,
      shiftCount: snapshotShiftCount || undefined,
      dailyHours: snapshotShiftCount ? snapshotShiftCount * HOURS_PER_SHIFT : undefined,
      monthlyBaseHours: snapshotShiftCount ? snapshotShiftCount * HOURS_PER_SHIFT * BASE_WORKING_DAYS_PER_MONTH : undefined,
      hourlyRate: snapshotHourlyRate,
      cost: hours * snapshotHourlyRate,
      missingCompensation: false,
    };
  }

  const period = findEffectiveCompensationPeriod(periods, workLog.personal, date);

  if (!period) {
    return {
      id: workLog.id,
      workLog,
      personal: workLog.expand?.personal,
      date,
      hours,
      cost: 0,
      missingCompensation: true,
    };
  }

  const shiftCount = getShiftCount(period);
  const dailyHours = deriveDailyHours(period);
  const monthlyBaseHours = deriveMonthlyBaseHours(period);
  const hourlyRate = calculateHourlyRate(period);

  return {
    id: workLog.id,
    workLog,
    personal: workLog.expand?.personal,
    compensationPeriod: period,
    date,
    hours,
    monthlySalary: period.monthly_salary,
    shiftCount,
    dailyHours,
    monthlyBaseHours,
    hourlyRate,
    cost: hours * hourlyRate,
    missingCompensation: false,
  };
};

export const calculateProjectLaborCostSummary = (
  projectId: string,
  workLogs: WorkLog[],
  periods: PersonalCompensationPeriod[],
): ProjectLaborCostSummary => {
  const projectLogs = workLogs.filter((log) => log.project === projectId);
  const lines = projectLogs.map((log) => calculateWorkLogCostLine(log, periods));

  return lines.reduce<ProjectLaborCostSummary>(
    (summary, line) => ({
      ...summary,
      totalHours: summary.totalHours + line.hours,
      confirmedCost: summary.confirmedCost + line.cost,
      missingCostHours: summary.missingCostHours + (line.missingCompensation ? line.hours : 0),
      missingCompensationCount: summary.missingCompensationCount + (line.missingCompensation ? 1 : 0),
    }),
    {
      projectId,
      totalHours: 0,
      confirmedCost: 0,
      missingCostHours: 0,
      missingCompensationCount: 0,
      lines,
    },
  );
};
