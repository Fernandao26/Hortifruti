// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';


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

const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };