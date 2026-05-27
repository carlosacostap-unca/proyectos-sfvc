import { pb } from '@/lib/pocketbase';
import { PersonalCompensationPeriod, WorkLog } from '@/app/types';
import { getLocalDayEndUTC, getLocalDayStartUTC } from '@/app/utils/date';

export const listCompensationPeriodsByPersonal = async (personalId: string) => {
  return pb.collection('personal_compensation_periods').getFullList<PersonalCompensationPeriod>({
    filter: `personal = "${personalId}"`,
    sort: '-start_date',
    expand: 'shifts',
  });
};

export const listCompensationPeriodsForPersonalIds = async (personalIds: string[]) => {
  const uniqueIds = Array.from(new Set(personalIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const filter = uniqueIds.map((id) => `personal = "${id}"`).join(' || ');
  return pb.collection('personal_compensation_periods').getFullList<PersonalCompensationPeriod>({
    filter,
    sort: 'personal,start_date',
    expand: 'personal,shifts',
  });
};

export const listProjectWorkLogs = async (
  projectId: string,
  startDate?: string,
  endDate?: string,
) => {
  const filters = [`project = "${projectId}"`];

  if (startDate) {
    filters.push(`date >= "${getLocalDayStartUTC(startDate)}"`);
  }

  if (endDate) {
    filters.push(`date <= "${getLocalDayEndUTC(endDate)}"`);
  }

  return pb.collection('work_logs').getFullList<WorkLog>({
    filter: filters.join(' && '),
    sort: '-date,-created',
    expand: 'personal,project',
  });
};

