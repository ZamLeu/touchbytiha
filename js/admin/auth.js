/**
 * touchbytiha — Admin authentication
 * Single email/password account managed in Firebase Console.
 */

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirebase, configured } from './firebase.js';
import { ADMIN_UID } from '../firebase-config.js';

/**
 * @param {(user: import('firebase/auth').User|null) => void} callback
 * @returns {() => void} unsubscribe
 */
export function watchAuth(callback) {
  if (!configured) {
    callback(null);
    return () => {};
  }

  const { auth } = getFirebase();
  return onAuthStateChanged(auth, callback);
}

/**
 * @param {string} email
 * @param {string} password
 */
export async function signIn(email, password) {
  const { auth } = getFirebase();
  await setPersistence(auth, browserLocalPersistence);
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);

  // Rules enforce this server-side too, but a clear client error is kinder.
  if (ADMIN_UID && ADMIN_UID !== 'REPLACE_WITH_TIHA_UID' && credential.user.uid !== ADMIN_UID) {
    await signOut(auth);
    throw new Error('This account is not the site admin.');
  }

  return credential.user;
}

export async function signOutAdmin() {
  const { auth } = getFirebase();
  await signOut(auth);
}

/**
 * Turn a Firebase auth error into a human message.
 * @param {unknown} error
 */
export function authErrorMessage(error) {
  const code = /** @type {{code?: string}} */ (error)?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/missing-password':
      return 'Enter your password.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'No connection. Check your internet and try again.';
    default:
      return /** @type {Error} */ (error)?.message || 'Sign in failed.';
  }
}
