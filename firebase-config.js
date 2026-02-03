import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⚠️ 用你原本 Firebase 專案的設定（你之前就有，照貼回來）
const firebaseConfig = {
  apiKey: "AIzaSyDkj60hCKagiQijipxl3s6F5soN1YIKadE",
  authDomain: "whatispend-3c060.firebaseapp.com",
  databaseURL: "https://whatispend-3c060-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "whatispend-3c060",
  storageBucket: "whatispend-3c060.firebasestorage.app",
  messagingSenderId: "740100624448",
  appId: "1:740100624448:web:88c3298185bd163fba8fa5",
  measurementId: "G-X5V7G8QBCY"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);