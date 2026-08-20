// Firebase project init — the shared backend your devices sync stats/history through. The
// apiKey etc. below are NOT secret (Firebase web config is meant to be public in client code;
// actual access control is enforced by Firestore security rules, not by hiding this object) —
// see console.firebase.google.com project settings if these ever need to be regenerated. Same
// pattern as every other project in this series.
//
// REPLACE_ME placeholders below — cross-device sync won't work until these are filled in with
// a real Firebase project's config. See the README's "Deploying" section. Everything else
// (local play, stats, quizzing) works with zero setup either way — sync is purely additive.
import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.firebasestorage.app',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
