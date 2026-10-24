/**
 * Firebase web config — PUBLIC values, safe to commit.
 *
 * Fill in the values from:
 * Firebase Console → Project settings → Your apps → Web app config.
 *
 * Only the admin panel loads the Firebase SDK. The public site just reads
 * the RTDB REST endpoint below, so a missing apiKey/appId never breaks it.
 */

export const firebaseConfig = {
  apiKey: 'AIzaSyDengcV3vJ-2f5zrjVasOKCq1wygfPW2AI',
  authDomain: 'touchbytiha.firebaseapp.com',
  databaseURL: 'https://touchbytiha-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'touchbytiha',
  storageBucket: 'touchbytiha.firebasestorage.app',
  messagingSenderId: '769158560090',
  appId: '1:769158560090:web:13e7662b9d17de61cf1b63'
};

export const DATABASE_URL = firebaseConfig.databaseURL;

/**
 * UID of the single admin account. Also hardcoded in database.rules.json
 * and storage.rules — update all three together.
 */
export const ADMIN_UID = 'nv2FE24hS2bkplZjAWgbKwsW0K93';

/**
 * True when every web config value has been filled in.
 */
export function isFirebaseConfigured() {
  return !Object.values(firebaseConfig).some(
    value => typeof value === 'string' && value.startsWith('REPLACE_')
  );
}
