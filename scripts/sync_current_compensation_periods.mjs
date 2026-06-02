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

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

async function main() {
  await authenticate();

  const people = await pb.collection('personal').getFullList({
    sort: 'surname,name',
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const person of people) {
    const monthlySalary = Number(person.monthly_salary) || 0;
    const shifts = Array.isArray(person.shift) ? person.shift.filter(Boolean) : [];

    if (monthlySalary <= 0 || shifts.length === 0) {
      skipped++;
      continue;
    }

    const periods = await pb.collection('personal_compensation_periods').getFullList({
      filter: `personal = "${person.id}"`,
      sort: '-start_date',
    });
    const openPeriod = periods.find(period => !period.end_date);
    const payload = {
      personal: person.id,
      start_date: openPeriod?.start_date || toPocketBaseDate(person.join_date || person.created || new Date()),
      end_date: null,
      monthly_salary: monthlySalary,
      shifts,
      observations: openPeriod?.observations || 'Periodo vigente sincronizado desde la ficha del personal.',
    };

    if (openPeriod) {
      await pb.collection('personal_compensation_periods').update(openPeriod.id, payload);
      updated++;
    } else {
      await pb.collection('personal_compensation_periods').create(payload);
      created++;
    }
  }

  console.log(`Sync complete. Created: ${created}. Updated: ${updated}. Skipped: ${skipped}.`);
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
