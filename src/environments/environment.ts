// Firebase web app configuration.
//
// These values are NOT secrets. They only identify your Firebase project; access to data is
// enforced by Firebase Authentication and the Firestore security rules in /firestore.rules.
// Copy them from: Firebase console > Project settings > General > Your apps > SDK setup.
export const environment = {
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT_ID.firebasestorage.app',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID',
  },
};

/** True once the placeholders above have been replaced with a real project config. */
export const isFirebaseConfigured = !environment.firebase.apiKey.startsWith('YOUR_');
