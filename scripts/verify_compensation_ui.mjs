import fs from 'node:fs';
import path from 'node:path';
import PocketBase from 'pocketbase';
import { chromium } from '@playwright/test';

loadEnvFile(path.join(process.cwd(), '.env.local'));

const PB_URL = normalizeUrl(
  process.env.POCKETBASE_URL ||
  process.env.NEXT_PUBLIC_POCKETBASE_URL ||
  process.env.PB_URL ||
  'http://127.0.0.1:8090',
);

const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL || process.env.PB_ADMIN_EMAIL;
const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD || process.env.PB_ADMIN_PASSWORD;
const appUrl = process.env.APP_URL || 'http://localhost:3000';
const outputDir = path.join(process.cwd(), 'output', 'playwright');

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  await authenticate();
  const project = await pb.collection('projects').getFirstListItem('active = true').catch(async () => {
    const fallback = await pb.collection('projects').getList(1, 1);
    return fallback.items[0];
  });
  const person = await pb.collection('personal').getFirstListItem('monthly_salary > 0').catch(async () => {
    const fallback = await pb.collection('personal').getList(1, 1);
    return fallback.items[0];
  });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(({ token, model }) => {
    window.localStorage.setItem('pocketbase_auth', JSON.stringify({ token, model }));
  }, {
    token: pb.authStore.token,
    model: pb.authStore.model,
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.locator('button[title="Parametrizaciones"]').click({ timeout: 20000 });
    await page.getByRole('button', { name: 'Personal', exact: true }).click({ timeout: 10000 });
    await page.getByPlaceholder('Buscar personal...').fill(person.surname || person.name || '');
    await page.getByText(`${person.surname}, ${person.name}`, { exact: true }).click({ timeout: 10000 });
    await page.getByText('Historial salarial').waitFor({ timeout: 20000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, 'personal-compensation.png'), fullPage: true });

    await page.goto(`${appUrl}/projects/${project.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.getByText('Costo de Personal').waitFor({ timeout: 20000 });
    await page.screenshot({ path: path.join(outputDir, 'project-labor-costs.png'), fullPage: true });
  } catch (error) {
    await page.screenshot({ path: path.join(outputDir, 'compensation-ui-debug.png'), fullPage: true }).catch(() => {});
    const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    throw new Error(`${error.message}\nCurrent URL: ${page.url()}\nVisible text:\n${bodyText.slice(0, 2000)}`);
  } finally {
    await browser.close();
  }

  const relevantErrors = consoleErrors.filter((message) => (
    !message.includes('favicon') &&
    !message.includes('DevTools') &&
    !message.includes('Failed to load resource: the server responded with a status of 404') &&
    !message.includes('Realtime project subscription error') &&
    !message.includes('Realtime subscription error') &&
    !message.includes('Missing or invalid client id')
  ));

  if (relevantErrors.length > 0) {
    throw new Error(`Console errors detected:\n${relevantErrors.join('\n')}`);
  }

  console.log(`Verified compensation UI. Screenshots saved to ${outputDir}.`);
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
