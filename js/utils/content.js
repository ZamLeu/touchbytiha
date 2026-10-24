/**
 * touchbytiha — Content Loader
 * Single source of truth for the public site.
 *
 * Order of preference:
 *   1. Firebase Realtime Database REST (`/content.json`)
 *   2. localStorage cache (`tb-content-cache`)
 *   3. Bundled `data/*.json` fallback
 *
 * The site must never render empty, so this module never throws.
 */

import { DATABASE_URL } from '../firebase-config.js';

const CACHE_KEY = 'tb-content-cache';
const CACHE_VERSION = 1;
const REQUEST_TIMEOUT = 6000;

/**
 * Sort items by their explicit numeric `order` field.
 * @param {Object[]} items
 * @returns {Object[]}
 */
export function sortByOrder(items = []) {
  return [...items].sort((a, b) => {
    const aOrder = Number.isFinite(a?.order) ? a.order : 0;
    const bOrder = Number.isFinite(b?.order) ? b.order : 0;
    return aOrder - bOrder;
  });
}

/**
 * Convert an RTDB node (push-key map) into an array with `id`.
 * @param {Object|Array|null} node
 * @returns {Object[]}
 */
export function toArray(node) {
  if (!node) return [];
  if (Array.isArray(node)) return node.filter(Boolean);
  return Object.entries(node).map(([id, value]) => ({ id, ...value }));
}

/**
 * Normalize any source into the shape the renderers expect.
 * @param {Object} raw
 */
export function normalizeContent(raw) {
  return {
    portfolio: sortByOrder(toArray(raw?.portfolio)),
    testimonials: sortByOrder(toArray(raw?.testimonials)),
    services: sortByOrder(toArray(raw?.services)),
    meta: raw?.meta || {}
  };
}

function hasContent(data) {
  return Boolean(
    data &&
    (data.portfolio.length || data.testimonials.length || data.services.length)
  );
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== CACHE_VERSION || !parsed.data) return null;
    const data = normalizeContent(parsed.data);
    return hasContent(data) ? data : null;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      version: CACHE_VERSION,
      ts: Date.now(),
      data: {
        portfolio: data.portfolio,
        testimonials: data.testimonials,
        services: data.services,
        meta: data.meta
      }
    }));
  } catch {
    // Quota or privacy mode — cache is optional.
  }
}

async function fetchRemote() {
  if (!DATABASE_URL) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${DATABASE_URL}/content.json`, {
      signal: controller.signal,
      cache: 'no-store'
    });
    if (!response.ok) return null;
    const raw = await response.json();
    const data = normalizeContent(raw);
    return hasContent(data) ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBundle() {
  // Resolve against this module, not the page URL, so the fallback also works
  // from /admin/ where relative ./data paths would 404.
  const paths = [
    new URL('../../data/portfolio.json', import.meta.url),
    new URL('../../data/services.json', import.meta.url),
    new URL('../../data/testimonials.json', import.meta.url)
  ];

  try {
    const responses = await Promise.all(paths.map(path => fetch(path)));
    if (responses.some(response => !response.ok)) throw new Error('Bundle fetch failed');

    const [portfolioJson, servicesJson, testimonialsJson] = await Promise.all(
      responses.map(response => response.json())
    );

    const data = normalizeContent({
      portfolio: portfolioJson.portfolio,
      services: servicesJson.services,
      testimonials: testimonialsJson.testimonials,
      meta: { note: servicesJson.note || '' }
    });

    return hasContent(data) ? data : null;
  } catch {
    return null;
  }
}

const EMPTY = { portfolio: [], testimonials: [], services: [], meta: {} };

/**
 * Load site content from RTDB, then cache, then the bundled JSON.
 * @returns {Promise<{portfolio: Object[], testimonials: Object[], services: Object[], meta: Object, source: string}>}
 */
export async function loadContent() {
  const remote = await fetchRemote();
  if (remote) {
    writeCache(remote);
    return { ...remote, source: 'rtdb' };
  }

  const cached = readCache();
  if (cached) return { ...cached, source: 'cache' };

  const bundled = await fetchBundle();
  if (bundled) return { ...bundled, source: 'bundle' };

  return { ...EMPTY, source: 'empty' };
}
