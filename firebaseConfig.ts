import { initializeApp } from 'firebase/app';
// @ts-ignore: getReactNativePersistence is missing from types but exists at runtime
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configurations for different environments
const firebaseConfigs = {
    production: {
        apiKey: "AIzaSyAgjc5kDHNqAtOodbNH5LeYxz8Af3t-8w0",
        authDomain: "lic-app-874c6.firebaseapp.com",
        projectId: "lic-app-874c6",
        storageBucket: "lic-app-874c6.firebasestorage.app",
        messagingSenderId: "774508558156",
        appId: "1:774508558156:web:0adfb272d7bc5d4ed341e9",
        measurementId: "G-D40L2G51WG"
    },
    testing: {
        apiKey: "AIzaSyCbATt4wOTOSxR7Dg9MMrxM27mZxj9T-fA",
        authDomain: "lic-app-testing.firebaseapp.com",
        projectId: "lic-app-testing",
        storageBucket: "lic-app-testing.firebasestorage.app",
        messagingSenderId: "841353369856",
        appId: "1:841353369856:web:b8aafdb550573a924d7be5"
    }
};

// Automatically select config based on build profile
const getFirebaseConfig = () => {
    // For local development, check EXPO_PUBLIC_ENV (set by npm scripts)
    // For builds, use EAS_BUILD_PROFILE
    const buildProfile = process.env.EXPO_PUBLIC_ENV || process.env.EAS_BUILD_PROFILE || 'production';
    console.log(`🔥 Using Firebase environment: ${buildProfile}`);
    return firebaseConfigs[buildProfile as keyof typeof firebaseConfigs] || firebaseConfigs.production;
};

const app = initializeApp(getFirebaseConfig());

// @ts-ignore: getReactNativePersistence is missing from types but exists at runtime
const auth = initializeAuth(app, {
    // @ts-ignore: getReactNativePersistence is available in React Native context
    persistence: getReactNativePersistence(AsyncStorage)
});

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
