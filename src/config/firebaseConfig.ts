import { initializeApp, getApp, getApps } from "firebase/app";
import { initializeFirestore, getFirestore } from "firebase/firestore";
import { initializeAuth, getAuth } from 'firebase/auth';
// @ts-ignore - Metro bundler as vezes se perde nas condicional exports do Firebase, esse import direto previne o crash
import { getReactNativePersistence } from '@firebase/auth/dist/rn/index.js';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

const firebaseConfig = {
  apiKey: "AIzaSyB_gFUuJ4J-utFLJyMJszJ1xs-Oj9QYfgA",
  authDomain: "gryfocorp.firebaseapp.com",
  projectId: "gryfocorp",
  storageBucket: "gryfocorp.firebasestorage.app",
  messagingSenderId: "133432799599",
  appId: "1:133432799599:web:f19c85bb8085c973d2389a",
  measurementId: "G-ZNYDMQFZN3"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch (e) {
  db = getFirestore(app);
}

let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} catch (e) {
  auth = getAuth(app);
}

export { auth, db };