import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { environment } from '../../environments/environment';

/** Single Firebase app instance shared by the whole application. */
export const firebaseApp = initializeApp(environment.firebase);

/** Firebase Authentication (email + password, one shared household account). */
export const auth = getAuth(firebaseApp);

/** Cloud Firestore with an offline cache in the browser (memory cache in tests). */
export const db = initializeFirestore(firebaseApp, {
  localCache:
    typeof indexedDB !== 'undefined'
      ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      : memoryLocalCache(),
});
