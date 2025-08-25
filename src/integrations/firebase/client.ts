// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBIR4GKK3o2H5KyIr0wVz7xWlq2A_GHteg",
  authDomain: "task-tracker-24353.firebaseapp.com",
  projectId: "task-tracker-24353",
  storageBucket: "task-tracker-24353.appspot.com",
  messagingSenderId: "491306978860",
  appId: "1:491306978860:web:88900fc8078ee852000b89",
  measurementId: "G-CN26S154QY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

export { app, auth, db, analytics };
