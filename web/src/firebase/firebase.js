import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDYEraTTcGqOEZfTXje6K0oUvQPWmbh9q8",
  authDomain: "padaroja-24ba9.firebaseapp.com",
  projectId: "padaroja-24ba9",
  storageBucket: "padaroja-24ba9.firebasestorage.app",
  messagingSenderId: "212024219951",
  appId: "1:212024219951:web:d81924c50338d2f5abe9da",
  measurementId: "G-FLX1C61ZZW"
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
