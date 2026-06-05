import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC-T2ok_sJTBbey7Hb57EC27JBY6tASX10",
  authDomain: "jb-monthly-medal.firebaseapp.com",
  projectId: "jb-monthly-medal",
  storageBucket: "jb-monthly-medal.firebasestorage.app",
  messagingSenderId: "1040771639389",
  appId: "1:1040771639389:web:f02f1fc1ce1fdef86285b4",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);