import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCueaUCbnVXzKi6oWe0KcerhZZnulumJmw",
  authDomain: "toanthaybien-2c3d2.firebaseapp.com",
  projectId: "toanthaybien-2c3d2",
  storageBucket: "toanthaybien-2c3d2.firebasestorage.app",
  messagingSenderId: "1070682140806",
  appId: "1:1070682140806:web:68e7ee1e67ee95ee2c2107"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

console.log('🌐 Firebase initialized - Production mode');

export default app;
