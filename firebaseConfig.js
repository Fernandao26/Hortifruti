// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';  // Importa AsyncStorage
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyDliYVHC2xKGvJA95eHPXrX1LJQISzeKPc",
  authDomain: "pi5semestre-b6926.firebaseapp.com",
  projectId: "pi5semestre-b6926",
  storageBucket: "pi5semestre-b6926.firebasestorage.app",
  messagingSenderId: "324878064774",
  appId: "1:324878064774:web:ed02f1b9b613a45b2d0507",
  measurementId: "G-Q94WDSM493"
};

const app = initializeApp(firebaseConfig);

// Use initializeAuth com AsyncStorage para persistência no React Native
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');
