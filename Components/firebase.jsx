// firebase.jsx
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your Firebase config here
const firebaseConfig = {
  apiKey: "AIzaSyCCI9__j4v4FS5R-GupmPemgBC0jrAkD_w",
  authDomain: "gatherx-4d0e3.firebaseapp.com",
  projectId: "gatherx-4d0e3",
  storageBucket: "gatherx-4d0e3.firebasestorage.app",
  messagingSenderId: "672935638454",
  appId: "1:672935638454:web:a12c9623a6f2f76fc0fd17"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const db = getFirestore(app); // This initializes Firestore as 'db'
const auth = getAuth(app);

// Export Firestore (db) and Auth
export { db, auth };
