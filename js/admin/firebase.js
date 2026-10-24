/**
 * touchbytiha — Admin Firebase bootstrap
 * One app instance shared by auth, store and upload.
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
import { firebaseConfig, isFirebaseConfigured } from '../firebase-config.js';

export const configured = isFirebaseConfigured();

let app = null;
let auth = null;
let db = null;
let storage = null;

export function getFirebase() {
  if (!configured) {
    throw new Error('Firebase is not configured yet. Fill in js/firebase-config.js.');
  }

  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    db = getDatabase(app);
    storage = getStorage(app);
  }

  return { app, auth, db, storage };
}
