// Firebase web app configuration.
//
// These values are NOT secrets. They only identify your Firebase project; access to data is
// enforced by Firebase Authentication and the Firestore security rules in /firestore.rules.
// Copy them from: Firebase console > Project settings > General > Your apps > SDK setup.
export const environment = {
  firebase: {
    apiKey: 'AIzaSyD_AmfxTgQJt2-RmQrK6CDVF1s8t_ClJwU',
    authDomain: 'budget-afb02.firebaseapp.com',
    projectId: 'budget-afb02',
    storageBucket: 'budget-afb02.firebasestorage.app',
    messagingSenderId: '1060433593316',
    appId: '1:1060433593316:web:466a262101a975e4d6fdf1',
  },
};

/** True once the placeholders above have been replaced with a real project config. */
export const isFirebaseConfigured = !environment.firebase.apiKey.startsWith('YOUR_');
