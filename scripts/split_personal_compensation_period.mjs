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
const previousMonthlySalary = Number(process.env.PREVIOUS_MONTHLY_SALARY || 0);
const effectiveDate = process.env.EFFECTIVE_DATE || getTodayKey();

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

async function main() {
  await authenticate();

  if (!personalEmail && !personalId) {
    throw new Error('Set PERSONAL_EMAIL or PERSONAL_ID.');
  }

  if (!previousMonthlySalary || previousMonthlySalary <= 0) {
    throw new Error('Set PREVIOUS_MONTHLY_SALARY with the salary that must remain on the historical period.');
  }

  const person = personalId
    ? await pb.collection('personal').getOne(personalId)
    : await pb.collection('personal').getFirstListItem(`email = "${personalEmail}"`);

  const currentMonthlySalary = Number(process.env.CURRENT_MONTHLY_SALARY || person.monthly_salary || 0);
  const currentShifts = Array.isArray(person.shift) ? person.shift.filter(Boolean) : [];

  if (!currentMonthlySalary || currentMonthlySalary <= 0) {
    throw new Error(`Current monthly salary is invalid for ${person.email || person.id}.`);
  }

  if (currentShifts.length === 0) {
    throw new Error(`Current shifts are empty for ${person.email || person.id}.`);
  }

  const periods = await pb.collection('personal_compensation_periods').getFullList({
    filter: `personal = "${person.id}"`,
    sort: '-start_date',
  });
  const openPeriod = periods.find(period => !period.end_date);

  if (!openPeriod) {
    throw new Error(`No open compensation period found for ${person.email || person.id}.`);
  }

  const openPeriodStart = toLocalDateKey(openPeriod.start_date);
  if (openPeriodStart >= effectiveDate) {
    await pb.collection('personal_compensation_periods').update(openPeriod.id, {
      monthly_salary: currentMonthlySalary,
      shifts: currentShifts,
    });
    console.log(`Updated existing current period ${openPeriod.id}; it already starts on/after ${effectiveDate}.`);
    return;
  }

  await pb.collection('personal_compensation_periods').update(openPeriod.id, {
    end_date: toPocketBaseDate(addDaysToLocalDate(effectiveDate, -1)),
    monthly_salary: previousMonthlySalary,
  });

  const existingCurrent = periods.find(period => toLocalDateKey(period.start_date) === effectiveDate);
  if (existingCurrent) {
    await pb.collection('personal_compensation_periods').update(existingCurrent.id, {
      end_date: null,
      monthly_salary: currentMonthlySalary,
      shifts: currentShifts,
      observations: existingCurrent.observations || 'Periodo vigente creado al separar un cambio salarial.',
    });
  } else {
    await pb.collection('personal_compensation_periods').create({
      personal: person.id,
      start_date: toPocketBaseDate(effectiveDate),
      end_date: null,
      monthly_salary: currentMonthlySalary,
      shifts: currentShifts,
      observations: 'Periodo vigente creado al separar un cambio salarial.',
    });
  }

  console.log(
    `Split compensation for ${person.email || person.id}: previous ${previousMonthlySalary} until ${addDaysToLocalDate(effectiveDate, -1)}, current ${currentMonthlySalary} from ${effectiveDate}.`,
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

function toPocketBaseDate(value) {
  const date = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function toLocalDateKey(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getTodayKey() {
  return toLocalDateKey(new Date());
}

function addDaysToLocalDate(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return toLocalDateKey(date);
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

