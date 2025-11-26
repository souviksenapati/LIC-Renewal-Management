import { initializeApp } from 'firebase/app';
// @ts-ignore: getReactNativePersistence is missing from types but exists at runtime
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// IMPORTANT: Create firebaseConfig.ts from this template
// Get your config from Firebase Console > Project Settings > Your apps
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};

const app = initializeApp(firebaseConfig);

// @ts-ignore: getReactNativePersistence is missing from types but exists at runtime
const auth = initializeAuth(app, {
    // @ts-ignore: getReactNativePersistence is available in React Native context
    persistence: getReactNativePersistence(AsyncStorage)
});

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
