import { initializeApp, getApps, getApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyBM4j0s-glDrfK7zzFBNpJ2lOvvkvankoU',
  authDomain: 'scholr2026.firebaseapp.com',
  databaseURL: 'https://scholr2026-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'scholr2026',
  storageBucket: 'scholr2026.firebasestorage.app',
  messagingSenderId: '48738771597',
  appId: '1:48738771597:web:3b2de8a4894d6260e478c4',
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
