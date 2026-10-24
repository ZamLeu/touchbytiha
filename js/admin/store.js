/**
 * touchbytiha — Admin data store
 * All reads/writes go through Firebase Realtime Database.
 *
 * Every mutation snapshots the previous raw node so the UI can offer a
 * session-only "Undo last action".
 */

import {
  ref,
  get,
  set,
  update,
  push
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
import {
  ref as storageRef,
  listAll,
  deleteObject,
  getDownloadURL,
  uploadBytesResumable
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
import { getFirebase } from './firebase.js';
import { sortByOrder, toArray } from '../utils/content.js';

const COLLECTIONS = ['portfolio', 'testimonials', 'services'];

/** @type {{portfolio: Object[], testimonials: Object[], services: Object[], meta: Object} | null} */
let state = null;

/** Raw RTDB nodes, used for exact undo snapshots. */
let raw = { portfolio: {}, testimonials: {}, services: {}, meta: {} };

export function getState() {
  return state;
}

/**
 * Timestamp of the last write seen by this session.
 * @returns {number}
 */
export function getKnownUpdatedAt() {
  return Number(raw.meta?.updatedAt) || 0;
}

/**
 * Re-read the remote timestamp to detect writes from another tab.
 * @returns {Promise<number>}
 */
export async function fetchRemoteUpdatedAt() {
  const { db } = getFirebase();
  try {
    const snapshot = await get(ref(db, 'content/meta/updatedAt'));
    return Number(snapshot.val()) || 0;
  } catch {
    return 0;
  }
}

/**
 * Read everything under /content.
 */
export async function loadAdminContent() {
  const { db } = getFirebase();
  const snapshot = await get(ref(db, 'content'));
  const value = snapshot.val() || {};

  raw = {
    portfolio: value.portfolio || {},
    testimonials: value.testimonials || {},
    services: value.services || {},
    meta: value.meta || {}
  };

  state = {
    portfolio: sortByOrder(toArray(raw.portfolio)),
    testimonials: sortByOrder(toArray(raw.testimonials)),
    services: sortByOrder(toArray(raw.services)),
    meta: raw.meta
  };

  return state;
}

function renumber(items) {
  return items.map((item, index) => ({ ...item, order: (index + 1) * 10 }));
}

/**
 * Write a whole collection (sorted first), tagging meta.updatedAt.
 * @param {'portfolio'|'testimonials'|'services'} name
 * @param {Object[]} items
 * @returns {Promise<{collection: string, previous: Object, previousMeta: Object}>}
 */
export async function saveCollection(name, items) {
  if (!COLLECTIONS.includes(name)) throw new Error(`Unknown collection: ${name}`);

  const { db } = getFirebase();
  // Array order is the source of truth for this write — renumber from it,
  // do not re-sort by the existing `order` field or reordering becomes a no-op.
  const ordered = renumber(items);

  const map = {};
  for (const item of ordered) {
    const { id, ...rest } = item;
    const fields = {};
    for (const [key, value] of Object.entries(rest)) {
      if (key.startsWith('__')) continue;
      if (value === undefined) continue;
      fields[key] = value;
    }
    const key = id || push(ref(db, `content/${name}`)).key;
    map[key] = fields;
  }

  const previous = raw[name] || {};
  const previousMeta = raw.meta || {};
  const nextMeta = { ...previousMeta, updatedAt: Date.now() };

  // One atomic multi-path write instead of two sequential round trips.
  // Written relative to /content so it stays inside the node the rules grant
  // write access to. Each path is replaced wholesale, so removed keys vanish.
  await update(ref(db, 'content'), {
    [name]: Object.keys(map).length ? map : null,
    meta: nextMeta
  });

  raw[name] = map;
  raw.meta = nextMeta;
  state[name] = sortByOrder(toArray(map));
  state.meta = nextMeta;

  return { collection: name, previous, previousMeta };
}

/**
 * Save /content/meta (note).
 * @param {Object} patch
 */
export async function saveMeta(patch) {
  const { db } = getFirebase();
  const previousMeta = raw.meta || {};
  const next = { ...previousMeta, ...patch, updatedAt: Date.now() };

  await set(ref(db, 'content/meta'), next);

  raw.meta = next;
  if (state) state.meta = next;

  return { collection: 'meta', previous: previousMeta, previousMeta: previousMeta };
}

/**
 * Restore a snapshot returned by saveCollection / saveMeta.
 * @param {{collection: string, previous: Object, previousMeta: Object}} snapshot
 */
export async function restoreSnapshot(snapshot) {
  const { db } = getFirebase();
  const { collection, previous, previousMeta } = snapshot;

  if (collection === 'meta') {
    await set(ref(db, 'content/meta'), previous);
    raw.meta = previous || {};
    if (state) state.meta = raw.meta;
    return;
  }

  await set(ref(db, `content/${collection}`), previous || null);
  await set(ref(db, 'content/meta'), previousMeta || null);

  raw[collection] = previous || {};
  raw.meta = previousMeta || {};
  if (state) {
    state[collection] = sortByOrder(toArray(raw[collection]));
    state.meta = raw.meta;
  }
}

/**
 * Pre-allocate a push key so a new item's Storage folder matches its DB key.
 * @param {string} collection
 * @returns {string}
 */
export function newItemId(collection) {
  const { db } = getFirebase();
  return push(ref(db, `content/${collection}`)).key;
}

/**
 * Upload an encoded image blob.
 *
 * Returns a Download URL built from the upload response's `downloadTokens`
 * metadata — asking `getDownloadURL` afterwards would cost a second round
 * trip for data we already have.
 *
 * @param {Blob} blob
 * @param {string} folder - "portfolio" | "testimonials"
 * @param {string} [itemId]
 * @param {(fraction: number) => void} [onProgress] - 0..1
 * @returns {Promise<{img: string, storagePath: string, id: string}>}
 */
export async function uploadImage(blob, folder = 'portfolio', itemId, onProgress) {
  const { storage } = getFirebase();
  const id = itemId || newItemId(folder);
  const contentType = blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
  const extension = contentType === 'image/jpeg' ? 'jpg' : 'webp';
  const path = `${folder}/${id}/${Date.now()}.${extension}`;

  const fileRef = storageRef(storage, path);
  const task = uploadBytesResumable(fileRef, blob, {
    contentType,
    cacheControl: 'public,max-age=31536000'
  });

  if (onProgress) {
    task.on('state_changed', snapshot => {
      if (snapshot.totalBytes) {
        onProgress(Math.min(1, snapshot.bytesTransferred / snapshot.totalBytes));
      }
    });
  }

  const snapshot = await task;

  const token = snapshot.metadata?.downloadTokens;
  const img = token
    ? `https://firebasestorage.googleapis.com/v0/b/${snapshot.metadata.bucket}` +
      `/o/${encodeURIComponent(path)}?alt=media&token=${token}`
    : await getDownloadURL(fileRef);

  return { img, storagePath: path, id };
}

/**
 * Delete one storage object, swallowing "not found".
 * @param {string} path
 */
export async function deleteStorageObject(path) {
  if (!path) return;
  const { storage } = getFirebase();
  try {
    await deleteObject(storageRef(storage, path));
  } catch (error) {
    if (error?.code !== 'storage/object-not-found') throw error;
  }
}

/**
 * Recursively list every object under a storage prefix.
 * @param {string} prefix
 * @returns {Promise<{path: string, size: number, updated: string}[]>}
 */
async function listAllFiles(prefix = '') {
  const { storage } = getFirebase();
  const results = [];

  async function walk(path) {
    const listing = await listAll(storageRef(storage, path));
    listing.items.forEach(item => {
      results.push({
        path: item.fullPath,
        size: item.size || 0,
        updated: item.updated || ''
      });
    });
    await Promise.all(listing.prefixes.map(prefixRef => walk(prefixRef.fullPath)));
  }

  await walk(prefix);
  return results;
}

/**
 * Files in Storage with no matching storagePath in /content.
 */
export async function findOrphans() {
  const content = await loadAdminContent();
  const referenced = new Set();

  for (const name of COLLECTIONS) {
    for (const item of content[name]) {
      if (item.storagePath) referenced.add(item.storagePath);
    }
  }

  const files = await listAllFiles('');
  return files.filter(file => !referenced.has(file.path));
}

/**
 * @param {{path: string}[]} orphans
 */
export async function deleteOrphans(orphans) {
  for (const orphan of orphans) {
    await deleteStorageObject(orphan.path);
  }
}

/**
 * Human message for Firebase failures.
 * @param {unknown} error
 */
export function storeErrorMessage(error) {
  const code = /** @type {{code?: string}} */ (error)?.code || '';
  if (code === 'PERMISSION_DENIED' || code === 'storage/unauthorized') {
    return 'Permission denied. Your session may have expired — sign in again.';
  }
  if (code === 'storage/retry-limit-exceeded' || code === 'storage/unknown') {
    return 'Upload failed. Check your connection and try again.';
  }
  if (code === 'auth/requires-recent-login') {
    return 'Session expired. Sign in again.';
  }
  return /** @type {Error} */ (error)?.message || 'Something went wrong.';
}
