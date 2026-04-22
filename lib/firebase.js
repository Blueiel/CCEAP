import { initializeApp, getApps, getApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Use environment variable for production, fallback to hardcoded for development
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBM4j0s-glDrfK7zzFBNpJ2lOvvkvankoU',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'scholr2026.firebaseapp.com',
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL || 'https://scholr2026-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'scholr2026',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'scholr2026.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '48738771597',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:48738771597:web:3b2de8a4894d6260e478c4',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

const database = getDatabase(app);

export { app, auth, database };
