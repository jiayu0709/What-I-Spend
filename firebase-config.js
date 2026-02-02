// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDkj60hCKaqiQjipxL3s6F5soN1YIKadE",
  authDomain: "whatispend-3c060.firebaseapp.com",
  projectId: "whatispend-3c060",
  storageBucket: "whatispend-3c060.appspot.com",
  messagingSenderId: "740100624448",
  appId: "1:740100624448:web:88c3298185bd163fba8fa5"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 1. 導出給模組化腳本使用 (import { auth } from './firebase-config.js')
export { app, auth, db };

// 2. 掛載到 window 給普通的 <script> 使用 (如你之前的 add.html)
window.app = app;
window.auth = auth;
window.db = db;