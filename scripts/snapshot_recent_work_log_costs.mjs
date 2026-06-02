import fs from 'node:fs';
import path from 'node:path';
import PocketBase from 'pocketbase';

loadEnvFile(path.join(process.cwd(), '.env.local'));

const PB_URL = normalizeUrl(
  process.env.POCKETBASE_URL ||
  process.env.NEXT_PUBLIC_POCKETBASE_URL ||
  process.env.PB_URL ||
  'http://127.0.0.1:8090',
);

const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL || process.env.PB_ADMIN_EMAIL;
const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD || process.env.PB_ADMIN_PASSWORD;
const personalEmail = process.env.PERSONAL_EMAIL;
const personalId = process.env.PERSONAL_ID;
const createdFrom = process.env.CREATED_FROM || getTodayKey();

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

async function main() {
  await authenticate();

  if (!personalEmail && !personalId) {
    throw new Error('Set PERSONAL_EMAIL or PERSONAL_ID.');
  }

  const person = personalId
    ? await pb.collection('personal').getOne(personalId)
    : await pb.collection('personal').getFirstListItem(`email = "${personalEmail}"`);

  const currentPeriod = await pb.collection('personal_compensation_periods').getFirstListItem(
    `personal = "${person.id}" && (end_date = "" || end_date = null)`,
    { sort: '-start_date' },
  );

  const shiftCount = Array.isArray(currentPeriod.shifts) ? currentPeriod.shifts.filter(Boolean).length : 0;
  const monthlySalary = Number(currentPeriod.monthly_salary) || 0;

  if (monthlySalary <= 0) {
    throw new Error(`Current monthly salary is invalid for ${person.email || person.id}.`);
  }

  if (shiftCount <= 0) {
    throw new Error(`Current shifts are empty for ${person.email || person.id}.`);
  }

  const hourlyRate = monthlySalary / (shiftCount * 4 * 22);
  const logs = await pb.collection('work_logs').getFullList({
    filter: `personal = "${person.id}" && created >= "${toPocketBaseDateStart(createdFrom)}"`,
    sort: 'created',
  });

  let updated = 0;
  for (const log of logs) {
    const hours = Number(log.hours) || 0;
    if (hours <= 0) continue;

    await pb.collection('work_logs').update(log.id, {
      compensation_period: currentPeriod.id,
      compensation_monthly_salary: monthlySalary,
      compensation_shift_count: shiftCount,
      compensation_hourly_rate: hourlyRate,
      compensation_labor_cost: hours * hourlyRate,
    });
    updated++;
  }

  console.log(
    `Snapshot complete for ${person.email || person.id}. Updated ${updated} work logs created from ${createdFrom} with salary ${monthlySalary}.`,
  );
}

async function authenticate() {
  if (!adminEmail || !adminPassword) {
    throw new Error('Missing POCKETBASE_ADMIN_EMAIL/PB_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD/PB_ADMIN_PASSWORD.');
  }

  try {
    await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword);
  } catch (error) {
    if (pb.admins?.authWithPassword) {
      await pb.admins.authWithPassword(adminEmail, adminPassword);
      return;
    }
    throw error;
  }
}

function toPocketBaseDateStart(value) {
  const key = toLocalDateKey(value);
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day).toISOString().replace('T', ' ');
}

function toLocalDateKey(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return getTodayKey();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getTodayKey() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function normalizeUrl(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
