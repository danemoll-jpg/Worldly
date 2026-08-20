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
  apiKey: 'AIzaSyAtHOLohUQfNZK4DNw5DoKrOvvS4hSNO-8',
  authDomain: 'wordly-bef21.firebaseapp.com',
  projectId: 'wordly-bef21',
  storageBucket: 'wordly-bef21.firebasestorage.app',
  messagingSenderId: '763673320460',
  appId: '1:763673320460:web:485d7f67aeafa131202229',
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
