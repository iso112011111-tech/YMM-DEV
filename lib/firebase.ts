import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Web app's Firebase configuration provided by user
const firebaseConfig = {
  apiKey: "AIzaSyBdcMnK7JF0vbx2YQ7HAPii4iGNsCaiqcE",
  authDomain: "botdiscord-role.firebaseapp.com",
  projectId: "botdiscord-role",
  storageBucket: "botdiscord-role.firebasestorage.app",
  messagingSenderId: "745571260467",
  appId: "1:745571260467:web:f49ed8afaa0ca4e086ab46",
  measurementId: "G-JVTBRFKPQ6"
};

// Initialize Firebase safely (avoid multiple initializations in Next.js)
const existingApps = getApps();
const app = existingApps.find(a => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;
