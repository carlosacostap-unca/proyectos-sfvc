import PocketBase from 'pocketbase';
import fs from 'node:fs';
import path from 'node:path';

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

  const [personalCollection, shiftsCollection] = await Promise.all([
    pb.collections.getOne('personal'),
    pb.collections.getOne('shifts'),
  ]);

  const schema = {
    name: 'personal_compensation_periods',
    type: 'base',
    system: false,
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.isAdmin = true',
    updateRule: '@request.auth.isAdmin = true',
    deleteRule: '@request.auth.isAdmin = true',
    fields: [
      {
        name: 'personal',
        type: 'relation',
        required: true,
        presentable: false,
        cascadeDelete: false,
        collectionId: personalCollection.id,
        minSelect: 1,
        maxSelect: 1,
      },
      {
        name: 'start_date',
        type: 'date',
        required: true,
        presentable: false,
      },
      {
        name: 'end_date',
        type: 'date',
        required: false,
        presentable: false,
      },
      {
        name: 'monthly_salary',
        type: 'number',
        required: true,
        presentable: true,
        min: 0,
      },
      {
        name: 'shifts',
        type: 'relation',
        required: true,
        presentable: false,
        cascadeDelete: false,
        collectionId: shiftsCollection.id,
        minSelect: 1,
        maxSelect: 2,
      },
      {
        name: 'observations',
        type: 'text',
        required: false,
        presentable: false,
      },
    ],
    indexes: [
      'CREATE INDEX idx_personal_compensation_periods_personal_start ON personal_compensation_periods (personal, start_date)',
    ],
  };

  try {
    const existing = await pb.collections.getOne('personal_compensation_periods');
    await pb.collections.update(existing.id, schema);
    console.log('Updated personal_compensation_periods collection.');
  } catch (error) {
    if (error?.status !== 404) throw error;
    await pb.collections.create(schema);
    console.log('Created personal_compensation_periods collection.');
  }
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
