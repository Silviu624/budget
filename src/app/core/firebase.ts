import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { environment } from '../../environments/environment';

/** Single Firebase app instance shared by the whole application. */
export const firebaseApp = initializeApp(environment.firebase);

/** Firebase Authentication (email + password, one shared household account). */
export const auth = getAuth(firebaseApp);

/** Cloud Firestore database. */
export const db = getFirestore(firebaseApp);
