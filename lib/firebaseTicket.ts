import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Web app's Firebase configuration for botticket-8b709
const ticketFirebaseConfig = {
  apiKey: "AIzaSyCljeoGi7nhKm7RzPZ1g6UaFuEXj5RpVLE",
  authDomain: "botticket-8b709.firebaseapp.com",
  projectId: "botticket-8b709",
  storageBucket: "botticket-8b709.firebasestorage.app",
  messagingSenderId: "89420445671",
  appId: "1:89420445671:web:e917e386dc8fa639b76f42",
  measurementId: "G-7KPL62RNN6"
};

// Initialize named Firebase app specifically for Ticket Bot
const existingApps = getApps();
const ticketApp = existingApps.find(app => app.name === "ticketApp") 
  || initializeApp(ticketFirebaseConfig, "ticketApp");

export const ticketDb = getFirestore(ticketApp);
export default ticketApp;
