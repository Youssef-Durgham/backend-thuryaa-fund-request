// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBdXmitO4uD6Go4f3h_4MNolzMjgvH3SOI",
  authDomain: "alinshaea.firebaseapp.com",
  projectId: "alinshaea",
  storageBucket: "alinshaea.appspot.com",
  messagingSenderId: "982854828233",
  appId: "1:982854828233:web:ef04f14fa278302ca20d18",
  measurementId: "G-P4FK26X11Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);