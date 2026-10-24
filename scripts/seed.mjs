/**
 * One-off seed: data/*.json  ->  Firebase Realtime Database /content
 *
 * Usage:
 *   1. Firebase Console → Project settings → Service accounts → Generate new private key
 *   2. Save it as scripts/serviceAccount.json  (gitignored)
 *   3. node scripts/seed.mjs            # aborts if /content already has data
 *      node scripts/seed.mjs --force    # overwrite /content
 *
 * Requires: npm i firebase-admin
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const DATABASE_URL = 'https://touchbytiha-default-rtdb.asia-southeast1.firebasedatabase.app';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const force = process.argv.includes('--force');

const readJson = (name) => JSON.parse(readFileSync(join(root, 'data', name), 'utf8'));

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(join(here, 'serviceAccount.json'), 'utf8'));
} catch {
  console.error('Missing scripts/serviceAccount.json — download it from Firebase Console first.');
  process.exit(1);
}

const app = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: DATABASE_URL
});
const db = getDatabase(app);
const contentRef = db.ref('content');

const portfolioJson = readJson('portfolio.json');
const servicesJson = readJson('services.json');
const testimonialsJson = readJson('testimonials.json');

const withOrder = (items) => items.map((item, i) => ({ ...item, order: (i + 1) * 10 }));

const portfolio = withOrder(portfolioJson.portfolio).map(item => ({
  ...item,
  storagePath: null
}));

const testimonials = withOrder(testimonialsJson.testimonials).map(item => ({
  ...item,
  storagePath: null
}));

const services = withOrder(servicesJson.services);

function toPushMap(items) {
  const map = {};
  for (const item of items) {
    const key = contentRef.push().key;
    map[key] = item;
  }
  return map;
}

const snapshot = await contentRef.once('value');

if (snapshot.exists() && !force) {
  console.error('/content already exists. Re-run with --force to overwrite.');
  process.exit(1);
}

await contentRef.set({
  portfolio: toPushMap(portfolio),
  testimonials: toPushMap(testimonials),
  services: toPushMap(services),
  meta: {
    note: servicesJson.note || '',
    updatedAt: Date.now()
  }
});

console.log(
  `Seeded /content: ${portfolio.length} portfolio, ${testimonials.length} testimonials, ` +
  `${services.length} services, 1 note.`
);
process.exit(0);
